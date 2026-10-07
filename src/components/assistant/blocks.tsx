"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowDownRight, ArrowUpRight, Check, CheckCircle2, Circle, Loader2, Minus, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ActionButton } from "@/components/shared/action-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { useTask } from "@/hooks/use-api";
import { qk } from "@/lib/query-keys";
import { formatDelta, formatMetric } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  MessageBlockSchema,
  type ActionCardBlock,
  type AnyBlock,
  type ContextUsedBlock,
  type ErrorBlock,
  type FindingsBlock,
  type MessageBlock,
  type MetricBlock,
  type QuestionWithOptionsBlock,
  type RecommendationBlock,
  type TaskProgressBlock,
  type TextBlock,
} from "./block-types";

export interface BlockContext {
  messageId: string;
  conversationId: string;
  onAnswer?: (messageId: string, optionIds: string[], label: string) => void;
  onRetry?: () => void;
  isStreaming?: boolean;
}

/* ------------------------------------------------------------------ */
/* Renderer entry: validates the block, dispatches to a component,     */
/* degrades unknown types to plain text.                               */
/* ------------------------------------------------------------------ */

export function BlockRenderer({ block, ctx }: { block: AnyBlock; ctx: BlockContext }) {
  const parsed = MessageBlockSchema.safeParse(block);
  if (!parsed.success) return <UnknownBlockView block={block} />;
  return <KnownBlock block={parsed.data} ctx={ctx} />;
}

function KnownBlock({ block, ctx }: { block: MessageBlock; ctx: BlockContext }) {
  switch (block.type) {
    case "text":
      return <TextBlockView block={block} />;
    case "findings":
      return <FindingsBlockView block={block} />;
    case "recommendation":
      return <RecommendationBlockView block={block} />;
    case "metric":
      return <MetricBlockView block={block} />;
    case "action_card":
      return <ActionCardBlockView block={block} />;
    case "task_progress":
      return <TaskProgressBlockView block={block} ctx={ctx} />;
    case "context_used":
      return <ContextUsedBlockView block={block} />;
    case "question_with_options":
      return <QuestionBlockView block={block} ctx={ctx} />;
    case "error":
      return <ErrorBlockView block={block} ctx={ctx} />;
    default: {
      const _never: never = block;
      return <UnknownBlockView block={_never as AnyBlock} />;
    }
  }
}

/* ------------------------------------------------------------------ */
/* text — tiny inline markdown (bold / italic / code), streaming caret */
/* ------------------------------------------------------------------ */

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    const link = p.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (link) return <a key={i} href={link[2]} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">{link[1]}</a>;
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("*") && p.endsWith("*")) return <em key={i}>{p.slice(1, -1)}</em>;
    if (p.startsWith("`") && p.endsWith("`"))
      return (
        <code key={i} className="rounded bg-muted px-1 py-0.5 text-[0.85em]">
          {p.slice(1, -1)}
        </code>
      );
    return <span key={i}>{p}</span>;
  });
}

