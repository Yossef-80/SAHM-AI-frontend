import { AssistantView } from "@/components/assistant/assistant-view";

export default function ConversationPage({ params }: { params: { id: string } }) {
  return <AssistantView conversationId={params.id} />;
}
