import Groq from "groq-sdk";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamLLMOptions {
  systemPrompt: string;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
}

/**
 * Stream an LLM response.
 * Uses Groq (Qwen 3.8 27B / Llama) if GROQ_API_KEY is configured.
 * Automatically falls back to Gemini REST API if GROQ_API_KEY is missing or if Groq errors.
 */
export async function streamLLMResponse({
  systemPrompt,
  messages,
  temperature = 0.2,
  maxTokens = 1024,
}: StreamLLMOptions): Promise<{ stream: ReadableStream<string>; provider: "groq" | "gemini" }> {
  const groqApiKey = process.env.GROQ_API_KEY?.trim();

  // ─── 1. Primary: Groq LPUs ────────────────────────────────────────────────
  if (groqApiKey) {
    try {
      const groq = new Groq({ apiKey: groqApiKey });
      const model = process.env.GROQ_MODEL?.trim() || "qwen/qwen3.8-27b";

      const groqMessages = [
        { role: "system" as const, content: systemPrompt },
        ...messages.map((m) => ({
          role: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
          content: m.content,
        })),
      ];

      const groqStream = await groq.chat.completions.create({
        model,
        messages: groqMessages,
        temperature,
        max_completion_tokens: maxTokens,
        stream: true,
      });

      const stream = new ReadableStream<string>({
        async start(controller) {
          try {
            for await (const chunk of groqStream) {
              const token = chunk.choices[0]?.delta?.content;
              if (token) {
                controller.enqueue(token);
              }
            }
          } catch (err) {
            controller.error(err);
          } finally {
            controller.close();
          }
        },
      });

      return { stream, provider: "groq" };
    } catch (groqErr: any) {
      console.warn(
        `[llm] Groq call failed (${groqErr?.message || groqErr}). Falling back to Gemini...`
      );
      // Fall through to Gemini fallback
    }
  }

  // ─── 2. Fallback: Google Gemini REST ──────────────────────────────────────
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
  if (!geminiApiKey) {
    throw new Error(
      "No LLM provider available. Please set GROQ_API_KEY or GEMINI_API_KEY in .env.local"
    );
  }

  const geminiModel = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:streamGenerateContent?alt=sse&key=${geminiApiKey}`;

  const geminiContents = messages.map((m) => ({
    role: m.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: m.content }],
  }));

  const res = await fetch(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: geminiContents,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    }),
  });

  if (!res.ok || !res.body) {
    const errText = await res.text();
    throw new Error(`Gemini LLM API error (${res.status}): ${errText.slice(0, 300)}`);
  }

  const stream = new ReadableStream<string>({
    async start(controller) {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr || jsonStr === "[DONE]") continue;

            try {
              const parsed = JSON.parse(jsonStr);
              const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                controller.enqueue(text);
              }
            } catch {
              // Ignore malformed SSE chunk
            }
          }
        }
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
        reader.releaseLock();
      }
    },
  });

  return { stream, provider: "gemini" };
}
