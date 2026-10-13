"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { History, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { useChat } from "@/hooks/use-chat";
import { useAgents } from "@/hooks/use-api";
import { AUTO_PERSONA, useAssistantStore } from "@/store/assistant-store";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Composer, type CreativeMode } from "./composer";
import { ConversationList } from "./conversation-list";
import { MessageBubble } from "./message-bubble";

const SUGGESTIONS = ["cpa", "competitors", "creative", "campaign"] as const;

export function AssistantView({ conversationId }: { conversationId: string | null }) {
  const t = useTranslations("assistant");
  const { query, messages, send, retry, stop, progress, isStreaming } = useChat(conversationId);
  const context = useAssistantStore((s) => s.context);
  const pendingPrompt = useAssistantStore((s) => s.pendingPrompt);
  const setPendingPrompt = useAssistantStore((s) => s.setPendingPrompt);
  const personaId = useAssistantStore((s) => s.personaId);
  const setPersonaId = useAssistantStore((s) => s.setPersonaId);
  const agents = useAgents();
  const [historyOpen, setHistoryOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-send a prompt queued from another page (Home hero, Agents → Chat,
  // Creatives → Write with AI).
  useEffect(() => {
    if (pendingPrompt && conversationId === null && !isStreaming) {
      const p = pendingPrompt;
      setPendingPrompt(null);
      // Keep the composer on the agent the queued prompt asked for, so the rest
      // of the conversation stays with them instead of drifting back to
      // automatic routing.
      if (p.personaId) setPersonaId(p.personaId);
      void send({
        conversationId: null,
        text: p.text,
        context: p.context,
        personaId: p.personaId,
        workflow: p.workflow,
        promptType: p.promptType,
        creativeMode: p.creativeMode,
        referenceAnalysisId: p.referenceAnalysisId,
      });
    }
  }, [pendingPrompt, conversationId, isStreaming, send, setPendingPrompt, setPersonaId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const savedContext = query.data?.conversation.context;
  // An explicit picker choice wins; otherwise follow what the conversation
  // already recorded. This is what keeps a Layla interview with Layla.
  // AUTO_PERSONA is a real choice, so it must not fall through to the saved one.
  const effectivePersonaId = personaId ?? savedContext?.personaId ?? null;
  // Sticky with the conversation, same rule as the picker above: choosing
  // "design" once must not silently revert on the next turn.
  const [creativeModeChoice, setCreativeMode] = useState<CreativeMode | null>(null);
  const creativeMode: CreativeMode =
    creativeModeChoice ?? savedContext?.creativeMode ?? "chat";
  const workflowFields = {
    personaId: effectivePersonaId ?? undefined,
    workflow: savedContext?.workflow ?? undefined,
    promptType: savedContext?.promptType ?? undefined,
    referenceAnalysisId: savedContext?.referenceAnalysisId ?? undefined,
    // An explicit picker choice wins, same rule as the persona picker above.
    creativeMode,
  };
  const onSend = (text: string) => send({ conversationId, text, context, ...workflowFields });
  const onAnswer = (messageId: string, optionIds: string[], label: string) =>
    send({ conversationId, text: label, context: [], answer: { messageId, optionIds }, ...workflowFields });

  const list = (
    <div className="flex flex-col gap-6">
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} ctx={{ conversationId: conversationId ?? "new", onAnswer, onRetry: retry, isStreaming }} />
      ))}
      {isStreaming && messages[messages.length - 1]?.role === "user" && (
        <div role="status" aria-live="polite" className="max-w-xl rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" /> {progress.length ? t("progressTitle") : t("thinking")}
          </div>
          {progress.length > 0 && (
            <ol className="mt-2 space-y-1 border-s-2 ps-3 text-xs">
              {progress.slice(-6).map((event, index) => {
                const tool = event.step === "web_search"
                  ? t("progressTools.webSearch")
                  : event.step === "analyze_website"
                    ? t("progressTools.website")
                    : event.step?.replaceAll("_", " ") ?? "";
                const label = event.type === "tool_called"
                  ? t("progressToolStarted", { tool })
                  : event.type === "tool_result"
                    ? t("progressToolDone", { tool })
                    : event.type === "failed"
                      ? t("progressStepFailed", { step: tool || t("progressStep") })
                      : event.type === "step_started"
                        ? t("progressStep", { step: tool || t("progressStep") })
                        : t("progressStarted");
                return <li key={`${event.type}-${event.step ?? "start"}-${index}`}>{label}</li>;
              })}
            </ol>
          )}
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
                isPending={query.isPending}
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
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t("talkingTo")}</span>
              <Select
                value={effectivePersonaId ?? AUTO_PERSONA}
                onValueChange={setPersonaId}
              >
                <SelectTrigger className="h-8 w-auto min-w-40 gap-1 text-xs" aria-label={t("talkingTo")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUTO_PERSONA}>{t("agentAuto")}</SelectItem>
                  {(agents.data ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="me-1.5" aria-hidden>{a.emoji}</span>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Composer
              onSend={onSend}
              onStop={stop}
              disabled={!!isStreaming}
              mode={creativeMode}
              onModeChange={setCreativeMode}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
