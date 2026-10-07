import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateEmbedding } from "@/lib/utils/embedder";
import { streamLLMResponse, LLMMessage } from "@/lib/utils/llm";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatRequestBody {
  chatbotId: string;
  conversationId?: string;
  message: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TOP_K = 5;
const MAX_HISTORY_MESSAGES = 6;
const SIMILARITY_THRESHOLD = 0.2;

const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant. Answer the user's question using ONLY the information provided in the Context section below.
If the answer is not found in the Context, respond with: "I couldn't find that information in my knowledge base."
Do not make up information. Do not answer questions outside the provided context.
Be concise, clear, and helpful.`;

// ─── POST /api/chat ───────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const serviceClient = createServiceClient();

  // 1. Parse body
  let body: ChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { chatbotId, conversationId, message } = body;

  if (!chatbotId || !message?.trim()) {
    return NextResponse.json(
      { error: "chatbotId and message are required" },
      { status: 400 }
    );
  }

  // 2. Validate chatbot exists
  const { data: bot, error: botError } = await serviceClient
    .from("chatbots")
    .select("id, name, system_prompt, welcome_message")
    .eq("id", chatbotId)
    .single();

  if (botError || !bot) {
    console.error("[chat] Chatbot lookup failed:", botError);
    return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
  }

  // 3. Create or load conversation (resilient to missing migrations)
  let convId = conversationId;
  let persistenceEnabled = true;

  if (!convId) {
    const { data: newConv, error: convError } = await serviceClient
      .from("conversations")
      .insert({ chatbot_id: chatbotId })
      .select("id")
      .single();

    if (convError || !newConv) {
      console.warn(
        "[chat] Warning: conversations table not found or insert failed. Run 004_m5_conversations.sql in Supabase to enable persistence.",
        convError?.message
      );
      // Fallback: use an ephemeral ID so the user can still chat in preview
      convId = crypto.randomUUID();
      persistenceEnabled = false;
    } else {
      convId = newConv.id;
    }
  }

  // 4. Load conversation history (if persistence enabled)
  const history: LLMMessage[] = [];
  if (persistenceEnabled && convId) {
    try {
      const { data: historyRows } = await serviceClient
        .from("messages")
        .select("role, content")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true })
        .limit(MAX_HISTORY_MESSAGES);

      if (historyRows) {
        for (const row of historyRows) {
          history.push({
            role: row.role === "assistant" ? "assistant" : "user",
            content: row.content,
          });
        }
      }
    } catch {
      // Table might not exist yet, continue with clean history
    }
  }

  // 5. Generate query embedding via Gemini (gemini-embedding-001)
  let queryEmbedding: number[];
  try {
    queryEmbedding = await generateEmbedding(message.trim());
  } catch (err: any) {
    console.error("[chat] Embedding error:", err);
    return NextResponse.json(
      { error: "Failed to generate query embedding: " + (err.message ?? String(err)) },
      { status: 500 }
    );
  }

  // 6. Vector similarity search via match_chunks RPC
  let matchedChunks: { id: string; content: string; similarity: number }[] = [];
  const { data: chunks, error: searchError } = await serviceClient.rpc(
    "match_chunks",
    {
      filter_chatbot_id: chatbotId,
      query_embedding: queryEmbedding,
      match_count: TOP_K,
      similarity_threshold: SIMILARITY_THRESHOLD,
    }
  );

  if (searchError) {
    console.warn(
      "[chat] Vector search warning (match_chunks RPC):",
      searchError.message
    );
  } else {
    matchedChunks = chunks ?? [];
  }

  // 7. Build RAG prompt with retrieved knowledge chunks
  const systemPrompt = bot.system_prompt?.trim() || DEFAULT_SYSTEM_PROMPT;
  const contextBlock =
    matchedChunks.length > 0
      ? `\n\nContext:\n${matchedChunks.map((c, i) => `[${i + 1}] ${c.content}`).join("\n\n")}`
      : "";

  const fullSystemPrompt = systemPrompt + contextBlock;

  // 8. Stream response from LLM (Groq primary, Gemini fallback)
  const llmMessages: LLMMessage[] = [
    ...history,
    { role: "user", content: message.trim() },
  ];

  let tokenStream: ReadableStream<string>;
  let providerName = "unknown";

  try {
    const result = await streamLLMResponse({
      systemPrompt: fullSystemPrompt,
      messages: llmMessages,
      temperature: 0.2,
      maxTokens: 1024,
    });
    tokenStream = result.stream;
    providerName = result.provider;
  } catch (err: any) {
    console.error("[chat] Stream initialization error:", err);
    return NextResponse.json(
      { error: "LLM generation failed: " + (err.message ?? String(err)) },
      { status: 502 }
    );
  }

  // 9. Build SSE stream for client
  const conversationIdHeader = convId ?? "";
  let accumulatedText = "";

  const readable = new ReadableStream({
    async start(controller) {
      // Send conversationId and provider in initial meta event
      const meta = `event: meta\ndata: ${JSON.stringify({
        conversationId: conversationIdHeader,
        provider: providerName,
      })}\n\n`;
      controller.enqueue(new TextEncoder().encode(meta));

      const reader = tokenStream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          if (value) {
            accumulatedText += value;
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ token: value })}\n\n`
              )
            );
          }
        }
      } catch (streamErr) {
        console.error("[chat] Streaming error:", streamErr);
      } finally {
        reader.releaseLock();
        controller.close();

        // 10. Persist user and assistant messages if table is available
        const trimmedMessage = message.trim();
        const trimmedResponse = accumulatedText.trim();

        if (persistenceEnabled && trimmedMessage && trimmedResponse && convId) {
          try {
            await serviceClient.from("messages").insert([
              { conversation_id: convId, role: "user", content: trimmedMessage },
              { conversation_id: convId, role: "assistant", content: trimmedResponse },
            ]);
          } catch (insertError) {
            console.warn("[chat] Message persistence warning:", insertError);
          }
        }
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Conversation-Id": conversationIdHeader,
      "X-LLM-Provider": providerName,
    },
  });
}
