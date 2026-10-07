"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { useUsage } from "@/hooks/use-api";
import type { UsageBreakdown, UsagePeriod } from "@/types";

const nf = new Intl.NumberFormat();

/**
 * `percentUsed` arrives unclamped on purpose — 140% has to be sayable — so the
 * meter is clamped for the bar geometry while the label prints the real number.
 */
function Meter({ percent, exceeded }: { percent: number; exceeded: boolean }) {
  const t = useTranslations("usage");
  const width = Math.min(100, Math.max(0, percent));
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-3xl font-semibold tracking-tight">{nf.format(Math.round(percent * 100) / 100)}%</span>
        {exceeded ? (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            {t("exceededBadge")}
          </Badge>
        ) : (
          percent >= 80 && <Badge variant="outline">{t("nearLimitBadge")}</Badge>
        )}
      </div>
      <Progress value={width} className={exceeded ? "[&>div]:bg-destructive" : undefined} />
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: UsageBreakdown[] }) {
  const t = useTranslations("usage");
  if (!rows.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("breakdownKey")}</TableHead>
              <TableHead className="text-end">{t("breakdownTokens")}</TableHead>
              <TableHead className="w-1/3">{t("breakdownShare")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell className="font-mono text-xs">{row.key}</TableCell>
                <TableCell className="text-end tabular-nums">{nf.format(row.tokens)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={Math.min(100, Math.max(0, row.share * 100))} className="h-1.5" />
                    <span className="w-12 shrink-0 text-end text-xs tabular-nums text-muted-foreground">
                      {t("percent", { value: Math.round(row.share * 1000) / 10 })}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function UsagePanel({ period }: { period: UsagePeriod }) {
  const t = useTranslations("usage");
  const query = useUsage(period);

  return (
    <AsyncBoundary
      isLoading={query.isLoading}
      isError={query.isError}
      error={query.error}
      data={query.data}
      isEmpty={() => false}
      onRetry={() => void query.refetch()}
      skeleton={<div className="h-72" />}
    >
      {(usage) => (
        <div className="space-y-4">
          {usage.exceeded && (
            <p role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t("exceededAlert", { period: t(period === "today" ? "today" : "month") })}</span>
            </p>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t(period === "today" ? "today" : "month")}</CardTitle>
              <CardDescription>
                {t("resetsAt", { at: usage.resetAt.slice(0, 16).replace("T", " ") })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Meter percent={usage.percentUsed} exceeded={usage.exceeded} />
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <Stat label={t("used")} value={nf.format(usage.totalTokens)} />
                <Stat label={t("budget")} value={nf.format(usage.budgetTokens)} />
                <Stat label={t("remaining")} value={nf.format(Math.max(0, usage.remainingTokens))} />
                <Stat label={t("calls")} value={nf.format(usage.calls)} />
                <Stat label={t("burnRate")} value={nf.format(Math.round(usage.burnRatePerHour))} />
                <Stat label={t("projected")} value={nf.format(usage.projectedTotalTokens)} />
                <Stat label={t("tokensIn")} value={nf.format(usage.tokensIn)} />
                <Stat label={t("tokensOut")} value={nf.format(usage.tokensOut)} />
              </dl>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {t("projectionNote")} · {t("budgetSource", { source: usage.budgetSource })}
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Breakdown title={t("byModel")} rows={usage.byModel} />
            <Breakdown title={t("byPersona")} rows={usage.byPersona} />
          </div>
        </div>
      )}
    </AsyncBoundary>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}

export function UsageView() {
  const t = useTranslations("usage");
  const [period, setPeriod] = useState<UsagePeriod>("today");

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex rounded-md border p-0.5">
            {(["today", "month"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`rounded px-3 py-1.5 text-sm transition-colors ${
                  period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                {t(p)}
              </button>
            ))}
          </div>
        }
      />
      <UsagePanel period={period} />
    </div>
  );
}
