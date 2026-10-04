import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/dashboard/settings-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ChatbotSettingsPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: bot, error } = await supabase
    .from("chatbots")
    .select("id, name, description, welcome_message, system_prompt, theme")
    .eq("id", id)
    .single();

  if (error || !bot) notFound();

  return (
    <SettingsForm
      chatbot={{
        id: bot.id,
        name: bot.name,
        description: bot.description ?? "",
        welcome_message: bot.welcome_message,
        system_prompt: bot.system_prompt ?? null,
        theme: (bot.theme as Record<string, string>) ?? {},
      }}
    />
  );
}
