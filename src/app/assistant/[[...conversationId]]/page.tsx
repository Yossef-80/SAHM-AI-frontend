import { AssistantView } from "@/components/assistant/assistant-view";

/**
 * One route segment for both `/assistant` and `/assistant/{id}`.
 *
 * These used to be two files (`page.tsx` and `[id]/page.tsx`), which made the
 * two URLs *different route segments*. Sending the first message calls
 * `router.replace('/assistant/{id}')`, so Next unmounted this page and mounted
 * the other one: the whole chat was rebuilt, its local state was lost and the
 * fresh conversation query had no cache, so the message list was replaced by a
 * skeleton for a round-trip. That was the visible flash on every new chat.
 *
 * An optional catch-all keeps a single segment: the URL changes from
 * `/assistant` to `/assistant/{id}` and React keeps the same component
 * instance, so the conversation that is already on screen is never torn down.
 */
export default function AssistantPage({
  params,
}: {
  /** Absent for `/assistant`; `[id]` for `/assistant/{id}`. */
  params: { conversationId?: string[] };
}) {
  return <AssistantView conversationId={params.conversationId?.[0] ?? null} />;
}
