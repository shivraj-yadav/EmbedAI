import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/chatbots/:id ────────────────────────────────────────────────────

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: bot, error } = await supabase
    .from("chatbots")
    .select("id, name, description, welcome_message, system_prompt, theme, created_at, user_id")
    .eq("id", id)
    .single();

  if (error || !bot) {
    return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
  }

  // RLS already guarantees ownership — but double-check
  if ((bot as any).user_id && (bot as any).user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    id: bot.id,
    name: bot.name,
    description: bot.description ?? "",
    welcomeMessage: bot.welcome_message,
    systemPrompt: bot.system_prompt ?? null,
    theme: bot.theme ?? {},
    document_count: 0,
    conversation_count: 0,
    created_at: bot.created_at,
  });
}

// ─── PATCH /api/chatbots/:id ──────────────────────────────────────────────────

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, description, welcomeMessage, systemPrompt, theme } = body;

  // Build only the fields that were provided
  const updates: Record<string, unknown> = {};
  if (name !== undefined)          updates.name = name.trim();
  if (description !== undefined)   updates.description = description?.trim() ?? null;
  if (welcomeMessage !== undefined) updates.welcome_message = welcomeMessage.trim();
  if (systemPrompt !== undefined)  updates.system_prompt = systemPrompt?.trim() ?? null;
  if (theme !== undefined)         updates.theme = theme;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  // RLS enforces ownership — update will silently affect 0 rows if not owner
  const { data, error } = await supabase
    .from("chatbots")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Chatbot not found or forbidden" },
      { status: error ? 500 : 404 }
    );
  }

  return NextResponse.json(data);
}

// ─── DELETE /api/chatbots/:id ─────────────────────────────────────────────────

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // CASCADE constraints on the DB handle child records automatically.
  // RLS ensures only the owner can delete.
  const { error } = await supabase
    .from("chatbots")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("DELETE /api/chatbots/:id error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
