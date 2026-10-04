import Link from "next/link";
import { Plus, Bot } from "lucide-react";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ChatbotCard, type ChatbotCardData } from "@/components/dashboard/chatbot-card";

// ─── Skeleton for loading state ──────────────────────────────────────────────

function ChatbotCardSkeleton() {
  return (
    <div className="flex flex-col bg-card border border-border rounded-2xl p-5 gap-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-muted flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-muted rounded w-2/3" />
          <div className="h-3 bg-muted rounded w-1/3" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-muted rounded w-full" />
        <div className="h-3 bg-muted rounded w-3/4" />
      </div>
      <div className="h-3 bg-muted rounded w-1/2" />
      <div className="flex gap-2 pt-1 border-t border-border/60">
        <div className="h-8 bg-muted rounded flex-1" />
        <div className="h-8 bg-muted rounded flex-1" />
      </div>
    </div>
  );
}

// ─── Chatbot grid — server component ─────────────────────────────────────────

async function ChatbotGrid() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Fetch chatbots — counts will be populated when M4/M5 are built
  const { data: rows, error } = await supabase
    .from("chatbots")
    .select("id, name, description, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Failed to load chatbots. Please refresh.
      </p>
    );
  }

  const chatbots: ChatbotCardData[] = (rows ?? []).map((bot: any) => ({
    id: bot.id,
    name: bot.name,
    description: bot.description ?? "",
    created_at: bot.created_at,
    document_count: 0,
    conversation_count: 0,
    status: "no_documents" as const,
  }));

  // ── Empty state ──
  if (chatbots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
          <Bot className="w-8 h-8 text-muted-foreground" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-semibold">No chatbots yet</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Create your first chatbot to get started. Upload documents and embed
            it on any website.
          </p>
        </div>
        <Button asChild id="create-chatbot-empty-cta">
          <Link href="/dashboard/chatbots/new">
            <Plus className="w-4 h-4 mr-2" />
            Create Chatbot
          </Link>
        </Button>
      </div>
    );
  }

  // ── Grid ──
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
      {chatbots.map((bot) => (
        <ChatbotCard key={bot.id} bot={bot} />
      ))}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("name")
    .eq("id", user!.id)
    .single();

  const displayName = profile?.name ?? "there";

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto w-full">
      {/* ── Header row ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {displayName} 👋</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here are all your AI chatbots
          </p>
        </div>
        <Button asChild id="create-chatbot-btn">
          <Link href="/dashboard/chatbots/new">
            <Plus className="w-4 h-4 mr-2" />
            Create Chatbot
          </Link>
        </Button>
      </div>

      {/* ── Chatbot grid with Suspense skeleton ── */}
      <Suspense
        fallback={
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {[...Array(3)].map((_, i) => (
              <ChatbotCardSkeleton key={i} />
            ))}
          </div>
        }
      >
        <ChatbotGrid />
      </Suspense>
    </div>
  );
}
