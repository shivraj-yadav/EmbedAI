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
    .select("id, name, description, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("GET /api/chatbots error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = (chatbots ?? []).map((bot: any) => ({
    id: bot.id,
    name: bot.name,
    description: bot.description ?? "",
    created_at: bot.created_at,
    document_count: 0,
    conversation_count: 0,
    status: "no_documents",
  }));

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, description, welcomeMessage } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Chatbot name is required" }, { status: 400 });
  }
  if (!welcomeMessage?.trim()) {
    return NextResponse.json({ error: "Welcome message is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("chatbots")
    .insert({
      user_id: user.id,
      name: name.trim(),
      description: description?.trim() ?? null,
      welcome_message: welcomeMessage.trim(),
    })
    .select()
    .single();

  if (error) {
    console.error("POST /api/chatbots error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
