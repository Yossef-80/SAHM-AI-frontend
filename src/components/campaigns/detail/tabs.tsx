"use client";

import Image from "next/image";
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
import { useAudience, useCampaignAdInsights, useCampaignLearnings, useCampaignPerformance, useCampaignRecommendations, useCreatives, useDismissRecommendation } from "@/hooks/use-api";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/lib/format";
import type { Campaign, CampaignMetrics, MetaAdInsight } from "@/types";
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
  // Prefer the creation-time snapshot so later library edits never rewrite campaign history.
  const snapshot = c.audienceSnapshot
    ? {
        id: c.audienceSnapshot.id,
        name: c.audienceSnapshot.name,
        description: c.audienceSnapshot.description,
        estimatedReach: c.audienceSnapshot.estimatedReach,
        ...c.audienceSnapshot.targeting,
      }
    : null;
  const q = useAudience(snapshot ? null : c.audienceId);
  const audience = snapshot ?? (c.audienceId ? q.data ?? null : null);
  return (
    <AsyncBoundary
      isLoading={!snapshot && Boolean(c.audienceId) && q.isLoading}
      isPending={!snapshot && Boolean(c.audienceId) && q.isPending}
      isError={!snapshot && q.isError}
      error={snapshot ? undefined : q.error}
      data={audience}
      onRetry={() => q.refetch()}
      emptyTitle={t("empty")}
    >
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

/* ---------------- Campaign daily trend ---------------- */

/**
 * Campaign-level daily performance from GET /campaigns/{id}/insights.
 *
 * A failure here must never take the whole Performance tab down with it: the
 * per-ad table below is a separate query and still worth showing, so errors
 * render nothing rather than propagating.
 */
function CampaignTrend({ campaign: c }: { campaign: Campaign }) {
  const t = useTranslations("campaigns.performance");
  const tm = useTranslations("metrics");
  const locale = useLocale();
  const q = useCampaignPerformance(c.id);

  if (q.isLoading) return <CardGridSkeleton />;
  if (q.isError) return null;

  const rows = q.data ?? [];
  const totals = rows.reduce(
    (acc, r) => ({
      impressions: acc.impressions + r.impressions,
      clicks: acc.clicks + r.clicks,
      spend: acc.spend + r.spend,
      conversions: acc.conversions + r.conversions,
    }),
    { impressions: 0, clicks: 0, spend: 0, conversions: 0 },
  );
  // Never divide by zero; a flat zero-spend series still renders as a baseline.
  const peak = Math.max(1, ...rows.map((r) => r.spend));

  const cards: Array<{ key: "impressions" | "clicks" | "spend" | "conversions"; money: boolean }> = [
    { key: "impressions", money: false },
    { key: "clicks", money: false },
    { key: "spend", money: true },
    { key: "conversions", money: false },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("trendTitle")}</CardTitle>
        {rows.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {t("trendRange", {
              start: rows[0].date,
              end: rows[rows.length - 1].date,
              days: rows.length,
            })}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("trendEmpty")}</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              {cards.map((m) => (
                <div key={m.key} className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">{tm(m.key)}</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {m.money
                      ? formatCurrency(totals[m.key], c.currency, locale)
                      : formatNumber(totals[m.key], locale)}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex h-32 items-end gap-1" role="img" aria-label={t("trendTitle")}>
              {rows.map((r) => (
                <div
                  key={r.date}
                  className="brand-gradient flex-1 rounded-t-sm"
                  style={{ height: `${Math.max(2, (r.spend / peak) * 100)}%` }}
                  title={`${r.date} — ${formatCurrency(r.spend, c.currency, locale)}`}
                />
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{rows[0].date}</span>
              <span>{t("trendMetric")}</span>
              <span>{rows[rows.length - 1].date}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function PerformanceTab({ campaign: c }: { campaign: Campaign }) {
  const t = useTranslations("campaigns.performance");
  const tm = useTranslations("metrics");
  const locale = useLocale();
  const q = useCampaignAdInsights(c.id);
  return (
    <div className="space-y-4">
      <CampaignTrend campaign={c} />
      <AsyncBoundary {...q} onRetry={() => q.refetch()} emptyTitle={t("empty")} emptyDescription={t("emptyDesc")}>
      {(data) => (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("adLevelTitle")}</CardTitle>
            <p className="text-xs text-muted-foreground">{data.dateStart} – {data.dateEnd}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.status !== "ok" && data.reason && (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">{data.reason}</p>
            )}
            {data.ads.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noAdRows")}</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("creative")}</TableHead>
                      <TableHead>{t("metaAdId")}</TableHead>
                      <TableHead className="text-end">{tm("impressions")}</TableHead>
                      <TableHead className="text-end">{tm("clicks")}</TableHead>
                      <TableHead className="text-end">CTR</TableHead>
                      <TableHead className="text-end">{tm("spend")}</TableHead>
                      <TableHead>{t("prompt")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.ads.map((ad: MetaAdInsight) => (
                      <TableRow key={`${ad.metaAdId}:${ad.dateStart}:${ad.dateEnd}`}>
                        <TableCell>
                          {ad.mapped && ad.imageUrl ? (
                            <Image
                              src={ad.imageUrl}
                              alt={ad.metaAdName || t("creative")}
                              width={64}
                              height={64}
                              unoptimized
                              className="h-16 w-16 rounded object-cover"
                            />
                          ) : (
                            <Badge variant="outline">{t("unmapped")}</Badge>
                          )}
                          {ad.mapped && ad.creativeId && <p className="mt-1 text-xs text-muted-foreground">{ad.creativeId}</p>}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{ad.metaAdId}<br />{ad.metaAdName}</TableCell>
                        <TableCell className="text-end tabular-nums">{formatNumber(ad.metrics.impressions ?? 0, locale)}</TableCell>
                        <TableCell className="text-end tabular-nums">{formatNumber(ad.metrics.clicks ?? 0, locale)}</TableCell>
                        <TableCell className="text-end tabular-nums">{ad.metrics.ctr === undefined ? "—" : formatPercent(ad.metrics.ctr, locale, 2)}</TableCell>
                        <TableCell className="text-end tabular-nums">{ad.metrics.spend === undefined ? "—" : formatCurrency(ad.metrics.spend, c.currency, locale)}</TableCell>
                        <TableCell className="max-w-xs">
                          {ad.mapped && ad.prompt ? (
                            <details>
                              <summary className="cursor-pointer text-sm">{t("viewPrompt")}</summary>
                              <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{ad.prompt}</p>
                            </details>
                          ) : <span className="text-xs text-muted-foreground">{t("noExactMatch")}</span>}
                          {ad.actions.length > 0 && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs">{t("metaActions")}</summary>
                              <pre className="mt-1 max-h-36 overflow-auto whitespace-pre-wrap text-xs" dir="ltr">{JSON.stringify(ad.actions, null, 2)}</pre>
                            </details>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      </AsyncBoundary>
    </div>
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
