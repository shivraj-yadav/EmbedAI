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

  // 3. Resolve dynamic app URL with intelligent live host detection
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const protocol =
    forwardedProto || (host && !host.includes("localhost") ? "https" : "http");
  const requestOrigin = host ? `${protocol}://${host}` : undefined;

  let envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) {
    // If env is set to localhost, but the user is accessing via a live domain, prioritize the live domain
    if (
      envUrl.includes("localhost") &&
      requestOrigin &&
      !requestOrigin.includes("localhost")
    ) {
      envUrl = requestOrigin;
    }
  }

  const appUrl = (
    envUrl ||
    requestOrigin ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");

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
