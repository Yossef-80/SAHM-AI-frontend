"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { History, Images, Loader2, Sparkles } from "lucide-react";
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
  const locale = useLocale() as "en" | "ar";
  const { query, messages, send, retry, stop, progress, isStreaming } = useChat(conversationId);
  const context = useAssistantStore((s) => s.context);
  const pendingPrompt = useAssistantStore((s) => s.pendingPrompt);
  const setPendingPrompt = useAssistantStore((s) => s.setPendingPrompt);
  const stream = useAssistantStore((s) => s.stream);
  const personaId = useAssistantStore((s) => s.personaId);
  const setPersonaId = useAssistantStore((s) => s.setPersonaId);
  const agents = useAgents();
  const [historyOpen, setHistoryOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  /**
   * Answers generated during this visit animate in; answers restored from the
   * server do not. The id is captured while it is still in the live stream, and
   * the set survives `setStream(null)` so the animation is not cut short when
   * the finished turn is swapped for the cached copy.
   */
  const liveIds = useRef<Set<string>>(new Set());
  // Recorded during render, not in an effect: an effect runs after the first
  // paint, so the bubble would render complete, then flip back to empty and
  // animate — a flash, which is the thing this whole change exists to remove.
  // Adding to a ref here is idempotent and has no render-visible side effect
  // beyond the `reveal` flag computed below.
  if (stream?.assistantMessage?.id) liveIds.current.add(stream.assistantMessage.id);

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
        language: locale,
        personaId: p.personaId,
        workflow: p.workflow,
        promptType: p.promptType,
        creativeMode: p.creativeMode,
        referenceAnalysisId: p.referenceAnalysisId,
      });
    }
  }, [pendingPrompt, conversationId, isStreaming, send, setPendingPrompt, setPersonaId, locale]);

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
    language: locale,
  };
  const onSend = (text: string) => send({ conversationId, text, context, ...workflowFields });
  const onAnswer = (messageId: string, optionIds: string[], label: string) =>
    send({ conversationId, text: label, context: [], answer: { messageId, optionIds }, ...workflowFields });

  const list = (
    <div className="flex flex-col gap-6">
      {messages.map((m) => (
        <MessageBubble
          key={m.id}
          message={m}
          reveal={liveIds.current.has(m.id)}
          ctx={{ conversationId: conversationId ?? "new", onAnswer, onRetry: retry, isStreaming }}
        />
      ))}
      {isStreaming && messages[messages.length - 1]?.role === "user" && (
        <div role="status" aria-live="polite" className="max-w-xl rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" /> {progress.length ? t("progressTitle") : t("thinking")}
          </div>
          {progress.length > 0 && (
            <ol className="mt-2 space-y-1 border-s-2 ps-3 text-xs">
              {progress
                .filter((event, index, arr) => {
                  if (index === 0) return true;
                  const prev = arr[index - 1];
                  return !(prev.type === event.type && prev.step === event.step);
                })
                .slice(-6)
                .map((event, index) => {
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
        <header className="flex items-center justify-between border-b px-4 py-2">
          <h1 className="text-sm font-semibold">{t("title")}</h1>
          <div className="flex items-center gap-2">
            {/* The return leg of the creative flow. Chat can interview the user
                and generate a creative, but the record it writes (`media.py`
                creates a `Creative` row) lived only on another page with no way
                to get there from the conversation that produced it. Shown only
                in design mode, which is the mode that generates media. */}
            {creativeMode === "design" ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/creatives">
                  <Images className="me-2 h-4 w-4" />
                  {t("openCreatives")}
                </Link>
                </Button>
              ) : null}
              <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
                <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="lg:hidden">
                  <History className="me-2 h-4 w-4" />
                  {t("history")}
                </Button>
              </SheetTrigger>
              <SheetContent side="start" className="w-80 p-0">
                <SheetTitle className="sr-only">{t("history")}</SheetTitle>
                <ConversationList activeId={conversationId} onNavigate={() => setHistoryOpen(false)} />
              </SheetContent>
            </Sheet>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto flex min-h-full max-w-3xl flex-col">
            {/* Anything already on screen wins over the query's loading state.
                The boundary used to gate on `isLoading` first, so the moment the
                URL switched to the new conversation the list — including the
                answer that had just arrived — was replaced by a skeleton until
                the cache refilled. Now the boundary is only reachable when there
                is nothing to show yet. */}
            {messages.length > 0 ? (
              list
            ) : conversationId ? (
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
            ) : (
              empty
            )}
          </div>
        </div>
        <div className="border-t bg-background p-3 md:p-4">
          <div className="mx-auto max-w-3xl">
            <Composer
              onSend={onSend}
              onStop={stop}
              disabled={!!isStreaming}
              mode={creativeMode}
              onModeChange={setCreativeMode}
              /*
               * "Who you are talking to" sits *beside* the request-type choices,
               * inside the composer row — not in its own band above the composer,
               * where it pushed the chips and the text box down for a single
               * rarely-changed control.
               */
              toolbar={
                <>
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
                </>
              }
            />
          </div>
        </div>
      </section>
    </div>
  );
}
