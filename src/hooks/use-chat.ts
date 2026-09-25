"use client";

import { useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { useAssistantStore } from "@/store/assistant-store";
import type { Message, SendMessageInput } from "@/types";
import { useConversation } from "./use-api";

/**
 * Chat state for one conversation: cached messages + the in-flight streamed exchange.
 * Streaming is consumed from `api.streamMessage` (chunked mock today, SSE later).
 */
export function useChat(conversationId: string | null) {
  const router = useRouter();
  const qc = useQueryClient();
  const query = useConversation(conversationId);
  const stream = useAssistantStore((s) => s.stream);
  const setStream = useAssistantStore((s) => s.setStream);
  const clearContext = useAssistantStore((s) => s.clearContext);
  const abortRef = useRef(false);

  const streamBelongsHere = !!stream && (stream.conversationId === conversationId || (stream.conversationId === null && conversationId === null));

  const messages = useMemo<Message[]>(() => {
    const base = query.data?.messages ?? [];
    if (!stream || !streamBelongsHere || stream.status === "done") return base;
    const ids = new Set(base.map((m) => m.id));
    const extra = [stream.userMessage, stream.assistantMessage].filter((m): m is Message => !!m && !ids.has(m.id));
    return [...base, ...extra];
  }, [query.data, stream, streamBelongsHere]);

  const send = useCallback(
    async (input: SendMessageInput) => {
      abortRef.current = false;
      const optimisticUser: Message = {
        id: `tmp_${Date.now()}`,
        conversationId: input.conversationId ?? "new",
        role: "user",
        blocks: [{ type: "text", text: input.text }],
        context: input.context,
        createdAt: new Date().toISOString(),
      };
      setStream({ conversationId: input.conversationId, input, userMessage: optimisticUser, assistantMessage: null, status: "streaming" });
      clearContext();

      let convId = input.conversationId;
      try {
        for await (const chunk of api.streamMessage(input)) {
          if (abortRef.current) break;
          if (!convId) {
            convId = chunk.conversation.id;
            // Move the URL to the new conversation; stream state is in the store so nothing is lost.
            router.replace(`/assistant/${convId}`);
          }
          setStream((prev) =>
            prev ? { ...prev, conversationId: chunk.conversation.id, userMessage: chunk.userMessage, assistantMessage: chunk.assistantMessage } : prev,
          );
        }
        if (convId) {
          await qc.invalidateQueries({ queryKey: qk.conversation(convId) });
          await qc.invalidateQueries({ queryKey: qk.conversations });
        }
        setStream((prev) => (prev ? { ...prev, status: "done" } : prev));
        setStream(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
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
      }
    },
    [clearContext, qc, router, setStream],
  );

  const retry = useCallback(() => {
    if (stream?.status === "error") void send(stream.input);
  }, [send, stream]);

  const stop = useCallback(() => {
    abortRef.current = true;
  }, []);

  return {
    query,
    messages,
    send,
    retry,
    stop,
    isStreaming: streamBelongsHere && stream?.status === "streaming",
    streamError: streamBelongsHere && stream?.status === "error" ? stream.error : undefined,
  };
}
