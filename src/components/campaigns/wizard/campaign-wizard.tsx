"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, ChevronLeft, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AsyncBoundary, CardGridSkeleton } from "@/components/shared/async-boundary";
import { PageHeader } from "@/components/shared/page-header";
import { useAction } from "@/hooks/use-action";
import { useCreatives, useGenerateStrategy, useMetaConnection } from "@/hooks/use-api";
import { useUiStore } from "@/store/ui-store";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CampaignObjectiveSchema, type CampaignDraft, type CampaignObjective, type CampaignStrategy } from "@/types";
import { StrategyView } from "../detail/strategy-view";
import { CreativeCard } from "@/components/creatives/creative-card";

const STEPS = ["goal", "audience", "strategy", "creatives", "review", "launch"] as const;
type Step = (typeof STEPS)[number];

type WizardState = {
  name: string;
  objective: CampaignObjective;
  dailyBudget: number;
  currency: string;
  startDate: string;
  endDate: string;
  audienceName: string;
  ageMin: number;
  ageMax: number;
  gender: "all" | "male" | "female";
  locations: string;
  interests: string;
  brief: string;
  strategy: CampaignStrategy | null;
  creativeIds: string[];
};

const today = () => new Date().toISOString().slice(0, 10);

export function CampaignWizard() {
  const t = useTranslations("campaigns.wizard");
  const tc = useTranslations("common");
  const to = useTranslations("objective");
  const locale = useLocale();
  const prefill = useUiStore((s) => s.campaignPrefill);
  const setPrefill = useUiStore((s) => s.setCampaignPrefill);
  const { dispatch, isPending } = useAction();
  const genStrategy = useGenerateStrategy();
  const creatives = useCreatives();
  const meta = useMetaConnection();

  const [step, setStep] = useState<Step>("goal");
  const [state, setState] = useState<WizardState>({
    name: prefill?.name ?? "",
    objective: prefill?.objective ?? "sales",
    dailyBudget: prefill?.dailyBudget ?? 500,
    currency: prefill?.currency ?? "EGP",
    startDate: today(),
    endDate: "",
    audienceName: "",
    ageMin: 22,
    ageMax: 45,
    gender: "all",
    locations: "Cairo, EG",
    interests: "",
    brief: "",
    strategy: null,
    creativeIds: [],
  });
  useEffect(() => () => setPrefill(null), [setPrefill]);

  const set = <K extends keyof WizardState>(k: K, v: WizardState[K]) => setState((s) => ({ ...s, [k]: v }));
  const idx = STEPS.indexOf(step);

  const errors = useMemo(() => {
    const e: Partial<Record<Step, string>> = {};
    if (state.name.trim().length < 2) e.goal = t("validation.nameRequired");
    else if (!(state.dailyBudget > 0)) e.goal = t("validation.budgetPositive");
    if (!state.audienceName.trim()) e.audience = t("validation.audienceName");
    return e;
  }, [state, t]);

  const draft = (launchNow: boolean): CampaignDraft => ({
    name: state.name.trim(),
    objective: state.objective,
    dailyBudget: state.dailyBudget,
    currency: state.currency,
    startDate: new Date(state.startDate).toISOString(),
    endDate: state.endDate ? new Date(state.endDate).toISOString() : null,
    audience: {
      name: state.audienceName.trim(),
      ageMin: state.ageMin,
      ageMax: state.ageMax,
      genders: [state.gender],
      locations: state.locations.split(",").map((s) => s.trim()).filter(Boolean),
      interests: state.interests.split(",").map((s) => s.trim()).filter(Boolean),
      behaviors: [],
    },
    strategy: state.strategy,
    creativeIds: state.creativeIds,
    launchNow,
  });

  const canNext = !errors[step];
  const next = () => setStep(STEPS[Math.min(idx + 1, STEPS.length - 1)]);
  const back = () => setStep(STEPS[Math.max(idx - 1, 0)]);

  const generate = () =>
    genStrategy.mutate(
      {
        objective: state.objective,
        dailyBudget: state.dailyBudget,
        brief: state.brief || undefined,
        audience: { name: state.audienceName, ageMin: state.ageMin, ageMax: state.ageMax, locations: state.locations.split(",").map((s) => s.trim()) },
      },
      { onSuccess: (s) => set("strategy", s) },
    );

  const metaConnected = meta.data?.status === "connected";

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t("title")} />
      <ol className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => i < idx && setStep(s)}
              disabled={i > idx}
              className={cn("flex items-center gap-1.5 rounded-full px-3 py-1", i === idx ? "bg-primary text-primary-foreground" : i < idx ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}
            >
              {i < idx ? <Check className="h-3.5 w-3.5" /> : <span className="text-xs">{i + 1}</span>}
              {t(`steps.${s}`)}
            </button>
            {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />}
          </li>
        ))}
      </ol>

      <Card>
        <CardHeader>
          <CardTitle>{t(`steps.${step}`)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "goal" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="name">{t("goal.name")}</Label>
                <Input id="name" value={state.name} onChange={(e) => set("name", e.target.value)} placeholder={t("goal.namePlaceholder")} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("goal.objective")}</Label>
                <Select value={state.objective} onValueChange={(v) => set("objective", v as CampaignObjective)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CampaignObjectiveSchema.options.map((o) => (
                      <SelectItem key={o} value={o}>
                        {to(o)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="budget">{t("goal.budget")}</Label>
                  <Input id="budget" type="number" min={1} value={state.dailyBudget} onChange={(e) => set("dailyBudget", Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("goal.currency")}</Label>
                  <Select value={state.currency} onValueChange={(v) => set("currency", v)}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["EGP", "USD", "SAR", "AED"].map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="start">{t("goal.startDate")}</Label>
                <Input id="start" type="date" value={state.startDate} onChange={(e) => set("startDate", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end">{t("goal.endDate")}</Label>
                <Input id="end" type="date" value={state.endDate} onChange={(e) => set("endDate", e.target.value)} />
              </div>
            </div>
          )}

          {step === "audience" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="aname">{t("audience.name")}</Label>
                <Input id="aname" value={state.audienceName} onChange={(e) => set("audienceName", e.target.value)} placeholder={t("audience.namePlaceholder")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="amin">{t("audience.ageMin")}</Label>
                <Input id="amin" type="number" min={13} max={65} value={state.ageMin} onChange={(e) => set("ageMin", Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="amax">{t("audience.ageMax")}</Label>
                <Input id="amax" type="number" min={13} max={65} value={state.ageMax} onChange={(e) => set("ageMax", Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("audience.gender")}</Label>
                <Select value={state.gender} onValueChange={(v) => set("gender", v as WizardState["gender"])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("audience.all")}</SelectItem>
                    <SelectItem value="male">{t("audience.male")}</SelectItem>
                    <SelectItem value="female">{t("audience.female")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loc">{t("audience.locations")}</Label>
                <Input id="loc" value={state.locations} onChange={(e) => set("locations", e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="int">{t("audience.interests")}</Label>
                <Input id="int" value={state.interests} onChange={(e) => set("interests", e.target.value)} />
              </div>
            </div>
          )}

          {step === "strategy" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="brief">{t("strategy.brief")}</Label>
                <Textarea id="brief" value={state.brief} onChange={(e) => set("brief", e.target.value)} placeholder={t("strategy.briefPlaceholder")} rows={2} />
              </div>
              <Button onClick={generate} disabled={genStrategy.isPending} variant={state.strategy ? "outline" : "default"}>
                {genStrategy.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Sparkles className="me-2 h-4 w-4" />}
                {genStrategy.isPending ? t("strategy.generating") : state.strategy ? t("strategy.regenerate") : t("strategy.generate")}
              </Button>
              <AsyncBoundary
                isLoading={genStrategy.isPending}
                isError={genStrategy.isError}
                error={genStrategy.error}
                data={state.strategy}
                onRetry={generate}
                emptyTitle={t("strategy.empty")}
              >
                {(s) => <StrategyView strategy={s} />}
              </AsyncBoundary>
            </div>
          )}

          {step === "creatives" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{t("creatives.pick")}</p>
                <Badge variant="secondary">{t("creatives.selected", { count: state.creativeIds.length })}</Badge>
              </div>
              <AsyncBoundary
                {...creatives}
                onRetry={() => creatives.refetch()}
                skeleton={<CardGridSkeleton count={3} />}
                emptyTitle={t("creatives.empty")}
                emptyDescription={t("creatives.emptyDesc")}
              >
                {(list) => (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((c) => {
                      const on = state.creativeIds.includes(c.id);
                      return (
                        <CreativeCard
                          key={c.id}
                          creative={c}
                          selectable
                          selected={on}
                          onSelect={() => set("creativeIds", on ? state.creativeIds.filter((x) => x !== c.id) : [...state.creativeIds, c.id])}
                        />
                      );
                    })}
                  </div>
                )}
              </AsyncBoundary>
            </div>
          )}

          {step === "review" && (
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <ReviewItem label={t("review.goal")}>
                <p className="font-medium">{state.name}</p>
                <p className="text-muted-foreground">
                  {to(state.objective)} · {formatCurrency(state.dailyBudget, state.currency, locale)}/day
                </p>
              </ReviewItem>
              <ReviewItem label={t("review.audience")}>
                <p className="font-medium">{state.audienceName}</p>
                <p className="text-muted-foreground">
                  {state.ageMin}–{state.ageMax} · {state.locations}
                </p>
              </ReviewItem>
              <ReviewItem label={t("review.strategy")}>
                <p className="line-clamp-3">{state.strategy?.summary ?? t("review.noStrategy")}</p>
              </ReviewItem>
              <ReviewItem label={t("review.creatives")}>
                <p>{t("review.creativeCount", { count: state.creativeIds.length })}</p>
              </ReviewItem>
            </dl>
          )}

          {step === "launch" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t("launch.desc")}</p>
              {!metaConnected && <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">{t("launch.requiresMeta")}</p>}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={isPending} onClick={() => dispatch({ type: "CREATE_CAMPAIGN", payload: { draft: draft(false) } })}>
                  {t("launch.saveDraft")}
                </Button>
                <Button disabled={isPending || !metaConnected} onClick={() => dispatch({ type: "CREATE_CAMPAIGN", payload: { draft: draft(true) } })}>
                  {isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                  {t("launch.launchNow")}
                </Button>
              </div>
            </div>
          )}

          {errors[step] && step !== "launch" && <p className="text-sm text-destructive">{errors[step]}</p>}

          <div className="flex items-center justify-between border-t pt-4">
            <Button variant="ghost" onClick={back} disabled={idx === 0}>
              <ChevronLeft className="me-1 h-4 w-4 rtl:rotate-180" />
              {tc("back")}
            </Button>
            {step !== "launch" && (
              <Button onClick={next} disabled={!canNext}>
                {tc("next")}
                <ChevronRight className="ms-1 h-4 w-4 rtl:rotate-180" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReviewItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border p-3">
      <dt className="mb-1 text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
