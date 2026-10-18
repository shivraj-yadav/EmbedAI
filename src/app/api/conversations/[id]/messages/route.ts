import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const { id: conversationId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Fetch conversation
  const { data: conv, error: convError } = await supabase
    .from("conversations")
    .select("id, chatbot_id, session_id, created_at")
    .eq("id", conversationId)
    .single();

  if (convError || !conv) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  // 2. Verify chatbot ownership
  const { data: bot, error: botError } = await supabase
    .from("chatbots")
    .select("id, name")
    .eq("id", conv.chatbot_id)
    .single();

  if (botError || !bot) {
    return NextResponse.json({ error: "Unauthorized access to this conversation" }, { status: 403 });
  }

  // 3. Fetch all messages in chronological order
  const { data: messages, error: msgError } = await supabase
    .from("messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (msgError) {
    console.error("[conversation-messages] Fetch error:", msgError);
    return NextResponse.json({ error: "Failed to load messages" }, { status: 500 });
  }

  // Formatted visitor label
  const shortId = (conv.session_id || conv.id || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase();
  const visitor_label = shortId ? `Visitor #${shortId}` : "Visitor";

  return NextResponse.json({
    conversation: {
      ...conv,
      chatbot_name: bot.name,
      visitor_label,
    },
    messages: messages ?? [],
  });
}
