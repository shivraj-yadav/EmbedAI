import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: "Chatbot ID is required" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const serviceClient = createServiceClient();

  const { data: bot, error } = await serviceClient
    .from("chatbots")
    .select("id, name, welcome_message, theme")
    .eq("id", id)
    .single();

  if (error || !bot) {
    return NextResponse.json(
      { error: "Chatbot not found" },
      { status: 404, headers: CORS_HEADERS }
    );
  }

  // Safe public configuration
  const publicConfig = {
    id: bot.id,
    name: bot.name,
    welcomeMessage: bot.welcome_message || "Hi! How can I help you today?",
    theme: {
      primaryColor: (bot.theme as any)?.primaryColor || "#3b82f6",
      position: (bot.theme as any)?.position || "bottom-right",
      headerTitle: (bot.theme as any)?.headerTitle || bot.name,
    },
  };

  return NextResponse.json(publicConfig, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
    },
  });
}
