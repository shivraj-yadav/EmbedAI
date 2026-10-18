import { ConversationsTab } from "@/components/dashboard/conversations-tab";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ConversationsPage({ params }: PageProps) {
  const { id } = await params;
  return <ConversationsTab chatbotId={id} />;
}
