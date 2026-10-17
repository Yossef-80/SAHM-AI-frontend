"use client";

import { useTranslations } from "next-intl";
import {
  Activity,
  AlertTriangle,
  Check,
  FileText,
  Radar,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared/page-header";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import {
  useObservability,
  useSubscription,
  useSubscriptionPlans,
  useSwitchPlan,
} from "@/hooks/use-api";
import type { ObservabilityStatus, SubscriptionPlan, WorkspaceSubscription } from "@/types";

const nf = new Intl.NumberFormat();

/**
 * The plan meter.
 *
 * `percent` arrives **unclamped** — switching to the free tier while today's
 * usage is 400 000 tokens has to be sayable — so the bar geometry is clamped
 * while the label prints the real number. Same rule as `usage-view.tsx`.
 */
function PlanMeter({ percent, exceeded }: { percent: number; exceeded: boolean }) {
  const t = useTranslations("plan");
  const width = Math.min(100, Math.max(0, percent));
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-3xl font-semibold tracking-tight" data-testid="plan-percent">
          {nf.format(Math.round(percent * 100) / 100)}%
        </span>
        {exceeded ? (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            {t("exceeded")}
          </Badge>
        ) : (
          percent >= 80 && <Badge variant="outline">{t("nearLimit")}</Badge>
        )}
      </div>
      <Progress value={width} className={exceeded ? "[&>div]:bg-destructive" : undefined} />
    </div>
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

function CurrentPlan({ subscription }: { subscription: WorkspaceSubscription }) {
  const t = useTranslations("plan");
  const plan = subscription.currentPlan;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">{t("currentTitle")}</CardTitle>
          <CardDescription>{plan.description}</CardDescription>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <Badge>{plan.name}</Badge>
          {plan.isFree && <Badge variant="outline">{t("freeBadge")}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <PlanMeter percent={subscription.percentConsumed} exceeded={subscription.isBudgetExceeded} />
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={t("used")} value={nf.format(subscription.tokensUsedToday)} />
          <Stat label={t("budget")} value={nf.format(subscription.dailyTokenBudget)} />
          <Stat
            label={t("remaining")}
            value={nf.format(Math.max(0, subscription.dailyTokenBudget - subscription.tokensUsedToday))}
          />
          <Stat label={t("workspaces")} value={nf.format(plan.maxWorkspaces)} />
        </dl>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {t("meterNote")} · {t("resetsAt")}
        </p>
      </CardContent>
    </Card>
  );
}

function PlanCard({
  plan,
  current,
  onSwitch,
  isSwitching,
}: {
  plan: SubscriptionPlan;
  current: boolean;
  onSwitch: (plan: SubscriptionPlan) => void;
  isSwitching: boolean;
}) {
  const t = useTranslations("plan");

  return (
    <Card className={current ? "border-primary shadow-sm" : undefined}>
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{plan.name}</CardTitle>
          {current ? <Badge>{t("currentBadge")}</Badge> : null}
        </div>
        <CardDescription>{plan.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex h-full flex-col gap-4">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold tabular-nums">{nf.format(plan.dailyTokenBudget)}</span>
          <span className="text-xs text-muted-foreground">{t("dailyTokens")}</span>
        </div>

        <ul className="space-y-1.5 text-sm">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
              <span className="text-muted-foreground">{feature}</span>
            </li>
          ))}
        </ul>

        <div className="mt-auto space-y-2">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {t("models")}: {plan.supportedModels.join(" · ")}
          </p>
          <Button
            type="button"
            variant={current ? "outline" : "default"}
            className="w-full"
            disabled={current || isSwitching}
            onClick={() => onSwitch(plan)}
          >
            {current ? t("currentPlanCta") : isSwitching ? t("switching") : t("switchTo", { name: plan.name })}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PlansSection({ currentPlanId }: { currentPlanId: SubscriptionPlan["id"] }) {
  const t = useTranslations("plan");
  const plans = useSubscriptionPlans();
  const switchPlan = useSwitchPlan();

  const onSwitch = (plan: SubscriptionPlan) => {
    switchPlan.mutate(plan.id, {
      onSuccess: (result) => {
        toast.success(t("switchedTitle"), {
          description: t("switched", {
            name: result.newPlan.name,
            budget: nf.format(result.updatedDailyBudget),
          }),
        });
      },
      onError: (error) => {
        toast.error(t("switchFailed"), {
          description: error instanceof Error ? error.message : String(error),
        });
      },
    });
  };

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">{t("plansTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("plansDesc")}</p>
      </div>
      <AsyncBoundary
        isLoading={plans.isLoading}
        isPending={plans.isPending}
        isError={plans.isError}
        error={plans.error}
        data={plans.data}
        isEmpty={(rows) => rows.length === 0}
        onRetry={() => void plans.refetch()}
        skeleton={<div className="h-64" />}
      >
        {(rows) => (
          <div className="grid gap-4 lg:grid-cols-3">
            {rows.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                current={plan.id === currentPlanId}
                onSwitch={onSwitch}
                isSwitching={switchPlan.isPending && switchPlan.variables === plan.id}
              />
            ))}
          </div>
        )}
      </AsyncBoundary>
    </section>
  );
}

/* ------------------------------------------------------------------ observability */

function StatusBadge({ enabled }: { enabled: boolean }) {
  const t = useTranslations("plan");
  return enabled ? (
    <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-600">
      <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
      {t("obsOn")}
    </Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      {t("obsOff")}
    </Badge>
  );
}

function PathRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b py-1.5 last:border-b-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-mono text-[11px]" dir="ltr" title={value}>
        {value || "—"}
      </dd>
    </div>
  );
}

/** The exact lines to paste; rendered as selectable text, never auto-copied. */
function EnvHint({ lines }: { lines: string[] }) {
  const t = useTranslations("plan");
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] leading-relaxed text-muted-foreground">{t("enableHint")}</p>
      <pre
        dir="ltr"
        className="overflow-x-auto rounded-md border bg-muted/40 p-2 text-[11px] leading-relaxed"
      >
        {lines.join("\n")}
      </pre>
    </div>
  );
}

function ObservabilitySection() {
  const t = useTranslations("plan");
  const query = useObservability();

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">{t("obsTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("obsDesc")}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
        >
          <RefreshCw className={`me-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />
          {t("refresh")}
        </Button>
      </div>

      <AsyncBoundary
        isLoading={query.isLoading}
        isPending={query.isPending}
        isError={query.isError}
        error={query.error}
        data={query.data}
        isEmpty={() => false}
        onRetry={() => void query.refetch()}
        skeleton={<div className="h-48" />}
      >
        {(status: ObservabilityStatus) => (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <div>
                    <CardTitle className="text-sm">{t("localTitle")}</CardTitle>
                    <CardDescription className="text-xs">{t("localDesc")}</CardDescription>
                  </div>
                </div>
                <StatusBadge enabled={status.localLogging.status === "active"} />
              </CardHeader>
              <CardContent>
                <dl>
                  <PathRow label={t("llmLog")} value={status.localLogging.llmLog} />
                  <PathRow label={t("agentLogs")} value={status.localLogging.agentLogs} />
                  <PathRow label={t("diagnosticLog")} value={status.localLogging.diagnosticLog} />
                </dl>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {t("levelFormat", {
                    level: status.localLogging.logLevel.toUpperCase(),
                    format: status.localLogging.format.toUpperCase(),
                  })}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
                <div className="flex items-center gap-2">
                  <Radar className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <div>
                    <CardTitle className="text-sm">{t("langsmithTitle")}</CardTitle>
                    <CardDescription className="text-xs">{t("langsmithDesc")}</CardDescription>
                  </div>
                </div>
                <StatusBadge enabled={status.langsmith.enabled} />
              </CardHeader>
              <CardContent className="space-y-3">
                <dl>
                  <PathRow label={t("project")} value={status.langsmith.project} />
                  <PathRow label={t("endpoint")} value={status.langsmith.endpoint} />
                </dl>
                {!status.langsmith.enabled && (
                  <EnvHint
                    lines={[
                      "LANGCHAIN_TRACING_V2=true",
                      "LANGCHAIN_API_KEY=lsv2_pt_...",
                      `LANGCHAIN_PROJECT=${status.langsmith.project || "sahm-ai"}`,
                    ]}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <div>
                    <CardTitle className="text-sm">{t("langfuseTitle")}</CardTitle>
                    <CardDescription className="text-xs">{t("langfuseDesc")}</CardDescription>
                  </div>
                </div>
                <StatusBadge enabled={status.langfuse.enabled} />
              </CardHeader>
              <CardContent className="space-y-3">
                <dl>
                  <PathRow label={t("host")} value={status.langfuse.host} />
                  <PathRow
                    label={status.langfuse.publicKeyConfigured ? t("keyConfigured") : t("keyMissing")}
                    value={status.langfuse.publicKeyPreview ?? "—"}
                  />
                </dl>
                {!status.langfuse.enabled && (
                  <EnvHint
                    lines={[
                      "LANGFUSE_PUBLIC_KEY=pk-lf-...",
                      "LANGFUSE_SECRET_KEY=sk-lf-...",
                      `LANGFUSE_HOST=${status.langfuse.host || "https://cloud.langfuse.com"}`,
                    ]}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <div>
                    <CardTitle className="text-sm">{t("costTitle")}</CardTitle>
                    <CardDescription className="text-xs">{t("costDesc")}</CardDescription>
                  </div>
                </div>
                <StatusBadge enabled={status.costEstimator.status === "active"} />
              </CardHeader>
              <CardContent className="space-y-1 text-xs text-muted-foreground">
                <p>{t("pricedModels", { count: status.costEstimator.supportedModelsCount })}</p>
                <p>{t("freeModels", { models: status.costEstimator.freeModels.join(", ") })}</p>
              </CardContent>
            </Card>
          </div>
        )}
      </AsyncBoundary>
    </section>
  );
}

/* ------------------------------------------------------------------ page */

export function PlanView() {
  const t = useTranslations("plan");
  const subscription = useSubscription();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      <AsyncBoundary
        isLoading={subscription.isLoading}
        isPending={subscription.isPending}
        isError={subscription.isError}
        error={subscription.error}
        data={subscription.data}
        isEmpty={() => false}
        onRetry={() => void subscription.refetch()}
        skeleton={<div className="h-56" />}
      >
        {(data) => (
          <div className="space-y-6">
            <CurrentPlan subscription={data} />
            <PlansSection currentPlanId={data.currentPlan.id} />
          </div>
        )}
      </AsyncBoundary>

      <ObservabilitySection />
    </div>
  );
}
