"use client";

import { useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { sortMessagesChronologically } from "@/lib/api/adapters";
import { qk } from "@/lib/query-keys";
import { useAssistantStore } from "@/store/assistant-store";
import type { Conversation, Message, SendMessageInput, SendMessageOutput } from "@/types";
import { useConversation } from "./use-api";

/** The shape `useConversation` caches: `GET /assistant/conversations/{id}`. */
type ConversationSnapshot = { conversation: Conversation; messages: Message[] };

/**
 * Merge one finished exchange into the conversation cache.
 *
 * Kept as a plain function so both the success and the error path can use it.
 * Existing messages are preserved (a conversation is usually longer than this
 * one turn), the finished pair replaces any optimistic copies by id, and the
 * list is re-sorted so the rendering order matches the server's.
 */
function seedConversation(qc: QueryClient, conversationId: string, result: SendMessageOutput) {
  const key = qk.conversation(conversationId);
  const cached = qc.getQueryData<ConversationSnapshot>(key);

  if (cached) {
    const byId = new Map(cached.messages.map((m) => [m.id, m]));
    byId.set(result.userMessage.id, result.userMessage);
    byId.set(result.assistantMessage.id, result.assistantMessage);
    qc.setQueryData<ConversationSnapshot>(key, {
      conversation: result.conversation,
      // `Array.from`, not spread: the project's `target` does not enable
      // downlevel iteration, so spreading a Map iterator does not compile.
      messages: sortMessagesChronologically(Array.from(byId.values())),
    });
    return;
  }

  qc.setQueryData<ConversationSnapshot>(key, {
    conversation: result.conversation,
    messages: sortMessagesChronologically([result.userMessage, result.assistantMessage]),
  });
}


/**
 * Chat state for one conversation: cached messages + the in-flight exchange.
 *
 * The FastAPI backend streams orchestration progress over SSE, then returns the
 * final block list. The optimistic user bubble and progress events stay in the
 * store while the response is in flight.
 */
export function useChat(conversationId: string | null) {
  const router = useRouter();
  const qc = useQueryClient();
  const query = useConversation(conversationId);
  const stream = useAssistantStore((s) => s.stream);
  const setStream = useAssistantStore((s) => s.setStream);
  const clearContext = useAssistantStore((s) => s.clearContext);
  const abortRef = useRef<AbortController | null>(null);
  const isSendingRef = useRef(false);

  const streamBelongsHere = !!stream && (
    stream.conversationId === conversationId || (!conversationId && stream.input.conversationId === null)
  );

  const messages = useMemo<Message[]>(() => {
    const base = query.data?.messages ?? [];
    if (!stream || !streamBelongsHere || stream.status === "done") {
      return sortMessagesChronologically(base);
    }
    const ids = new Set(base.map((m) => m.id));
    const extra = [stream.userMessage, stream.assistantMessage].filter((m): m is Message => !!m && !ids.has(m.id));
    return sortMessagesChronologically([...base, ...extra]);
  }, [query.data, stream, streamBelongsHere]);

  const send = useCallback(
    async (input: SendMessageInput) => {
      if (isSendingRef.current) return;
      isSendingRef.current = true;
      const controller = new AbortController();
      abortRef.current = controller;
      const optimisticUser: Message = {
        id: `tmp_${Date.now()}`,
        conversationId: input.conversationId ?? "new",
        role: "user",
        blocks: [{ type: "text", text: input.text }],
        context: input.context,
        createdAt: new Date().toISOString(),
      };
      setStream({ conversationId: input.conversationId, input, userMessage: optimisticUser, assistantMessage: null, progress: [], status: "streaming" });
      clearContext();

      let convId = input.conversationId;
      try {
        let result: Awaited<ReturnType<typeof api.sendMessage>> | null = null;
        for await (const snapshot of api.streamMessage(input, (event) => {
          if (event.conversationId) convId = event.conversationId;
          setStream((prev) => prev
            ? {
                ...prev,
                conversationId: event.conversationId ?? prev.conversationId,
                progress: event.type === "conversation_started" ? prev.progress : [...prev.progress, event].slice(-16),
              }
            : prev);
        }, controller.signal)) {
          result = snapshot;
        }
        const finalResult = result;
        if (!finalResult) throw new Error("The assistant stream ended without a response.");
        convId = finalResult.conversation.id;
        setStream((prev) =>
          prev
            ? {
                ...prev,
                conversationId: convId,
                userMessage: finalResult.userMessage,
                assistantMessage: finalResult.assistantMessage,
              }
            : prev,
        );
        // Seed the cache *before* the URL moves. The replace re-renders this view
        // with the new conversation id, which subscribes a brand-new query key;
        // if that key is empty the loading boundary paints a skeleton over the
        // answer that just arrived. Writing the finished exchange here means the
        // first render of the new key already has both messages.
        if (convId && convId !== "new") seedConversation(qc, convId, finalResult);
        if (!input.conversationId && convId && convId !== "new") {
          router.replace(`/assistant/${convId}`);
        }
        // Refetch in the background for the server's canonical ordering; the
        // seeded data above is what the user sees while it lands.
        await qc.invalidateQueries({ queryKey: qk.conversation(convId ?? "new") });
        await qc.invalidateQueries({ queryKey: qk.conversations });
        setStream(null);
        abortRef.current = null;
      } catch (err) {
        const message = controller.signal.aborted
          ? "Request stopped."
          : err instanceof Error ? err.message : String(err);
        if (!input.conversationId && convId && convId !== "new") {
          router.replace(`/assistant/${convId}`);
        }
        setStream((prev) =>
          prev
            ? {
                ...prev,
                status: "error",
                error: message,
                assistantMessage: {
                  id: `err_${Date.now()}`,
                  conversationId: convId ?? "new",
                  role: "assistant",
                  blocks: [{ type: "error", message, retryable: true }],
                  context: [],
                  createdAt: new Date().toISOString(),
                },
              }
            : prev,
        );
        abortRef.current = null;
      } finally {
        isSendingRef.current = false;
      }
    },
    [clearContext, qc, router, setStream],
  );

  const retry = useCallback(() => {
    if (stream?.status === "error") void send(stream.input);
  }, [send, stream]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    query,
    messages,
    send,
    retry,
    stop,
    progress: streamBelongsHere ? stream?.progress ?? [] : [],
    isStreaming: streamBelongsHere && stream?.status === "streaming",
    streamError: streamBelongsHere && stream?.status === "error" ? stream.error : undefined,
  };
}
