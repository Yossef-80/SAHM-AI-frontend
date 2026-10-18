"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Download,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Minus,
  Package,
  Palette,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Sun,
  Type,
  Wand2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ActionButton } from "@/components/shared/action-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { useGenerateCreative, useTask } from "@/hooks/use-api";
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
  type ImagePreviewBlock,
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

export function BlockRenderer({
  block,
  ctx,
  questionProps,
}: {
  block: AnyBlock;
  ctx: BlockContext;
  questionProps?: Partial<QuestionBlockProps>;
}) {
  const parsed = MessageBlockSchema.safeParse(block);
  if (!parsed.success) return <UnknownBlockView block={block} />;
  return <KnownBlock block={parsed.data} ctx={ctx} questionProps={questionProps} />;
}

function KnownBlock({
  block,
  ctx,
  questionProps,
}: {
  block: MessageBlock;
  ctx: BlockContext;
  questionProps?: Partial<QuestionBlockProps>;
}) {
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
      return <ActionCardBlockView block={block} ctx={ctx} />;
    case "task_progress":
      return <TaskProgressBlockView block={block} ctx={ctx} />;
    case "context_used":
      return <ContextUsedBlockView block={block} />;
    case "question_with_options":
      return <QuestionBlockView block={block} ctx={ctx} {...questionProps} />;
    case "error":
      return <ErrorBlockView block={block} ctx={ctx} />;
    case "image_preview":
      return <ImagePreviewBlockView block={block} />;
    default: {
      const _never: never = block;
      return <UnknownBlockView block={_never as AnyBlock} />;
    }
  }
}

/* ------------------------------------------------------------------ */
/* text — tiny inline markdown (bold / italic / code / links), streaming caret */
/* ------------------------------------------------------------------ */

export function unescapeUnicode(str: string): string {
  if (!str) return "";
  return str.replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => {
    try {
      return String.fromCharCode(parseInt(code, 16));
    } catch {
      return `\\u${code}`;
    }
  });
}

export function safeDecodeURI(uri: string): string {
  if (!uri) return "";
  try {
    return decodeURI(uri);
  } catch {
    try {
      return decodeURIComponent(uri);
    } catch {
      return uri;
    }
  }
}

