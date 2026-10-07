import { EmbedTab } from "@/components/dashboard/embed-tab";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EmbedPage({ params }: PageProps) {
  const { id } = await params;
  return <EmbedTab chatbotId={id} />;
}
