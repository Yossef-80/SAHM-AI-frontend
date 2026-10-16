"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { sortMessagesChronologically } from "@/lib/api/adapters";
import { qk } from "@/lib/query-keys";
import { useAssistantStore } from "@/store/assistant-store";
import type { Message, SendMessageInput } from "@/types";

/** Shape of one conversation page held in the react-query cache. */
type ConversationPage = {
  conversation: { id: string } & Record<string, unknown>;
  messages: Message[];
};
import { CONVERSATION_PAGE_SIZE, useConversation } from "./use-api";

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
        if (!input.conversationId && convId && convId !== "new") {
          router.replace(`/assistant/${convId}`);
        }
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

  // History is paged newest-first now, so a long thread needs a way back.
  // The cursor is the oldest message currently held; the fetched page is
  // prepended to the same cache entry the view already renders.
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const loadingOlderRef = useRef(false);
  const loadOlder = useCallback(async () => {
    if (!conversationId || loadingOlderRef.current) return;
    const current = qc.getQueryData<ConversationPage>(qk.conversation(conversationId));
    const oldest = current?.messages?.[0];
    if (!oldest) return;
    loadingOlderRef.current = true;
    setIsLoadingOlder(true);
    try {
      const page = await api.getConversation(conversationId, {
        before: oldest.id,
        limit: CONVERSATION_PAGE_SIZE,
      });
      qc.setQueryData(qk.conversation(conversationId), {
        conversation: current?.conversation ?? page.conversation,
        messages: [...page.messages, ...(current?.messages ?? [])],
      });
    } catch {
      // A failed page load must not lose what is already on screen.
    } finally {
      loadingOlderRef.current = false;
      setIsLoadingOlder(false);
    }
  }, [conversationId, qc]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // Leaving the chat (or switching conversation) used to leave the SSE request
  // open: the browser kept the connection, the store kept receiving snapshots
  // for a view that no longer exists, and the query cache kept being
  // invalidated. Aborting on unmount closes both halves of that.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  return {
    query,
    messages,
    send,
    loadOlder,
    hasOlder: (query.data?.messages?.length ?? 0) >= CONVERSATION_PAGE_SIZE,
    isLoadingOlder,
    retry,
    stop,
    progress: streamBelongsHere ? stream?.progress ?? [] : [],
    isStreaming: streamBelongsHere && stream?.status === "streaming",
    streamError: streamBelongsHere && stream?.status === "error" ? stream.error : undefined,
  };
}
