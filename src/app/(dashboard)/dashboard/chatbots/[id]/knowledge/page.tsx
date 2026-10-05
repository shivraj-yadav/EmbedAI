import { KnowledgeTab } from "@/components/dashboard/knowledge-tab";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function KnowledgePage({ params }: PageProps) {
  const { id } = await params;
  return <KnowledgeTab chatbotId={id} />;
}
