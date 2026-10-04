import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  // Verify authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch chatbots with aggregated counts via a Postgres function
  // RLS on chatbots ensures user_id = auth.uid() automatically
  const { data: chatbots, error } = await supabase
    .from("chatbots")
    .select(
      `
      id,
      name,
      description,
      created_at,
      documents!left(status),
      conversations!left(id)
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("GET /api/chatbots error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Shape the response — compute counts and status from joined data
  const result = (chatbots ?? []).map((bot: any) => {
    const docs: { status: string }[] = bot.documents ?? [];
    const conversations: { id: string }[] = bot.conversations ?? [];

    const document_count = docs.filter((d) => d.status === "ready").length;
    const conversation_count = conversations.length;
    const status = document_count > 0 ? "active" : "no_documents";

    return {
      id: bot.id,
      name: bot.name,
      description: bot.description ?? "",
      created_at: bot.created_at,
      document_count,
      conversation_count,
      status,
    };
  });

  return NextResponse.json(result);
}
