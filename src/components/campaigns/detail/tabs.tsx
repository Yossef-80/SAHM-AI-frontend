"use client";

import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AsyncBoundary, CardGridSkeleton } from "@/components/shared/async-boundary";
import { ActionButton } from "@/components/shared/action-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { CreativeCard } from "@/components/creatives/creative-card";
import { HealthDot } from "@/components/campaigns/health-dot";
import { useAudience, useCampaignLearnings, useCampaignPerformance, useCampaignRecommendations, useCreatives, useDismissRecommendation } from "@/hooks/use-api";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/format";
import type { Campaign, CampaignMetrics } from "@/types";
import { StrategyView } from "./strategy-view";

/* ---------------- Overview ---------------- */

const METRIC_KEYS: (keyof CampaignMetrics)[] = ["impressions", "reach", "clicks", "ctr", "cpc", "cpm", "conversions", "cpa", "roas", "spend"];

export function OverviewTab({ campaign: c }: { campaign: Campaign }) {
  const t = useTranslations("campaigns.overview");
  const tm = useTranslations("metrics");
  const locale = useLocale();

  const fmt = (k: keyof CampaignMetrics, v: number) => {
    if (k === "ctr") return formatPercent(v, locale, 2);
    if (k === "roas") return `${v.toFixed(1)}×`;
    if (["cpc", "cpm", "cpa", "spend"].includes(k)) return formatCurrency(v, c.currency, locale);
    return formatNumber(v, locale);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <span>{t("period", { start: formatDate(c.startDate, locale), end: c.endDate ? formatDate(c.endDate, locale) : t("ongoing") })}</span>
        <span>
          {tm("health")}: <HealthDot score={c.healthScore} />
        </span>
        <span>{c.metaCampaignId ? `${t("metaId")}: ${c.metaCampaignId}` : t("notPublished")}</span>
      </div>
      <AsyncBoundary isLoading={false} isError={false} data={c.metrics} emptyTitle={t("noMetrics")} emptyDescription={t("noMetricsDesc")}>
        {(m) => (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {METRIC_KEYS.map((k) => (
              <Card key={k}>
                <CardContent className="p-4">
                  <p className="text-xs uppercase text-muted-foreground">{tm(k)}</p>
                  <p className="text-xl font-semibold tabular-nums">{fmt(k, m[k])}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </AsyncBoundary>
    </div>
  );
}

/* ---------------- Strategy ---------------- */

export function StrategyTab({ campaign: c }: { campaign: Campaign }) {
  const t = useTranslations("campaigns.strategy");
  return (
    <AsyncBoundary
      isLoading={false}
      isError={false}
      data={c.strategy}
      emptyTitle={t("empty")}
      emptyDescription={t("emptyDesc")}
      emptyAction={<ActionButton size="sm" action={{ type: "OPTIMIZE_CAMPAIGN", payload: { campaignId: c.id } }} />}
    >
      {(s) => (
        <Card>
          <CardContent className="p-6">
            <StrategyView strategy={s} />
          </CardContent>
        </Card>
      )}
    </AsyncBoundary>
  );
}

/* ---------------- Audience ---------------- */

export function AudienceTab({ campaign: c }: { campaign: Campaign }) {
  const t = useTranslations("campaigns.audience");
  const locale = useLocale();
  const q = useAudience(c.audienceId);
  return (
    <AsyncBoundary isLoading={q.isLoading} isError={q.isError} error={q.error} data={c.audienceId ? q.data : null} onRetry={() => q.refetch()} emptyTitle={t("empty")}>
      {(a) => (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{a.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <Item label={t("age")}>{`${a.ageMin}–${a.ageMax}`}</Item>
              <Item label={t("genders")}>{a.genders.join(", ")}</Item>
              <Item label={t("reach")}>{a.estimatedReach ? formatNumber(a.estimatedReach, locale) : "—"}</Item>
              <Item label={t("locations")}>
                <Chips items={a.locations} />
              </Item>
              <Item label={t("interests")}>
                <Chips items={a.interests} />
              </Item>
              <Item label={t("behaviors")}>
                <Chips items={a.behaviors} />
              </Item>
            </dl>
          </CardContent>
        </Card>
      )}
    </AsyncBoundary>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="mb-1 text-xs text-muted-foreground">{label}</dt>
      <dd className="capitalize">{children}</dd>
    </div>
  );
}
function Chips({ items }: { items: string[] }) {
  if (!items.length) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((i) => (
        <Badge key={i} variant="secondary">
          {i}
        </Badge>
      ))}
    </div>
  );
}

/* ---------------- Creatives ---------------- */

export function CreativesTab({ campaign: c }: { campaign: Campaign }) {
  const t = useTranslations("campaigns.creatives");
  const q = useCreatives(c.id);
  return (
    <AsyncBoundary
      {...q}
      onRetry={() => q.refetch()}
      skeleton={<CardGridSkeleton count={3} />}
      emptyTitle={t("empty")}
      emptyDescription={t("emptyDesc")}
      emptyAction={<ActionButton size="sm" action={{ type: "CREATE_CREATIVE", payload: { kind: "image", campaignId: c.id } }} />}
    >
      {(list) => (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {list.map((cr) => (
            <CreativeCard key={cr.id} creative={cr} showActions />
          ))}
        </div>
      )}
    </AsyncBoundary>
  );
}

/* ---------------- Performance ---------------- */

export function PerformanceTab({ campaign: c }: { campaign: Campaign }) {
  const t = useTranslations("campaigns.performance");
  const tm = useTranslations("metrics");
  const locale = useLocale();
  const q = useCampaignPerformance(c.id);
  return (
    <AsyncBoundary {...q} onRetry={() => q.refetch()} emptyTitle={t("empty")} emptyDescription={t("emptyDesc")}>
      {(points) => {
        const max = Math.max(...points.map((p) => p.clicks), 1);
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("last14")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Lightweight inline bar chart — no chart lib in scope for this pass */}
              <div className="flex h-32 items-end gap-1" role="img" aria-label={tm("clicks")}>
                {points.map((p) => (
                  <div key={p.date} className="flex-1 rounded-t bg-primary/70" style={{ height: `${(p.clicks / max) * 100}%` }} title={`${p.date}: ${p.clicks}`} />
                ))}
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("date")}</TableHead>
                      <TableHead className="text-end">{tm("impressions")}</TableHead>
                      <TableHead className="text-end">{tm("clicks")}</TableHead>
                      <TableHead className="text-end">{tm("conversions")}</TableHead>
                      <TableHead className="text-end">{tm("spend")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...points].reverse().map((p) => (
                      <TableRow key={p.date}>
                        <TableCell>{p.date}</TableCell>
                        <TableCell className="text-end tabular-nums">{formatNumber(p.impressions, locale)}</TableCell>
                        <TableCell className="text-end tabular-nums">{formatNumber(p.clicks, locale)}</TableCell>
                        <TableCell className="text-end tabular-nums">{p.conversions}</TableCell>
                        <TableCell className="text-end tabular-nums">{formatCurrency(p.spend, c.currency, locale)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      }}
    </AsyncBoundary>
  );
}

/* ---------------- Recommendations ---------------- */

export function RecommendationsTab({ campaign: c }: { campaign: Campaign }) {
  const t = useTranslations("campaigns.recommendations");
  const tb = useTranslations("blocks");
  const tc = useTranslations("common");
  const q = useCampaignRecommendations(c.id);
  const dismiss = useDismissRecommendation();
  return (
    <AsyncBoundary
      {...q}
      onRetry={() => q.refetch()}
      emptyTitle={t("empty")}
      emptyDescription={t("emptyDesc")}
      emptyAction={<ActionButton size="sm" action={{ type: "OPTIMIZE_CAMPAIGN", payload: { campaignId: c.id } }} />}
    >
      {(recs) => (
        <div className="grid gap-4 lg:grid-cols-2">
          {recs.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{r.title}</CardTitle>
                  <StatusBadge status={r.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">{r.rationale}</p>
                <p>
                  <span className="text-xs text-muted-foreground">{tb("expectedImpact")}: </span>
                  <span className="font-medium">{r.expectedImpact}</span>
                </p>
                <ul className="space-y-1">
                  {r.changes.map((ch) => (
                    <li key={ch.field} className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-muted-foreground">{ch.label}:</span>
                      <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-destructive line-through">{String(ch.before)}</span>
                      <span>→</span>
                      <span className="rounded bg-green-500/10 px-1.5 py-0.5 font-medium text-green-700 dark:text-green-400">{String(ch.after)}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-xs text-muted-foreground">{tc("confidence", { value: Math.round(r.confidence * 100) })}</span>
                  {r.status === "pending" && (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" disabled={dismiss.isPending} onClick={() => dismiss.mutate(r.id)}>
                        {t("dismiss")}
                      </Button>
                      <ActionButton size="sm" action={{ type: "APPLY_RECOMMENDATION", payload: { recommendationId: r.id } }} />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AsyncBoundary>
  );
}

/* ---------------- Learnings ---------------- */

export function LearningsTab({ campaign: c }: { campaign: Campaign }) {
  const t = useTranslations("campaigns.learnings");
  const tc = useTranslations("common");
  const locale = useLocale();
  const q = useCampaignLearnings(c.id);
  return (
    <AsyncBoundary {...q} onRetry={() => q.refetch()} emptyTitle={t("empty")} emptyDescription={t("emptyDesc")}>
      {(items) => (
        <ul className="space-y-3">
          {items.map((l) => (
            <li key={l.id} className="rounded-lg border p-4">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{t(`category.${l.category}`)}</Badge>
                <span className="text-xs text-muted-foreground">{tc("confidence", { value: Math.round(l.confidence * 100) })}</span>
                <span className="ms-auto text-xs text-muted-foreground">{formatDate(l.createdAt, locale)}</span>
              </div>
              <p className="font-medium">{l.statement}</p>
              <p className="text-sm text-muted-foreground">
                {t("evidence")}: {l.evidence}
              </p>
            </li>
          ))}
        </ul>
      )}
    </AsyncBoundary>
  );
}