function tableCells(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

function isTableDivider(line: string): boolean {
  const cells = tableCells(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")));
}

function renderMarkdown(text: string): ReactNode[] {
  const normalized = text
    .replace(/\\?<br\s*\/?\s*>/gi, "\n")
    .replace(/\\\|/g, "|")
    .replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  const nodes: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }
    if (/^(---+|___+|\*\*\*+)$/.test(line)) {
      nodes.push(<hr key={`hr-${i}`} className="my-3 border-border" />);
      i++;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const depth = heading[1].length;
      const Heading = (`h${Math.min(depth, 4)}`) as "h1" | "h2" | "h3" | "h4";
      nodes.push(<Heading key={`h-${i}`} className="mt-3 text-base font-semibold first:mt-0">{renderInline(heading[2])}</Heading>);
      i++;
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      const headers = tableCells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes("|")) rows.push(tableCells(lines[i++]));
      nodes.push(
        <div key={`table-${i}`} className="my-2 max-w-full overflow-x-auto rounded-md border">
          <table className="w-full min-w-max border-collapse text-start text-xs">
            <thead className="bg-muted/70"><tr>{headers.map((cell, index) => <th key={index} className="border-b px-3 py-2 text-start font-semibold">{renderInline(cell)}</th>)}</tr></thead>
            <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex} className="odd:bg-background even:bg-muted/30">{headers.map((_, cellIndex) => <td key={cellIndex} className="max-w-sm whitespace-normal border-b px-3 py-2 align-top">{renderInline(row[cellIndex] ?? "")}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }

    const unordered = line.match(/^[-*+•·]\s+(.+)$/);
    const ordered = line.match(/^\d+(?:[.)]|(?:\uFE0F)?\u20E3)\s+(.+)$/);
    if (unordered || ordered) {
      const isOrdered = !!ordered;
      const items: string[] = [];
      while (i < lines.length) {
        const match = lines[i].trim().match(isOrdered ? /^\d+(?:[.)]|(?:\uFE0F)?\u20E3)\s+(.+)$/ : /^[-*+•·]\s+(.+)$/);
        if (!match) break;
        items.push(match[1]);
        i++;
      }
      const List = isOrdered ? "ol" : "ul";
      nodes.push(<List key={`list-${i}`} className={cn("my-1 space-y-1 ps-5 text-sm", isOrdered ? "list-decimal" : "list-disc")}>{items.map((item, index) => <li key={index}>{renderInline(item)}</li>)}</List>);
      continue;
    }

    if (line.startsWith(">")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) quote.push(lines[i++].trim().replace(/^>\s?/, ""));
      nodes.push(<blockquote key={`quote-${i}`} className="border-s-2 ps-3 text-sm italic text-muted-foreground">{quote.map((part, index) => <span key={index}>{index > 0 && <br />}{renderInline(part)}</span>)}</blockquote>);
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|[-*+•·]\s|\d+(?:[.)]|(?:\uFE0F)?\u20E3)\s|>\s?)/.test(lines[i].trim()) && !(lines[i].includes("|") && i + 1 < lines.length && isTableDivider(lines[i + 1]))) {
      paragraph.push(lines[i++].trim());
    }
    nodes.push(<p key={`p-${i}`} className="text-sm leading-relaxed">{paragraph.map((part, index) => <span key={index}>{index > 0 && <br />}{renderInline(part)}</span>)}</p>);
  }
  return nodes;
}

/* ------------------------------------------------------------------ */
/* context_used — brand memory the backend consulted                  */
/* ------------------------------------------------------------------ */