export function renderInline(text: string): ReactNode[] {
  const cleanText = unescapeUnicode(text);
  const parts = cleanText.split(/(\[[^\]]+\]\((?:https?:\/\/[^\s)]+|\/[^\s)]*)\)|https?:\/\/[^\s<]+[^<.,:;"')\]\s]|\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    const link = p.match(/^\[([^\]]+)\]\(((?:https?:\/\/[^\s)]+|\/[^\s)]*))\)$/);
    if (link) {
      const [, label, href] = link;
      if (href.startsWith("/")) {
        return (
          <Link
            key={i}
            href={href}
            className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2 hover:opacity-85"
          >
            {label}
          </Link>
        );
      }
      return (
        <a key={i} href={href} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2 hover:opacity-85">
          {label}
        </a>
      );
    }
    const bareUrl = p.match(/^https?:\/\/[^\s]+$/);
    if (bareUrl) {
      return (
        <a key={i} href={p} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2 hover:opacity-85 break-all">
          {safeDecodeURI(p)}
        </a>
      );
    }
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

function cleanSerializedText(text: string): string {
  if (!text) return "";
  const trimmed = text.trim();
  if (
    (trimmed.startsWith("[{") && trimmed.endsWith("}]")) ||
    (trimmed.startsWith("{'") && trimmed.endsWith("'}") && trimmed.includes("'text':"))
  ) {
    const matches = Array.from(trimmed.matchAll(/['"]text['"]\s*:\s*['"]((?:\\.|[^'"])*)['"]/g));
    if (matches.length > 0) {
      return matches.map((m) => m[1].replace(/\\n/g, "\n").replace(/\\'/g, "'").replace(/\\"/g, '"')).join("\n");
    }
  }
  return text;
}

export function renderMarkdown(text: string): ReactNode[] {
  const cleaned = cleanSerializedText(text);
  const normalized = cleaned
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
  const locale = useLocale();
  const items = block.items || [];
  return (
    <Card className="bg-muted/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{block.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {items.map((it, i) => {
            const allEvidence = [
              ...(it.evidence || []),
              ...(it.source ? [{ title: "Source", url: it.source }] : []),
            ].filter((e): e is { title?: string; url?: string; snippet?: string; source?: string } => Boolean(e?.url || e?.title));

            const uniqueSources = allEvidence.filter(
              (ev, idx, arr) => (ev.url ? arr.findIndex((x) => x.url === ev.url) === idx : true)
            );

            return (
              <div key={i} className="rounded-lg border bg-card p-3 shadow-xs space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0">{sentimentIcon[it.sentiment]}</span>
                    <span className="font-semibold text-sm">{it.label || it.title}</span>
                  </div>
                  {it.confidence && (
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {typeof it.confidence === "number" ? `${Math.round(it.confidence * 100)}%` : String(it.confidence)}
                    </Badge>
                  )}
                </div>
                {it.detail && (
                  <div className="text-sm text-foreground/90 leading-relaxed">
                    {renderMarkdown(it.detail)}
                  </div>
                )}
                {uniqueSources.length > 0 && (
                  <div className="pt-2 border-t text-xs text-muted-foreground flex items-center justify-between">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>{locale === "ar" ? `المصادر (${uniqueSources.length})` : `Sources (${uniqueSources.length})`}</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" align="start" className="max-w-sm p-3 shadow-lg bg-popover text-popover-foreground">
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground border-b pb-1">
                            {locale === "ar" ? "المصادر والمراجع" : "Referenced Sources"}
                          </p>
                          <div className="space-y-1.5 max-h-56 overflow-y-auto">
                            {uniqueSources.map((s, sIdx) => (
                              <div key={sIdx} className="text-xs">
                                {s.url ? (
                                  <a
                                    href={s.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1 text-primary hover:underline font-medium break-all"
                                  >
                                    <ExternalLink className="h-3 w-3 shrink-0" />
                                    <span>{s.title || safeDecodeURI(s.url)}</span>
                                  </a>
                                ) : (
                                  <span className="text-foreground">{s.title}</span>
                                )}
                                {s.snippet && (
                                  <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{s.snippet}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
  const hasChanges = Array.isArray(rec.changes) && rec.changes.length > 0;
  const isActionableCampaignRec = rec.status === "pending" && rec.campaignId && rec.campaignId !== "cmp_general" && hasChanges;

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
        {rec.rationale && (
          <div>
            <p className="text-xs text-muted-foreground">{t("rationale")}</p>
            <p>{rec.rationale}</p>
          </div>
        )}
        {rec.expectedImpact && (
          <div>
            <p className="text-xs text-muted-foreground">{t("expectedImpact")}</p>
            <p className="font-medium">{rec.expectedImpact}</p>
          </div>
        )}
        {hasChanges && (
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
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{tc("confidence", { value: Math.round(rec.confidence * 100) })}</span>
          {isActionableCampaignRec && (
            <ActionButton size="sm" action={{ type: "APPLY_RECOMMENDATION", payload: { recommendationId: rec.id } }} />
          )}
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

interface ActionCardPrefill {
  dailyBudget?: number;
  currency?: string;
  durationDays?: number;
  objective?: string;
  audience?: {
    name?: string;
  };
}

export function ActionCardBlockView({ block, ctx }: { block: ActionCardBlock; ctx?: BlockContext }) {
  const createCampaignAction = block.actions.find((a) => a.type === "CREATE_CAMPAIGN");
  const prefill = (createCampaignAction?.payload as { prefill?: ActionCardPrefill } | undefined)?.prefill;

  return (
    <Card className="border-primary/25 bg-gradient-to-b from-primary/5 to-transparent shadow-xs">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {block.title}
          </CardTitle>
          {prefill && (
            <Badge variant="outline" className="text-[11px] border-primary/30 text-primary">
              جاهزة للإطلاق · 1-Click Ready
            </Badge>
          )}
        </div>
        {block.description && <p className="text-xs text-muted-foreground leading-relaxed mt-1">{block.description}</p>}
      </CardHeader>
      {prefill ? (
        <CardContent className="pt-0 pb-3">
          <div className="grid grid-cols-2 gap-2 rounded-md border bg-card/60 p-2.5 text-xs text-muted-foreground sm:grid-cols-4 mb-3">
            <div>
              <span className="block font-medium text-foreground">الميزانية اليومية</span>
              <span>{prefill.dailyBudget ? `${prefill.dailyBudget} ${prefill.currency || "EGP"}/يوم` : "محسوبة آلياً"}</span>
            </div>
            <div>
              <span className="block font-medium text-foreground">المدة المقترحة</span>
              <span>{prefill.durationDays ? `${prefill.durationDays} يوم` : "30 يوم"}</span>
            </div>
            <div>
              <span className="block font-medium text-foreground">الهدف الأساسي</span>
              <span className="capitalize">{prefill.objective || "مبيعات مباشرة"}</span>
            </div>
            <div>
              <span className="block font-medium text-foreground">الفئة المستهدفة</span>
              <span className="truncate block">{prefill.audience?.name || "جمهور مخصص"}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {block.actions.map((a, i) => (
              <ActionButton
                key={i}
                size="default"
                variant={i === 0 ? "default" : "outline"}
                action={{
                  ...a,
                  payload: {
                    ...a.payload,
                    ...(ctx?.conversationId ? { conversationId: ctx.conversationId } : {}),
                  },
                }}
                className={i === 0 ? "font-semibold shadow-xs" : ""}
              />
            ))}
          </div>
        </CardContent>
      ) : (
        <CardContent className="flex flex-wrap gap-2">
          {block.actions.map((a, i) => (
            <ActionButton
              key={i}
              size="sm"
              variant={i === 0 ? "default" : "outline"}
              action={{
                ...a,
                payload: {
                  ...a.payload,
                  ...(ctx?.conversationId ? { conversationId: ctx.conversationId } : {}),
                },
              }}
            />
          ))}
        </CardContent>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* task_progress — polls the task; refreshes the conversation on done  */
/* ------------------------------------------------------------------ */

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function firstText(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function resultItemText(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  const record = asRecord(value);
  if (!record) return undefined;
  const title = firstText(record, ["headline", "title", "name", "topic", "hook", "text", "primary_text"]);
  const detail = firstText(record, ["primary_text", "detail", "description", "rationale", "positioning", "visual_direction", "goal", "summary"]);
  const label = title && detail && title !== detail ? `${title}: ${detail}` : title ?? detail;
  if (label) return label;
  const fields = Object.entries(record)
    .filter(([, item]) => typeof item === "string" || typeof item === "number")
    .slice(0, 3)
    .map(([key, item]) => `${key.replace(/_/g, " ")}: ${String(item)}`);
  return fields.length ? fields.join(" · ") : undefined;
}

function variationText(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  const record = asRecord(value);
  if (!record) return undefined;
  const headline = firstText(record, ["headline", "title", "hook", "angle"]);
  const copy = firstText(record, ["primary_text", "text", "copy", "description"]);
  const cta = firstText(record, ["cta", "call_to_action"]);
  return [headline, copy, cta].filter(Boolean).join(" — ") || undefined;
}

const RESULT_ARRAY_LABELS: Record<string, string> = {
  assumptions: "Assumptions",
  audiences: "Audiences",
  channels: "Channels",
  common_patterns: "Common patterns",
  competitors: "Competitors",
  creatives_needed: "Creatives needed",
  ctas: "Calls to action",
  details: "Details",
  differentiation_opportunities: "Differentiation opportunities",
  evidence: "Evidence",
  findings: "Findings",
  gaps: "Market gaps",
  headlines: "Headlines",
  items: "Calendar items",
  key_messages: "Key messages",
  missing_inputs: "Missing inputs",
  opportunities: "Opportunities",
  offers: "Offers",
  phases: "Phases",
  primary_texts: "Primary text",
  pricing_observations: "Price observations",
  prompts: "Prompts",
  recommendations: "Recommendations",
  risks: "Risks",
  scenes: "Scenes",
  segments: "Audience segments",
  shots: "Shots",
  target_segments: "Target segments",
  themes: "Themes",
  unavailable_sources: "Unavailable sources",
  value_propositions: "Value propositions",
  variations: "Variations",
};

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
  const rawResult = task?.result;
  const output = asRecord(rawResult?.output) ?? rawResult ?? {};
  const resultSummary = firstText(output, ["summary", "report", "message", "recommendation", "concept", "primary_text"]);
  const variations = Array.isArray(output.variations)
    ? output.variations.map(variationText).filter((value): value is string => Boolean(value)).slice(0, 5)
    : [];
  const resultSections = Object.entries(output)
    .filter(([key, value]) => key !== "variations" && Boolean(RESULT_ARRAY_LABELS[key]) && Array.isArray(value) && value.length > 0)
    .map(([key, value]) => ({
      key,
      label: RESULT_ARRAY_LABELS[key],
      items: (value as unknown[]).map(resultItemText).filter((item): item is string => Boolean(item)).slice(0, 5),
    }))
    .filter((section) => section.items.length > 0)
    .slice(0, 8);
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
        {(resultSummary || variations.length > 0 || resultSections.length > 0) && (
          <section
            className="space-y-2 rounded-md border bg-background p-3"
            aria-label={task.status === "succeeded" ? t("result") : t("partialResult")}
          >
            <p className="text-xs font-semibold">
              {task.status === "succeeded" ? t("result") : t("partialResult")}
            </p>
            {resultSummary && <p className="whitespace-pre-wrap text-xs leading-relaxed">{resultSummary.slice(0, 1800)}</p>}
            {variations.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium">{t("variations")}</p>
                <ol className="list-decimal space-y-1 ps-5 text-xs">
                  {variations.map((variation, index) => <li key={index}>{variation.slice(0, 500)}</li>)}
                </ol>
              </div>
            )}
            {resultSections.map((section) => (
              <div key={section.key} className="space-y-1">
                <p className="text-xs font-medium">{section.label}</p>
                <ul className="list-disc space-y-1 ps-5 text-xs">
                  {section.items.map((item, index) => <li key={index}>{item.slice(0, 500)}</li>)}
                </ul>
              </div>
            ))}
          </section>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* question_with_options                                               */
/* ------------------------------------------------------------------ */

export interface QuestionBlockProps {
  block: QuestionWithOptionsBlock;
  ctx: BlockContext;
  controlledSelected?: string[];
  onControlledToggle?: (id: string) => void;
  hideSubmit?: boolean;
  questionNumber?: number;
  totalQuestions?: number;
  isParentSubmitted?: boolean;
}

export function QuestionBlockView({
  block,
  ctx,
  controlledSelected,
  onControlledToggle,
  hideSubmit,
  questionNumber,
  totalQuestions,
  isParentSubmitted,
}: QuestionBlockProps) {
  const t = useTranslations("blocks");
  const ta = useTranslations("assistant");
  const [internalSelected, setInternalSelected] = useState<string[]>(block.answeredOptionIds ?? []);
  const selected = controlledSelected !== undefined ? controlledSelected : internalSelected;
  const answered = !!block.answeredOptionIds?.length || !!isParentSubmitted;

  const isMulti = block.multiSelect !== false && block.multi_select !== false;

  const toggle = (id: string) => {
    if (answered) return;
    if (onControlledToggle) {
      onControlledToggle(id);
      return;
    }
    setInternalSelected((prev) =>
      isMulti
        ? prev.includes(id)
          ? prev.filter((x) => x !== id)
          : [...prev, id]
        : prev.includes(id)
          ? []
          : [id]
    );
  };

  const submit = () => {
    const labels = block.options.filter((o) => selected.includes(o.id)).map((o) => o.label);
    ctx.onAnswer?.(ctx.messageId, selected, labels.join(", "));
  };

  return (
    <Card className="transition-shadow hover:shadow-xs">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold leading-snug">{block.question}</CardTitle>
          {totalQuestions && totalQuestions > 1 && (
            <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground shrink-0">
              {questionNumber}/{totalQuestions}
            </span>
          )}
        </div>
        {isMulti && !answered && (
          <p className="text-[11px] text-muted-foreground">Select one or more options</p>
        )}
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
                  "flex items-start gap-2.5 rounded-md border p-3 text-start text-sm transition-colors disabled:cursor-default",
                  on ? "border-primary bg-primary/5 shadow-xs" : "hover:bg-accent/60",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border transition-colors",
                    isMulti ? "rounded" : "rounded-full",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                  )}
                >
                  {on && <Check className="h-3 w-3 stroke-[3]" />}
                </span>
                <span className="min-w-0">
                  <span className="font-medium text-foreground block">{o.label}</span>
                  {o.description && <span className="block text-xs text-muted-foreground mt-0.5">{o.description}</span>}
                </span>
              </button>
            );
          })}
        </div>
        {answered ? (
          <p className="text-xs text-muted-foreground">{ta("answered")}</p>
        ) : !hideSubmit ? (
          <Button size="sm" disabled={selected.length === 0 || ctx.isStreaming} onClick={submit}>
            {t("submit")}
          </Button>
        ) : null}
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
/* image preview                                                       */
/* ------------------------------------------------------------------ */

interface ParsedPromptStructure {
  scene?: string;
  palette: string[];
  objects: string[];
  lighting?: string;
  typography: string[];
}

function parsePromptStructure(prompt: string, isAr: boolean): ParsedPromptStructure {
  const result: ParsedPromptStructure = {
    palette: [],
    objects: [],
    typography: [],
  };

  if (!prompt || !prompt.trim()) return result;

  // 1. Quoted text / Typography
  const quoteRegex = /["“«]([^"”»]+)["”»]/g;
  let match;
  while ((match = quoteRegex.exec(prompt)) !== null) {
    const text = match[1].trim();
    if (text && !result.typography.includes(text)) {
      result.typography.push(text);
    }
  }

  // 2. Sentences
  const sentences = prompt
    .split(/[.،;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

  // 3. Color detection
  const colorKeywordsAr = [
    "أخضر", "أزرق", "رمادي", "أسود", "أبيض", "ذهبي", "بني", "أحمر", "أصفر",
    "ترابي", "سماوي", "نيلي", "كحلي", "وردي", "بنفسجي", "فضي", "بيج", "كريمي"
  ];
  const colorKeywordsEn = [
    "green", "blue", "gray", "grey", "black", "white", "gold", "brown", "red",
    "yellow", "earthy", "cyan", "navy", "pink", "purple", "silver", "beige", "cream"
  ];
  const activeColorKeywords = isAr ? colorKeywordsAr : colorKeywordsEn;

  // Hex codes
  const hexMatches = prompt.match(/#[0-9a-fA-F]{3,6}\b/g) || [];
  result.palette.push(...hexMatches);

  for (const cw of activeColorKeywords) {
    if (prompt.toLowerCase().includes(cw.toLowerCase())) {
      if (!result.palette.includes(cw)) {
        result.palette.push(cw);
      }
    }
  }

  // 4. Object detection
  const objectKeywordsAr = [
    "كيس قهوة", "كوب قهوة", "فنجان", "كيس", "كوب", "منتج", "علبة", "عبوة",
    "طاولة", "مقعد", "شعار", "سجل", "اسطوانة", "خلفية", "إعلان", "زجاجة"
  ];
  const objectKeywordsEn = [
    "coffee bag", "coffee cup", "cup", "bag", "product", "box", "package",
    "table", "stool", "chair", "logo", "record", "vinyl", "background", "bottle"
  ];
  const activeObjectKeywords = isAr ? objectKeywordsAr : objectKeywordsEn;
  for (const obj of activeObjectKeywords) {
    if (prompt.toLowerCase().includes(obj.toLowerCase())) {
      if (!result.objects.includes(obj)) {
        result.objects.push(obj);
      }
    }
  }

  // 5. Lighting / Composition sentence
  const lightingKeywords = isAr
    ? ["إضاءة", "ناعمة", "متساوية", "ساطعة", "تكوين", "متماثل", "مركزي", "متناسق"]
    : ["lighting", "soft", "even", "bright", "composition", "symmetrical", "centered", "balanced"];

  for (const sentence of sentences) {
    if (lightingKeywords.some((k) => sentence.toLowerCase().includes(k.toLowerCase()))) {
      result.lighting = sentence;
      break;
    }
  }

  // 6. Scene / Subject (first informative sentence)
  if (sentences.length > 0) {
    result.scene = sentences[0];
  }

  return result;
}

export function ImagePreviewBlockView({ block }: { block: ImagePreviewBlock }) {
  const t = useTranslations("assistant");
  const locale = useLocale();
  const isAr = locale === "ar";
  const [loadError, setLoadError] = useState(false);
  const [showPromptDetails, setShowPromptDetails] = useState(false);
  const [promptTab, setPromptTab] = useState<"breakdown" | "edit">("breakdown");
  const [editedPrompt, setEditedPrompt] = useState(block.prompt || "");
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);

  const generateMutation = useGenerateCreative();
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (!notifiedRef.current) {
      notifiedRef.current = true;
      toast.success(t("imageGeneratedSaved"));
    }
  }, [t]);

  const resolvedUrl = useMemo(() => {
    let url = currentUrl || block.url;
    if (url && (url.includes("api.example.com") || url.includes("example.com"))) {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api/v1";
      try {
        const parsedApi = new URL(apiBase);
        const parsedUrl = new URL(url);
        url = `${parsedApi.origin}${parsedUrl.pathname}${parsedUrl.search}`;
      } catch {
        // fallback
      }
    }
    return url;
  }, [currentUrl, block.url]);

  const structure = useMemo(
    () => parsePromptStructure(editedPrompt || block.prompt || "", isAr),
    [editedPrompt, block.prompt, isAr]
  );

  const handleDownload = () => {
    try {
      const a = document.createElement("a");
      a.href = resolvedUrl;
      a.download = `creative-draft-${Date.now()}.png`;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.open(resolvedUrl, "_blank");
    }
  };

  const handleRegenerate = async () => {
    if (!editedPrompt.trim() || generateMutation.isPending) return;
    try {
      const res = await generateMutation.mutateAsync({
        kind: "image",
        brief: editedPrompt,
        campaignId: null,
        count: 1,
      });
      if (res && res[0]?.assetUrl) {
        setCurrentUrl(res[0].assetUrl);
        setLoadError(false);
        toast.success(t("imageGeneratedSaved"));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to regenerate image");
    }
  };

  return (
    <Card className="overflow-hidden border bg-card/60 shadow-sm my-2">
      <CardHeader className="py-2.5 px-3 border-b flex flex-row items-center justify-between gap-2 space-y-0">
        <div className="flex items-center gap-2 min-w-0">
          <ImageIcon className="h-4 w-4 text-primary shrink-0" />
          <CardTitle className="text-sm font-semibold truncate">{block.title || t("imageDraftTitle")}</CardTitle>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {block.provider && (
            <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0">
              {block.provider}
            </Badge>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={() => window.open(resolvedUrl, "_blank")}
            title={t("openFullImage")}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("openFullImage")}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={handleDownload}
            title={t("downloadImage")}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3 space-y-2.5">
        <div className="relative group overflow-hidden rounded-md border bg-muted/40 flex items-center justify-center min-h-[180px] max-h-[440px]">
          {loadError ? (
            <div className="p-6 text-center text-xs text-muted-foreground space-y-2">
              <AlertCircle className="h-6 w-6 text-amber-500 mx-auto" />
              <p>{t("imagePreviewError")}</p>
              <Button size="sm" variant="outline" onClick={() => window.open(resolvedUrl, "_blank")}>
                <ExternalLink className="me-1 h-3.5 w-3.5" />
                {t("openLinkDirectly")}
              </Button>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolvedUrl}
              alt={block.alt || block.title || "Generated image"}
              className="max-h-[420px] w-auto max-w-full object-contain rounded transition-transform duration-200 group-hover:scale-[1.01]"
              loading="lazy"
              onError={() => setLoadError(true)}
            />
          )}
        </div>

        {/* Collapsible Prompt & Breakdown Tab Header */}
        {(block.prompt || editedPrompt) && (
          <div className="rounded-lg border bg-muted/20 overflow-hidden">
            <div className="flex items-center justify-between p-2 bg-muted/40 border-b">
              <button
                type="button"
                onClick={() => setShowPromptDetails(!showPromptDetails)}
                className="flex items-center gap-1.5 text-xs font-medium text-foreground hover:text-primary transition-colors"
              >
                <Wand2 className="h-3.5 w-3.5 text-primary" />
                <span>{t("viewEditPrompt")}</span>
                {showPromptDetails ? (
                  <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>

              {showPromptDetails && (
                <div className="flex items-center gap-1 bg-background/80 rounded-md p-0.5 border">
                  <button
                    type="button"
                    onClick={() => setPromptTab("breakdown")}
                    className={cn(
                      "px-2 py-0.5 rounded text-[11px] font-medium transition-colors",
                      promptTab === "breakdown"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t("promptBreakdown")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPromptTab("edit")}
                    className={cn(
                      "px-2 py-0.5 rounded text-[11px] font-medium transition-colors",
                      promptTab === "edit"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t("editPrompt")}
                  </button>
                </div>
              )}
            </div>

            {/* Prompt Tab Content */}
            {showPromptDetails ? (
              <div className="p-3">
                {promptTab === "breakdown" ? (
                  <div className="max-h-64 overflow-y-auto space-y-2.5 text-xs">
                    {/* Scene / Subject */}
                    {structure.scene && (
                      <div className="p-2 rounded-md border bg-background/60 space-y-1">
                        <div className="flex items-center gap-1.5 font-semibold text-foreground">
                          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                          <span>{t("promptSectionScene")}</span>
                        </div>
                        <p className="text-muted-foreground leading-relaxed ps-5">{structure.scene}</p>
                      </div>
                    )}

                    {/* Colors & Palette */}
                    {structure.palette.length > 0 && (
                      <div className="p-2 rounded-md border bg-background/60 space-y-1.5">
                        <div className="flex items-center gap-1.5 font-semibold text-foreground">
                          <Palette className="h-3.5 w-3.5 text-primary" />
                          <span>{t("promptSectionPalette")}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 ps-5">
                          {structure.palette.map((color, idx) => (
                            <Badge key={idx} variant="secondary" className="text-[11px] font-normal gap-1">
                              <span
                                className="h-2 w-2 rounded-full border border-border/50 shrink-0"
                                style={{ backgroundColor: color.startsWith("#") ? color : "currentColor" }}
                              />
                              {color}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Objects & Elements */}
                    {structure.objects.length > 0 && (
                      <div className="p-2 rounded-md border bg-background/60 space-y-1.5">
                        <div className="flex items-center gap-1.5 font-semibold text-foreground">
                          <Package className="h-3.5 w-3.5 text-emerald-500" />
                          <span>{t("promptSectionObjects")}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 ps-5">
                          {structure.objects.map((obj, idx) => (
                            <Badge key={idx} variant="outline" className="text-[11px] font-normal">
                              {obj}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Typography & Text */}
                    {structure.typography.length > 0 && (
                      <div className="p-2 rounded-md border bg-background/60 space-y-1.5">
                        <div className="flex items-center gap-1.5 font-semibold text-foreground">
                          <Type className="h-3.5 w-3.5 text-sky-500" />
                          <span>{t("promptSectionTypography")}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 ps-5">
                          {structure.typography.map((txt, idx) => (
                            <div key={idx} className="rounded bg-sky-500/10 text-sky-700 dark:text-sky-300 px-2 py-0.5 text-xs font-medium border border-sky-500/20">
                              «{txt}»
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Lighting & Composition */}
                    {structure.lighting && (
                      <div className="p-2 rounded-md border bg-background/60 space-y-1">
                        <div className="flex items-center gap-1.5 font-semibold text-foreground">
                          <Sun className="h-3.5 w-3.5 text-amber-500" />
                          <span>{t("promptSectionLighting")}</span>
                        </div>
                        <p className="text-muted-foreground leading-relaxed ps-5">{structure.lighting}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <Textarea
                      value={editedPrompt}
                      onChange={(e) => setEditedPrompt(e.target.value)}
                      placeholder={t("promptEditPlaceholder")}
                      rows={3}
                      className="text-xs resize-none min-h-[70px] leading-relaxed"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditedPrompt(block.prompt || "")}
                        disabled={editedPrompt === block.prompt || generateMutation.isPending}
                        className="h-7 text-xs gap-1"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>{t("reset", { defaultValue: "استعادة الأصل" })}</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!editedPrompt.trim() || generateMutation.isPending}
                        onClick={handleRegenerate}
                        className="h-7 text-xs gap-1.5"
                      >
                        {generateMutation.isPending ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>{t("regenerating")}</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>{t("regenerateImage")}</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-2 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                <span className="font-semibold text-foreground me-1">{t("promptLabel")}:</span>
                {editedPrompt || block.prompt}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* unknown → plain text                                                */
/* ------------------------------------------------------------------ */

export function UnknownBlockView({ block }: { block: AnyBlock }) {
  const t = useTranslations("assistant");
  const type = typeof block === "object" && block && "type" in block ? String((block as { type: unknown }).type) : "unknown";
  const rawObj = typeof block === "object" && block ? (block as Record<string, unknown>) : null;
  const text =
    rawObj && typeof rawObj.text === "string"
      ? rawObj.text
      : rawObj && typeof rawObj.title === "string"
        ? rawObj.title
        : null;
  const rationale = rawObj && typeof rawObj.rationale === "string" ? rawObj.rationale : null;

  return (
    <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
      {text ? (
        <div className="space-y-1">
          <p className="font-medium text-foreground">{text}</p>
          {rationale && <p className="text-xs text-muted-foreground">{rationale}</p>}
        </div>
      ) : (
        <span>{t("unknownBlock", { type })}</span>
      )}
    </div>
  );
}
