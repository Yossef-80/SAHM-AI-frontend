"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Pause, Play, Rocket, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { ActionButton } from "@/components/shared/action-button";
import { StatusBadge } from "@/components/shared/status-badge";
import { useAction } from "@/hooks/use-action";
import { useCampaign } from "@/hooks/use-api";
import { useUiStore } from "@/store/ui-store";
import { formatCurrency } from "@/lib/format";
import type { Campaign } from "@/types";
import { OverviewTab, StrategyTab, AudienceTab, CreativesTab, PerformanceTab, RecommendationsTab, LearningsTab } from "./tabs";

const TABS = ["overview", "strategy", "audience", "creatives", "performance", "recommendations", "learnings"] as const;

export function CampaignDetail({ id }: { id: string }) {
  const t = useTranslations("campaigns");
  const to = useTranslations("objective");
  const locale = useLocale();
  const router = useRouter();
  const q = useCampaign(id);

  return (
    <AsyncBoundary
      {...q}
      onRetry={() => q.refetch()}
      emptyTitle={t("notFound")}
      emptyAction={<Button variant="outline" onClick={() => router.push("/campaigns")}>{t("title")}</Button>}
      skeleton={
        <div className="space-y-4">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      {(c) => (
        <div>
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
                <StatusBadge status={c.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {to(c.objective)} · {formatCurrency(c.dailyBudget, c.currency, locale)}
                {t("perDay")}
              </p>
            </div>
            <HeaderActions campaign={c} />
          </div>

          <Tabs defaultValue="overview">
            <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start">
              {TABS.map((tab) => (
                <TabsTrigger key={tab} value={tab}>
                  {t(`tabs.${tab}`)}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="overview">
              <OverviewTab campaign={c} />
            </TabsContent>
            <TabsContent value="strategy">
              <StrategyTab campaign={c} />
            </TabsContent>
            <TabsContent value="audience">
              <AudienceTab campaign={c} />
            </TabsContent>
            <TabsContent value="creatives">
              <CreativesTab campaign={c} />
            </TabsContent>
            <TabsContent value="performance">
              <PerformanceTab campaign={c} />
            </TabsContent>
            <TabsContent value="recommendations">
              <RecommendationsTab campaign={c} />
            </TabsContent>
            <TabsContent value="learnings">
              <LearningsTab campaign={c} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </AsyncBoundary>
  );
}

/**
 * State-aware header.
 *
 * A draft has no Meta campaign behind it, so pausing or resuming it would be
 * meaningless — its next step is to be planned and published in the wizard, and
 * the wizard takes the campaign's details through `campaignPrefill`. Only once a
 * campaign exists on Meta do pause / resume / edit budget apply.
 */
function HeaderActions({ campaign: c }: { campaign: Campaign }) {
  const t = useTranslations("campaigns");
  const tc = useTranslations("common");
  const router = useRouter();
  const setPrefill = useUiStore((s) => s.setCampaignPrefill);
  const { dispatch, isPending } = useAction();
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budget, setBudget] = useState(String(c.dailyBudget));
  const live = c.status === "active" || c.status === "paused";

  /** Hand the draft's shape to the wizard, which reads it on mount. */
  const continueOnMeta = () => {
    setPrefill({
      name: c.name,
      objective: c.objective,
      dailyBudget: c.dailyBudget,
      currency: c.currency,
      startDate: c.startDate,
      endDate: c.endDate,
      creativeIds: c.creativeIds,
    });
    router.push("/campaigns/new");
  };

  return (
    <div className="flex flex-wrap gap-2">
      <ActionButton variant="outline" size="sm" action={{ type: "ANALYZE_CAMPAIGN", payload: { campaignId: c.id } }} />
      <ActionButton variant="outline" size="sm" action={{ type: "OPTIMIZE_CAMPAIGN", payload: { campaignId: c.id } }} />
      {!live && (
        <Button size="sm" onClick={continueOnMeta} title={t("continueOnMetaHint")}>
          <Rocket className="me-2 h-4 w-4" />
          {t("continueOnMeta")}
        </Button>
      )}
      {live && (
        <>
          <Button variant="outline" size="sm" disabled={isPending} onClick={() => setBudgetOpen(true)}>
            <Wallet className="me-2 h-4 w-4" />
            {t("editBudget")}
          </Button>
          <Button
            size="sm"
            variant={c.status === "active" ? "secondary" : "default"}
            disabled={isPending}
            onClick={() => dispatch({ type: "UPDATE_CAMPAIGN", payload: { campaignId: c.id, patch: { status: c.status === "active" ? "paused" : "active" } } })}
          >
            {c.status === "active" ? <Pause className="me-2 h-4 w-4" /> : <Play className="me-2 h-4 w-4" />}
            {c.status === "active" ? t("pause") : t("resume")}
          </Button>
        </>
      )}
      <Dialog open={budgetOpen} onOpenChange={setBudgetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editBudget")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="newBudget">
              {t("newBudget")} ({c.currency})
            </Label>
            <Input id="newBudget" type="number" min={1} value={budget} onChange={(e) => setBudget(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBudgetOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              disabled={!(Number(budget) > 0) || isPending}
              onClick={async () => {
                setBudgetOpen(false);
                await dispatch({ type: "UPDATE_CAMPAIGN", payload: { campaignId: c.id, patch: { dailyBudget: Number(budget) } } });
              }}
            >
              {tc("next")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
