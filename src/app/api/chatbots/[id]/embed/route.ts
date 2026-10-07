import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Fetch chatbot and ensure ownership
  const { data: bot, error: botError } = await supabase
    .from("chatbots")
    .select("id, name, theme")
    .eq("id", id)
    .single();

  if (botError || !bot) {
    return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
  }

  // 2. Count ready documents
  const { count: readyDocCount } = await supabase
    .from("documents")
    .select("*", { count: "exact", head: true })
    .eq("chatbot_id", id)
    .eq("status", "ready");

  const documentCount = readyDocCount ?? 0;
  const isReady = documentCount > 0;

  // 3. Resolve dynamic app URL from environment variable or host
  const host = request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const headerOrigin = host ? `${protocol}://${host}` : undefined;
  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    headerOrigin ||
    "http://localhost:3000"
  ).replace(/\/$/, "");

  const widgetUrl = `${appUrl}/widget.js`;
  const embedCode = `<script\n  src="${widgetUrl}"\n  data-chatbot-id="${bot.id}"\n  async>\n</script>`;

  return NextResponse.json({
    chatbotId: bot.id,
    chatbotName: bot.name,
    embedCode,
    isReady,
    documentCount,
    widgetUrl,
    appUrl,
  });
}
