import Link from "next/link";
import { FileText, MessageSquare, Settings, Code2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface ChatbotCardData {
  id: string;
  name: string;
  description: string;
  document_count: number;
  conversation_count: number;
  status: "active" | "no_documents";
  created_at: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ChatbotCard({ bot }: { bot: ChatbotCardData }) {
  const initials = getInitials(bot.name);
  const isActive = bot.status === "active";

  return (
    <div className="group relative flex flex-col bg-card border border-border rounded-2xl p-5 gap-4 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-base leading-tight truncate">
            {bot.name}
          </h2>
          {/* Status badge */}
          <div className="mt-1">
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
                isActive
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-amber-500/10 text-amber-400"
              )}
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  isActive ? "bg-emerald-400" : "bg-amber-400"
                )}
              />
              {isActive ? "Active" : "No Documents"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Description ── */}
      {bot.description ? (
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
          {bot.description}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground/50 italic">
          No description added.
        </p>
      )}

      {/* ── Stats ── */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" />
          {bot.document_count}{" "}
          {bot.document_count === 1 ? "Document" : "Documents"}
        </span>
        <span className="text-border">|</span>
        <span className="flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5" />
          {bot.conversation_count}{" "}
          {bot.conversation_count === 1 ? "Conversation" : "Conversations"}
        </span>
      </div>

      {/* ── Actions ── */}
      <div className="flex gap-2 pt-1 border-t border-border/60">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5"
          id={`manage-${bot.id}`}
        >
          <Link href={`/dashboard/chatbots/${bot.id}`}>
            <Settings className="w-3.5 h-3.5" />
            Manage
          </Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="flex-1 gap-1.5"
          id={`embed-${bot.id}`}
        >
          <Link href={`/dashboard/chatbots/${bot.id}/embed`}>
            <Code2 className="w-3.5 h-3.5" />
            Embed
          </Link>
        </Button>
      </div>
    </div>
  );
}
