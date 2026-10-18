import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const { id: chatbotId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Verify chatbot ownership
  const { data: bot, error: botError } = await supabase
    .from("chatbots")
    .select("id, name")
    .eq("id", chatbotId)
    .single();

  if (botError || !bot) {
    return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
  }

  // 2. Parse pagination query params
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const offset = (page - 1) * limit;

  // 3. Count total conversations
  const { count: totalCount, error: countError } = await supabase
    .from("conversations")
    .select("*", { count: "exact", head: true })
    .eq("chatbot_id", chatbotId);

  if (countError) {
    console.error("[conversations] Count error:", countError);
    return NextResponse.json({ error: "Failed to count conversations" }, { status: 500 });
  }

  const total = totalCount ?? 0;

  // 4. Fetch paginated conversations
  const { data: rawConversations, error: convError } = await supabase
    .from("conversations")
    .select("id, session_id, created_at")
    .eq("chatbot_id", chatbotId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (convError) {
    console.error("[conversations] Fetch error:", convError);
    return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
  }

  const convList = rawConversations ?? [];

  // 5. Aggregate message previews for each conversation
  const conversations = await Promise.all(
    convList.map(async (c) => {
      // First user message for preview
      const { data: firstMsg } = await supabase
        .from("messages")
        .select("content, created_at")
        .eq("conversation_id", c.id)
        .eq("role", "user")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      // Total message count
      const { count: msgCount } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", c.id);

      // Last message timestamp
      const { data: lastMsg } = await supabase
        .from("messages")
        .select("created_at")
        .eq("conversation_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Human-readable visitor label
      const shortId = (c.session_id || c.id || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase();
      const visitor_label = shortId ? `Visitor #${shortId}` : "Visitor";

      return {
        id: c.id,
        session_id: c.session_id,
        visitor_label,
        first_message: firstMsg?.content || "Conversation started",
        message_count: msgCount ?? 0,
        created_at: c.created_at,
        last_message_at: lastMsg?.created_at || c.created_at,
      };
    })
  );

  return NextResponse.json({
    total,
    page,
    limit,
    conversations,
  });
}
