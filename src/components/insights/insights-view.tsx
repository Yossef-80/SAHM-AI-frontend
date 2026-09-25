"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDownRight, ArrowUpRight, Eye, Lightbulb, MessageSquare, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { ActionButton } from "@/components/shared/action-button";
import { SeverityBadge } from "@/components/shared/status-badge";
import { useCampaigns, useInsights } from "@/hooks/use-api";
import { useAssistantStore } from "@/store/assistant-store";
import { formatDate, formatDelta } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SeveritySchema, type ContextChip, type Insight, type Severity } from "@/types";

export function InsightsView() {
  const t = useTranslations("insights");
  const tc = useTranslations("common");
  const ts = useTranslations("severity");
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [campaignId, setCampaignId] = useState("all");
  const q = useInsights({ severity: severity === "all" ? undefined : severity, campaignId: campaignId === "all" ? undefined : campaignId });
  const campaigns = useCampaigns();

  return (
    <div>
      <PageHeader title={t("title")} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Select value={severity} onValueChange={(v) => setSeverity(v as Severity | "all")}>
          <SelectTrigger className="sm:w-40" aria-label={t("filterSeverity")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tc("all")}</SelectItem>
            {SeveritySchema.options.map((s) => (
              <SelectItem key={s} value={s}>
                {ts(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={campaignId} onValueChange={setCampaignId}>
          <SelectTrigger className="sm:w-60" aria-label={t("campaign")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tc("all")}</SelectItem>
            {(campaigns.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <AsyncBoundary {...q} onRetry={() => q.refetch()} emptyTitle={t("empty")} emptyDescription={t("emptyDesc")}>
        {(items) => (
          <div className="grid gap-4 lg:grid-cols-2">
            {items.map((i) => (
              <InsightCard key={i.id} insight={i} campaignName={campaigns.data?.find((c) => c.id === i.campaignId)?.name} />
            ))}
          </div>
        )}
      </AsyncBoundary>
    </div>
  );
}

function InsightCard({ insight: i, campaignName }: { insight: Insight; campaignName?: string }) {
  const t = useTranslations("insights");
  const locale = useLocale();
  const router = useRouter();
  const addContext = useAssistantStore((s) => s.addContext);
  const setPendingPrompt = useAssistantStore((s) => s.setPendingPrompt);

  const ask = () => {
    const ctx: ContextChip[] = [{ kind: "insight", id: i.id, label: i.title }];
    if (i.campaignId && campaignName) ctx.push({ kind: "campaign", id: i.campaignId, label: campaignName });
    ctx.forEach(addContext);
    setPendingPrompt({ text: `${i.title} — ${i.recommendedAction}`, context: ctx });
    router.push("/assistant");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={i.severity} />
              {campaignName && i.campaignId && (
                <Link href={`/campaigns/${i.campaignId}`} className="text-xs text-muted-foreground hover:underline">
                  {campaignName}
                </Link>
              )}
            </div>
            <CardTitle className="text-base">{i.title}</CardTitle>
          </div>
          {i.metric && (
            <div className="text-end">
              <p className="text-lg font-semibold tabular-nums">
                {i.metric.value}
                {i.metric.unit ? ` ${i.metric.unit}` : ""}
              </p>
              {i.metric.delta !== undefined && (
                <p className={cn("flex items-center justify-end gap-0.5 text-xs tabular-nums", i.metric.delta > 0 ? "text-destructive" : "text-green-600")}>
                  {i.metric.delta > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {formatDelta(i.metric.delta, locale)}
                </p>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Step icon={Eye} label={t("observation")}>
          {i.observation}
        </Step>
        <Step icon={Lightbulb} label={t("explanation")}>
          {i.explanation}
        </Step>
        <Step icon={Wrench} label={t("recommendedAction")}>
          {i.recommendedAction}
        </Step>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <span className="text-xs text-muted-foreground">{formatDate(i.createdAt, locale)}</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={ask}>
              <MessageSquare className="me-2 h-4 w-4" />
              {t("askAbout")}
            </Button>
            {i.action && <ActionButton size="sm" action={i.action} />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Step({ icon: Icon, label, children }: { icon: typeof Eye; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </span>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p>{children}</p>
      </div>
    </div>
  );
}
