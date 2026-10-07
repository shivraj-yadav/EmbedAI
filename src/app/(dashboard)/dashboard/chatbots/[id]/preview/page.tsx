import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatPreview } from "@/components/dashboard/chat-preview";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PreviewPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: bot, error } = await supabase
    .from("chatbots")
    .select("id, name, welcome_message, system_prompt")
    .eq("id", id)
    .single();

  if (error || !bot) notFound();

  return (
    <ChatPreview
      chatbotId={bot.id}
      chatbotName={bot.name}
      welcomeMessage={bot.welcome_message}
    />
  );
}
