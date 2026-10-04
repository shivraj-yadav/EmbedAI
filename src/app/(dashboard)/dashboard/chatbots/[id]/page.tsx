import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, MessageSquare, Hash, Plus, Code2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ChatbotOverviewPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Simple query — no joins on tables that don't exist yet (M4/M5)
  const { data: bot, error } = await supabase
    .from("chatbots")
    .select("id, name, description, welcome_message, created_at")
    .eq("id", id)
    .single();

  if (error || !bot) notFound();

  // Counts will be live once M4 (documents) and M5 (conversations) are built
  const docCount = 0;
  const convCount = 0;
  const msgCount = 0;

  const stats = [
    { label: "Documents", value: docCount, icon: FileText },
    { label: "Conversations", value: convCount, icon: MessageSquare },
    { label: "Messages", value: msgCount, icon: Hash },
  ];

  return (
    <div className="max-w-3xl space-y-8">
      {/* Description */}
      {bot.description && (
        <p className="text-muted-foreground">{bot.description}</p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="flex flex-col gap-2 p-4 rounded-xl border border-border bg-card"
          >
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Icon className="w-4 h-4" />
              {label}
            </div>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex gap-3">
        <Button asChild variant="outline" id="overview-add-doc-btn">
          <Link href={`/dashboard/chatbots/${id}/knowledge`}>
            <Plus className="w-4 h-4 mr-2" />
            Add Document
          </Link>
        </Button>
        <Button asChild variant="outline" id="overview-embed-btn">
          <Link href={`/dashboard/chatbots/${id}/embed`}>
            <Code2 className="w-4 h-4 mr-2" />
            Get Embed Code
          </Link>
        </Button>
      </div>

      {/* Welcome message preview */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Welcome Message
        </p>
        <div className="p-4 rounded-xl border border-border bg-muted/30 text-sm">
          {bot.welcome_message}
        </div>
      </div>
    </div>
  );
}
