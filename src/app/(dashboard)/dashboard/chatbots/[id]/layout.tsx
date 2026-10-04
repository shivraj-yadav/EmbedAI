import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatbotTabs } from "@/components/dashboard/chatbot-tabs";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function ChatbotLayout({ children, params }: LayoutProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Verify chatbot exists and belongs to user
  const { data: bot, error } = await supabase
    .from("chatbots")
    .select("id, name, user_id")
    .eq("id", id)
    .single();

  if (error || !bot) notFound();

  return (
    <div className="flex flex-col h-full">
      {/* Chatbot header */}
      <div className="px-6 pt-6 pb-0 border-b border-border/0">
        <h1 className="text-xl font-bold mb-4">{bot.name}</h1>
        <ChatbotTabs chatbotId={id} />
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {children}
      </div>
    </div>
  );
}