function ContextUsedBlockView({ block }: { block: ContextUsedBlock }) {
  const t = useTranslations("assistant");
  const [open, setOpen] = useState(false);
  if (block.items.length === 0) return null;
  return (
    <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 text-start">
        <span className="font-medium">
          {t("contextUsed", { count: block.items.length })}
        </span>
        {block.tokenEstimate > 0 && <span>~{block.tokenEstimate} tokens</span>}
        {block.truncated && <span className="text-amber-600">{t("contextTruncated")}</span>}
        <span className="ms-auto">{open ? "-" : "+"}</span>
      </button>
      {open && (
        <ul className="mt-2 space-y-1">
          {block.items.map((item, i) => (
            <li key={item.memoryId ?? `${item.kind}-${i}`} className="flex flex-col">
              <span className="font-medium text-foreground">{item.label}</span>
              {item.detail && <span>{item.detail}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TextBlockView({ block }: { block: TextBlock }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {renderMarkdown(block.text)}
      {block.streaming && <span className="ms-0.5 inline-block h-4 w-1.5 animate-pulse bg-foreground/70 align-text-bottom" aria-hidden />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* findings                                                            */
/* ------------------------------------------------------------------ */

const sentimentIcon = {
  positive: <ArrowUpRight className="h-4 w-4 text-green-600" />,
  negative: <ArrowDownRight className="h-4 w-4 text-destructive" />,
  neutral: <Minus className="h-4 w-4 text-muted-foreground" />,
};

export function FindingsBlockView({ block }: { block: FindingsBlock }) {
  return (
    <Card className="bg-muted/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{block.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {block.items.map((it, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span className="mt-0.5 shrink-0">{sentimentIcon[it.sentiment]}</span>
              <div className="min-w-0">
                <div className="font-medium">{it.label}</div>
                {it.detail && <div className="mt-1 space-y-1 text-muted-foreground">{renderMarkdown(it.detail)}</div>}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* recommendation                                                      */
/* ------------------------------------------------------------------ */

export function RecommendationBlockView({ block }: { block: RecommendationBlock }) {
  const t = useTranslations("blocks");
  const tc = useTranslations("common");
  const rec = block.recommendation;
  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-primary">{t("recommendation")}</p>
            <CardTitle className="text-sm">{rec.title}</CardTitle>
          </div>
          <StatusBadge status={rec.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">{t("rationale")}</p>
          <p>{rec.rationale}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("expectedImpact")}</p>
          <p className="font-medium">{rec.expectedImpact}</p>
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">{t("changes")}</p>
          <ul className="space-y-1">
            {rec.changes.map((c) => (
              <li key={c.field} className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">{c.label}:</span>
                <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-destructive line-through">{String(c.before)}</span>
                <span>→</span>
                <span className="rounded bg-green-500/10 px-1.5 py-0.5 font-medium text-green-700 dark:text-green-400">{String(c.after)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{tc("confidence", { value: Math.round(rec.confidence * 100) })}</span>
          {rec.status === "pending" && <ActionButton size="sm" action={{ type: "APPLY_RECOMMENDATION", payload: { recommendationId: rec.id } }} />}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* metric                                                              */
/* ------------------------------------------------------------------ */

export function MetricBlockView({ block }: { block: MetricBlock }) {
  const locale = useLocale();
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {block.metrics.map((m, i) => (
        <div key={i} className="rounded-md border bg-card p-3">
          <p className="text-xs text-muted-foreground">{m.label}</p>
          <p className="text-lg font-semibold tabular-nums">{formatMetric(m.value, m.format, locale, m.unit)}</p>
          {m.delta !== undefined && (
            <p className={cn("text-xs tabular-nums", m.delta > 0 ? "text-green-600" : m.delta < 0 ? "text-destructive" : "text-muted-foreground")}>{formatDelta(m.delta, locale)}</p>
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* action_card                                                         */
/* ------------------------------------------------------------------ */

export function ActionCardBlockView({ block }: { block: ActionCardBlock }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{block.title}</CardTitle>
        {block.description && <p className="text-xs text-muted-foreground">{block.description}</p>}
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {block.actions.map((a, i) => (
          <ActionButton key={i} size="sm" variant={i === 0 ? "default" : "outline"} action={a} />
        ))}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* task_progress — polls the task; refreshes the conversation on done  */
/* ------------------------------------------------------------------ */

const stepIcon = {
  queued: <Circle className="h-3.5 w-3.5 text-muted-foreground" />,
  running: <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />,
  succeeded: <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />,
  failed: <XCircle className="h-3.5 w-3.5 text-destructive" />,
};

export function TaskProgressBlockView({ block, ctx }: { block: TaskProgressBlock; ctx: BlockContext }) {
  const t = useTranslations("blocks");
  const qc = useQueryClient();
  const snapshotDone = block.task && (block.task.status === "succeeded" || block.task.status === "failed");
  const q = useTask(block.taskId, !snapshotDone);
  const task = q.data ?? block.task;
  const [refreshed, setRefreshed] = useState(false);

  useEffect(() => {
    if (!refreshed && q.data && (q.data.status === "succeeded" || q.data.status === "failed") && !snapshotDone) {
      setRefreshed(true);
      void qc.invalidateQueries({ queryKey: qk.conversation(ctx.conversationId) });
      void qc.invalidateQueries({ queryKey: qk.conversations });
    }
  }, [q.data, refreshed, snapshotDone, qc, ctx.conversationId]);

  if (!task) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("task")}
      </div>
    );
  }

  return (
    <Card className="bg-muted/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm capitalize">{task.label}</CardTitle>
          <StatusBadge status={task.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={task.progress} className="h-1.5" />
        <ul className="space-y-1.5">
          {task.steps.map((s, i) => (
            <li key={i} className={cn("flex items-center gap-2 text-xs", s.status === "queued" && "text-muted-foreground")}>
              {stepIcon[s.status]}
              {s.label}
            </li>
          ))}
        </ul>
        {task.error && <p className="text-xs text-destructive">{task.error}</p>}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* question_with_options                                               */
/* ------------------------------------------------------------------ */

export function QuestionBlockView({ block, ctx }: { block: QuestionWithOptionsBlock; ctx: BlockContext }) {
  const t = useTranslations("blocks");
  const ta = useTranslations("assistant");
  const [selected, setSelected] = useState<string[]>(block.answeredOptionIds ?? []);
  const answered = !!block.answeredOptionIds?.length;

  const toggle = (id: string) => {
    if (answered) return;
    setSelected((prev) => (block.multiSelect ? (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]) : [id]));
  };

  const submit = () => {
    const labels = block.options.filter((o) => selected.includes(o.id)).map((o) => o.label);
    ctx.onAnswer?.(ctx.messageId, selected, labels.join(", "));
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{block.question}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          {block.options.map((o) => {
            const on = selected.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                disabled={answered}
                onClick={() => toggle(o.id)}
                aria-pressed={on}
                className={cn(
                  "flex items-start gap-2 rounded-md border p-3 text-start text-sm transition-colors disabled:cursor-default",
                  on ? "border-primary bg-primary/5" : "hover:bg-accent",
                )}
              >
                <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", on && "border-primary bg-primary text-primary-foreground")}>
                  {on && <Check className="h-3 w-3" />}
                </span>
                <span>
                  <span className="font-medium">{o.label}</span>
                  {o.description && <span className="block text-xs text-muted-foreground">{o.description}</span>}
                </span>
              </button>
            );
          })}
        </div>
        {answered ? (
          <p className="text-xs text-muted-foreground">{ta("answered")}</p>
        ) : (
          <Button size="sm" disabled={selected.length === 0 || ctx.isStreaming} onClick={submit}>
            {t("submit")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* error                                                               */
/* ------------------------------------------------------------------ */

export function ErrorBlockView({ block, ctx }: { block: ErrorBlock; ctx: BlockContext }) {
  const t = useTranslations("assistant");
  return (
    <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <div className="flex-1">
        <p>{block.message}</p>
        {block.retryable && ctx.onRetry && (
          <Button variant="outline" size="sm" className="mt-2" onClick={ctx.onRetry}>
            <RefreshCw className="me-2 h-3.5 w-3.5" />
            {t("retryMessage")}
          </Button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* unknown → plain text                                                */
/* ------------------------------------------------------------------ */

export function UnknownBlockView({ block }: { block: AnyBlock }) {
  const t = useTranslations("assistant");
  const type = typeof block === "object" && block && "type" in block ? String((block as { type: unknown }).type) : "unknown";
  const text =
    typeof block === "object" && block && "text" in block && typeof (block as { text: unknown }).text === "string"
      ? (block as { text: string }).text
      : typeof block === "object" && block && "title" in block && typeof (block as { title: unknown }).title === "string"
        ? (block as { title: string }).title
        : null;
  return (
    <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
      {text ?? t("unknownBlock", { type })}
      {text && <span className="ms-2 text-xs">({t("unknownBlock", { type })})</span>}
    </div>
  );
}
