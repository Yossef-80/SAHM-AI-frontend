"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { History, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { useChat } from "@/hooks/use-chat";
import { useAssistantStore } from "@/store/assistant-store";
import { Composer } from "./composer";
import { ConversationList } from "./conversation-list";
import { MessageBubble } from "./message-bubble";

const SUGGESTIONS = ["cpa", "competitors", "creative", "campaign"] as const;

export function AssistantView({ conversationId }: { conversationId: string | null }) {
  const t = useTranslations("assistant");
  const { query, messages, send, retry, stop, isStreaming } = useChat(conversationId);
  const context = useAssistantStore((s) => s.context);
  const pendingPrompt = useAssistantStore((s) => s.pendingPrompt);
  const setPendingPrompt = useAssistantStore((s) => s.setPendingPrompt);
  const [historyOpen, setHistoryOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-send a prompt queued from another page (Home hero).
  useEffect(() => {
    if (pendingPrompt && conversationId === null && !isStreaming) {
      const p = pendingPrompt;
      setPendingPrompt(null);
      void send({ conversationId: null, text: p.text, context: p.context });
    }
  }, [pendingPrompt, conversationId, isStreaming, send, setPendingPrompt]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const onSend = (text: string) => send({ conversationId, text, context });
  const onAnswer = (messageId: string, optionIds: string[], label: string) =>
    send({ conversationId, text: label, context: [], answer: { messageId, optionIds } });

  const list = (
    <div className="flex flex-col gap-6">
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} ctx={{ conversationId: conversationId ?? "new", onAnswer, onRetry: retry, isStreaming }} />
      ))}
      {isStreaming && messages[messages.length - 1]?.role === "user" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 animate-pulse text-primary" /> {t("thinking")}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );

  const empty = (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-6 w-6" />
      </div>
      <div>
        <h2 className="text-lg font-semibold">{t("emptyTitle")}</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{t("emptyDesc")}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <Button key={s} variant="outline" size="sm" onClick={() => onSend(t(`suggestions.${s}`))}>
            {t(`suggestions.${s}`)}
          </Button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="-m-4 flex h-[calc(100vh-3.5rem-5rem)] md:-m-8 md:h-screen">
      <aside className="hidden w-72 shrink-0 border-e bg-card lg:block">
        <ConversationList activeId={conversationId} />
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b px-4 py-2 lg:hidden">
          <h1 className="text-sm font-semibold">{t("title")}</h1>
          <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm">
                <History className="me-2 h-4 w-4" />
                {t("history")}
              </Button>
            </SheetTrigger>
            <SheetContent side="start" className="w-80 p-0">
              <SheetTitle className="sr-only">{t("history")}</SheetTitle>
              <ConversationList activeId={conversationId} onNavigate={() => setHistoryOpen(false)} />
            </SheetContent>
          </Sheet>
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto flex min-h-full max-w-3xl flex-col">
            {conversationId ? (
              <AsyncBoundary
                isLoading={query.isLoading}
                isError={query.isError}
                error={query.error}
                data={messages}
                isEmpty={() => false}
                onRetry={() => query.refetch()}
                skeleton={
                  <div className="space-y-4">
                    <Skeleton className="h-16 w-2/3" />
                    <Skeleton className="ms-auto h-10 w-1/2" />
                    <Skeleton className="h-40 w-3/4" />
                  </div>
                }
              >
                {() => list}
              </AsyncBoundary>
            ) : messages.length === 0 ? (
              empty
            ) : (
              list
            )}
          </div>
        </div>
        <div className="border-t bg-background p-3 md:p-4">
          <div className="mx-auto max-w-3xl">
            <Composer onSend={onSend} onStop={stop} disabled={!!isStreaming} />
          </div>
        </div>
      </section>
    </div>
  );
}
