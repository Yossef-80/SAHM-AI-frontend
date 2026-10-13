"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus, X, Check, ChevronLeft, ChevronRight, Loader2, Sparkles, Upload } from "lucide-react";
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
import {
  useCreatives,
  useUploadCreative,
  useGenerateStrategy,
  useMetaConnection,
  usePrepareMetaAdPlan,
  useMetaInterestSearch,
  usePreviewMetaAdPlan,
  useConfirmMetaAdPlan,
  useActivateMetaAdPlan,
} from "@/hooks/use-api";
import { useUiStore } from "@/store/ui-store";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  CampaignObjectiveSchema,
  type CampaignDraft,
  type CampaignObjective,
  type GeneratedCampaignStrategy,
  type MetaAdPlanActivationResponse,
  type MetaAdPlanApprovalResponse,
  type MetaAdPlanSettings,
} from "@/types";
import { GeneratedStrategyView } from "../detail/generated-strategy-view";
import { CreativeCard } from "@/components/creatives/creative-card";

const STEPS = ["goal", "audience", "strategy", "creatives", "review", "launch"] as const;

/** Meta expects selected gender IDs as an array; omit the key for all genders. */
const GENDER_TO_META = { male: 1, female: 2 } as const;
type Step = (typeof STEPS)[number];

type WizardState = {
  name: string;
  objective: CampaignObjective | "";
  dailyBudget: number;
  currency: string;
  startDate: string;
  endDate: string;
  audienceName: string;
  ageMin: number;
  ageMax: number;
  gender: "all" | "male" | "female";
  locations: string;
  /** Interests already resolved to Meta IDs; targeting rejects bare names. */
  interests: { id: string; name: string }[];
  brief: string;
  strategy: GeneratedCampaignStrategy | null;
  creativeIds: string[];
  destinationUrl: string;
  primaryText: string;
  headline: string;
  instagramActorId: string;
  /** ISO country codes for Meta `geo_locations`. Chosen, never inferred. */
  countries: string[];
};

type PreparedMetaPlan = { campaignId: string; recommendationId: string; title: string };

/**
 * Meta fixes the billing event, optimization goal and destination type per
 * campaign objective, so these are derived rather than typed in by a customer.
 * A wrong value here makes Meta reject the campaign, which is exactly why the
 * raw fields were removed from the wizard.
 */
const META_OBJECTIVE_DEFAULTS: Record<
  string,
  { billingEvent: string; optimizationGoal: string; destinationType?: string }
> = {
  awareness: { billingEvent: "IMPRESSIONS", optimizationGoal: "REACH" },
  traffic: {
    billingEvent: "LINK_CLICKS",
    optimizationGoal: "LINK_CLICKS",
    destinationType: "WEBSITE",
  },
  engagement: {
    billingEvent: "IMPRESSIONS",
    optimizationGoal: "POST_ENGAGEMENT",
    destinationType: "WEBSITE",
  },
  leads: {
    billingEvent: "OFFSITE_CONVERSIONS",
    optimizationGoal: "OFFSITE_CONVERSIONS",
    destinationType: "WEBSITE",
  },
  sales: {
    billingEvent: "OFFSITE_CONVERSIONS",
    optimizationGoal: "OFFSITE_CONVERSIONS",
    destinationType: "WEBSITE",
  },
  app_installs: {
    billingEvent: "APP_INSTALLS",
    optimizationGoal: "APP_INSTALLS",
    destinationType: "APP",
  },
};

/** Objectives that need a Meta Pixel / app object the customer cannot supply. */
const PROMOTED_OBJECT_OBJECTIVES = ["leads", "sales", "app_installs"];

/** Markets offered in the targeting picker. ISO 3166-1 alpha-2, as Meta wants. */
const COUNTRY_OPTIONS: Array<{ code: string; ar: string; en: string }> = [
  { code: "EG", ar: "مصر", en: "Egypt" },
  { code: "SA", ar: "السعودية", en: "Saudi Arabia" },
  { code: "AE", ar: "الإمارات", en: "United Arab Emirates" },
  { code: "KW", ar: "الكويت", en: "Kuwait" },
  { code: "QA", ar: "قطر", en: "Qatar" },
  { code: "BH", ar: "البحرين", en: "Bahrain" },
  { code: "OM", ar: "عُمان", en: "Oman" },
  { code: "JO", ar: "الأردن", en: "Jordan" },
  { code: "IQ", ar: "العراق", en: "Iraq" },
  { code: "MA", ar: "المغرب", en: "Morocco" },
  { code: "US", ar: "الولايات المتحدة", en: "United States" },
  { code: "GB", ar: "بريطانيا", en: "United Kingdom" },
];

const today = () => new Date().toISOString().slice(0, 10);

function isSafeMetaPlanRetry(result: MetaAdPlanApprovalResponse | null): boolean {
  if (!result || result.executed) return false;
  const execution = result.recommendation.executionResult;
  if (execution?.status !== "failed_safe" || execution.retry_safe !== true) return false;
  const createdIds = execution.created_ids;
  return (
    typeof createdIds === "object" &&
    createdIds !== null &&
    !Array.isArray(createdIds) &&
    Object.keys(createdIds as Record<string, unknown>).length === 0
  );
}

export function CampaignWizard() {
  const t = useTranslations("campaigns.wizard");
  const tc = useTranslations("common");
  const to = useTranslations("objective");
  const locale = useLocale();
  const prefill = useUiStore((s) => s.campaignPrefill);
  const setPrefill = useUiStore((s) => s.setCampaignPrefill);
  const { dispatch, isPending } = useAction();
  const genStrategy = useGenerateStrategy();
  const prepareMetaPlan = usePrepareMetaAdPlan();
  const previewMetaPlan = usePreviewMetaAdPlan();
  const confirmMetaPlan = useConfirmMetaAdPlan();
  const activateMetaPlan = useActivateMetaAdPlan();
  const creatives = useCreatives();
  const upload = useUploadCreative();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  /**
   * Selecting a file uploads it immediately, then auto-selects the new creative
   * so the user does not have to hunt for it in the grid.
   */
  const handleUploadPicked = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Clear the input first: without this, picking the same file twice in a row
    // fires no change event and the second upload silently does nothing.
    event.target.value = "";
    if (!file) return;
    try {
      const created = await upload.mutateAsync({ file });
      set("creativeIds", Array.from(new Set([...state.creativeIds, created.id])));
      creatives.refetch();
    } catch {
      // The banner next to the button carries the message.
    }
  };

  const meta = useMetaConnection();

  const [step, setStep] = useState<Step>("goal");
  // Type-ahead for Meta Targeting Search; the *selected* interests live in state
  // because they carry the IDs that targeting requires.
  const [interestQuery, setInterestQuery] = useState("");
  const interestSearch = useMetaInterestSearch(interestQuery);
  const interestOptions = (interestSearch.data?.results ?? []).filter(
    (r) => !state.interests.some((s) => s.id === r.id),
  );
  const [state, setState] = useState<WizardState>({
    name: prefill?.name ?? "",
    objective: prefill?.objective ?? "",
    dailyBudget: prefill?.dailyBudget ?? 0,
    currency: prefill?.currency ?? "",
    startDate: prefill?.startDate ?? today(),
    endDate: prefill?.endDate ?? "",
    audienceName: prefill?.audience?.name ?? "",
    ageMin: prefill?.audience?.ageMin ?? 0,
    ageMax: prefill?.audience?.ageMax ?? 0,
    gender: "all",
    locations: "",
    interests: [],
    brief: "",
    strategy: null,
    creativeIds: prefill?.creativeIds ?? [],
    destinationUrl: "",
    primaryText: "",
    headline: "",
    instagramActorId: "",
    countries: [],
  });
  const [preparedPlan, setPreparedPlan] = useState<PreparedMetaPlan | null>(null);
  const [planPreview, setPlanPreview] = useState<MetaAdPlanApprovalResponse | null>(null);
  const [planExecution, setPlanExecution] = useState<MetaAdPlanApprovalResponse | null>(null);
  const [retryReview, setRetryReview] = useState(false);
  // Activation is a separate two-phase step: preview first, then spend.
  const [activation, setActivation] = useState<MetaAdPlanActivationResponse | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  useEffect(() => () => setPrefill(null), [setPrefill]);

  const set = <K extends keyof WizardState>(k: K, v: WizardState[K]) => setState((s) => ({ ...s, [k]: v }));
  const idx = STEPS.indexOf(step);

  const errors = useMemo(() => {
    const e: Partial<Record<Step, string>> = {};
    if (!state.objective) e.goal = t("validation.objectiveRequired");
    else if (state.name.trim().length < 2) e.goal = t("validation.nameRequired");
    else if (!(state.dailyBudget > 0)) e.goal = t("validation.budgetPositive");
    else if (!/^[A-Z]{3}$/.test(state.currency)) e.goal = t("validation.currencyRequired");
    if (!state.audienceName.trim()) e.audience = t("validation.audienceName");
    else if (!(state.ageMin >= 13 && state.ageMax <= 65 && state.ageMax >= state.ageMin)) e.audience = t("validation.ageRange");
    return e;
  }, [state, t]);

  const draft = (): CampaignDraft => ({
    name: state.name.trim(),
    objective: state.objective as CampaignObjective,
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
      interests: state.interests.map((i) => i.name),
      behaviors: [],
    },
    // The backend stores campaign drafts separately from this transient AI plan.
    strategy: null,
    creativeIds: state.creativeIds,
    launchNow: false,
  });

  const planFormIssues = useMemo(() => {
    const issues: string[] = [];
    const field = (name: string) => t(`launch.fields.${name}`);
    if (state.creativeIds.length === 0 || state.creativeIds.length > 10) issues.push(field("creatives"));
    // billingEvent / optimizationGoal / destinationType / specialAdCategories /
    // callToAction are derived from the objective in buildPlanSettings(), so they
    // are no longer customer input and are not validated here.
    if (state.countries.length === 0) issues.push(field("countries"));
    // promotedObject (Meta Pixel / app id) is owner configuration, not customer
    // input, and there is no UI for it. Rather than blocking these objectives
    // forever it is left unset and Meta's own rejection is surfaced in planError.
    try {
      if (!state.destinationUrl.trim() || new URL(state.destinationUrl).protocol !== "https:") issues.push(field("destinationUrl"));
    } catch {
      issues.push(field("destinationUrl"));
    }
    if (!state.primaryText.trim()) issues.push(field("primaryText"));
    if (!state.headline.trim()) issues.push(field("headline"));
    return Array.from(new Set(issues));
  }, [state, t]);

  const buildPlanSettings = (): MetaAdPlanSettings => {
    const derived =
      META_OBJECTIVE_DEFAULTS[state.objective] ?? META_OBJECTIVE_DEFAULTS.traffic;
    return {
    objective: state.objective as CampaignObjective,
    creativeIds: state.creativeIds,
    // Age and gender are read straight off the targeting object, so they need
    // no lookup. geo_locations is always sent: meta_ads.py rejects a targeting
    // block without it, and planFormIssues already requires at least one country.
    // Nothing here is inferred from free text.
    targeting: {
      age_min: state.ageMin,
      age_max: state.ageMax,
      ...(state.gender === "all"
        ? {}
        : { genders: [GENDER_TO_META[state.gender]] }),
      geo_locations: { countries: [...state.countries] },
      // Meta rejects interest names; only Targeting Search IDs are accepted.
      ...(state.interests.length > 0
        ? {
            flexible_spec: [
              { interests: state.interests.map(({ id, name }) => ({ id, name })) },
            ],
          }
        : {}),
    },
    billingEvent: derived.billingEvent,
    optimizationGoal: derived.optimizationGoal,
    // An empty list is explicit: most advertisers are not in a special category,
    // and omitting it makes Meta reject the request.
    specialAdCategories: [],
    destinationType: derived.destinationType,
    // Left unset: needs a Meta Pixel / app object the workspace owner configures.
    promotedObject: undefined,
    destinationUrl: state.destinationUrl.trim() || undefined,
    primaryText: state.primaryText.trim() || undefined,
    headline: state.headline.trim() || undefined,
    callToAction: {
      type: "LEARN_MORE",
      value: { link: state.destinationUrl.trim(), link_caption: state.headline.trim() },
    },
    instagramActorId: state.instagramActorId.trim() || undefined,
    };
  };

  const preparePlan = async () => {
    setPlanError(null);
    setPlanPreview(null);
    setPlanExecution(null);
    setRetryReview(false);
    try {
      const result = await prepareMetaPlan.mutateAsync({ draft: draft(), plan: buildPlanSettings() });
      setPreparedPlan(result);
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : String(error));
    }
  };
  const requestPlanApproval = async () => {
    if (!preparedPlan) return;
    setPlanError(null);
    try {
      const result = await previewMetaPlan.mutateAsync(preparedPlan.recommendationId);
      setPlanPreview(result);
      setRetryReview(false);
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : String(error));
    }
  };
  const reviewSafeMetaRetry = async () => {
    if (!preparedPlan || !isSafeMetaPlanRetry(planExecution)) return;
    setPlanError(null);
    try {
      const result = await previewMetaPlan.mutateAsync(preparedPlan.recommendationId);
      setPlanPreview(result);
      setRetryReview(true);
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : String(error));
    }
  };
  const executeApprovedPlan = async () => {
    if (!preparedPlan || !planPreview?.requiresConfirmation) return;
    setPlanError(null);
    try {
      const result = await confirmMetaPlan.mutateAsync(preparedPlan.recommendationId);
      setPlanExecution(result);
      setRetryReview(false);
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : String(error));
    }
  };
  const requestActivation = async (confirm: boolean) => {
    if (!preparedPlan) return;
    setPlanError(null);
    try {
      const result = await activateMetaPlan.mutateAsync({
        recommendationId: preparedPlan.recommendationId,
        confirm,
      });
      setActivation(result);
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : String(error));
    }
  };
  const canNext = !errors[step];
  const next = () => setStep(STEPS[Math.min(idx + 1, STEPS.length - 1)]);
  const back = () => setStep(STEPS[Math.max(idx - 1, 0)]);

  const generate = () =>
    genStrategy.mutate(
      {
        campaignName: state.name,
        objective: state.objective as CampaignObjective,
        dailyBudget: state.dailyBudget,
        currency: state.currency,
        language: locale === "ar" ? "ar" : "en",
        brief: state.brief || undefined,
        audience: {
          name: state.audienceName,
          ageMin: state.ageMin,
          ageMax: state.ageMax,
          genders: [state.gender],
          locations: state.locations.split(",").map((s) => s.trim()).filter(Boolean),
          interests: state.interests.map((i) => i.name),
          behaviors: [],
        },
      },
      { onSuccess: (s) => set("strategy", s) },
    );

  const metaConnected = meta.data?.campaignReady === true;

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
                <Select value={state.objective || ""} onValueChange={(v) => set("objective", v as CampaignObjective)}>
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
                      <SelectValue placeholder={t("goal.currencyPlaceholder")} />
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
                <Input id="amin" type="number" min={13} max={65} value={state.ageMin || ""} onChange={(e) => set("ageMin", Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="amax">{t("audience.ageMax")}</Label>
                <Input id="amax" type="number" min={13} max={65} value={state.ageMax || ""} onChange={(e) => set("ageMax", Number(e.target.value))} />
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
                <Input
                  id="int"
                  value={interestQuery}
                  onChange={(e) => setInterestQuery(e.target.value)}
                  placeholder={t("audience.interestsPlaceholder")}
                  autoComplete="off"
                />
                {state.interests.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {state.interests.map((i) => (
                      <span
                        key={i.id}
                        className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-xs"
                      >
                        {i.name}
                        <button
                          type="button"
                          className="p-0.5 text-muted-foreground hover:text-foreground"
                          aria-label={t("audience.removeInterest", { name: i.name })}
                          onClick={() =>
                            set("interests", state.interests.filter((x) => x.id !== i.id))
                          }
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {interestOptions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {interestOptions.map((r) => (
                      <Button
                        key={r.id}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() =>
                          set("interests", [...state.interests, { id: r.id, name: r.name }])
                        }
                      >
                        <Plus className="h-3 w-3" />
                        {r.name}
                      </Button>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {interestSearch.data && !interestSearch.data.available
                    ? t("audience.interestsUnavailable")
                    : t("audience.interestsHint")}
                </p>
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
                {(s) => <GeneratedStrategyView strategy={s} />}
              </AsyncBoundary>
            </div>
          )}

          {step === "creatives" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">{t("creatives.pick")}</p>
                <Badge variant="secondary">{t("creatives.selected", { count: state.creativeIds.length })}</Badge>
              </div>

              {/* Upload lives here rather than on the creatives page: this is the
                  step where a missing image actually blocks the plan. */}
              <div className="space-y-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleUploadPicked}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={upload.isPending}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {upload.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    {upload.isPending ? t("creatives.uploading") : t("creatives.upload")}
                  </Button>
                  <p className="text-xs text-muted-foreground">{t("creatives.uploadHint")}</p>
                </div>
                {upload.isError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {upload.error instanceof Error ? upload.error.message : t("creatives.uploadFailed")}
                  </p>
                ) : null}
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
                  {to(state.objective as CampaignObjective)} · {formatCurrency(state.dailyBudget, state.currency, locale)}/day
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
            <div className="space-y-5">
              <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
                <p className="font-medium">{t("launch.desc")}</p>
                <p className="mt-1 text-muted-foreground">{t("launch.pausedOnly")}</p>
              </div>

              {!preparedPlan ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">{t("launch.settingsIntro")}</p>
                  {!metaConnected && (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                      <p>{meta.isLoading ? t("launch.checkingMeta") : t("launch.requiresMeta")}</p>
                      {!meta.isLoading && meta.data?.errorMessage && (
                        <p className="mt-1 font-medium">{meta.data.errorMessage}</p>
                      )}
                    </div>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <PlanField label={t("launch.fields.destinationUrl")}>
                      <Input type="url" value={state.destinationUrl} onChange={(e) => set("destinationUrl", e.target.value)} placeholder="https://" />
                    </PlanField>
                    <PlanField label={t("launch.fields.headline")}>
                      <Input value={state.headline} onChange={(e) => set("headline", e.target.value)} />
                    </PlanField>
                    <PlanField label={t("launch.fields.primaryText")} className="sm:col-span-2">
                      <Textarea value={state.primaryText} onChange={(e) => set("primaryText", e.target.value)} rows={3} />
                    </PlanField>
                  <div>
                    <Label>{t("launch.fields.countries")}</Label>
                    <p className="mb-2 text-xs text-muted-foreground">{t("launch.hints.countries")}</p>
                    <div className="flex flex-wrap gap-2">
                      {COUNTRY_OPTIONS.map((c) => {
                        const on = state.countries.includes(c.code);
                        return (
                          <Button
                            key={c.code}
                            type="button"
                            variant={on ? "default" : "outline"}
                            size="sm"
                            onClick={() =>
                              set(
                                "countries",
                                on
                                  ? state.countries.filter((x) => x !== c.code)
                                  : [...state.countries, c.code],
                              )
                            }
                          >
                            {locale === "ar" ? c.ar : c.en}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                  {PROMOTED_OBJECT_OBJECTIVES.includes(state.objective) && (
                    <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
                      {t("launch.promotedObjectNotice")}
                    </p>
                  )}
                  </div>
                  {planFormIssues.length > 0 && (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                      <p className="font-medium">{t("launch.completeRequired")}</p>
                      {/* The message above promises the fields are listed below; name
                          them, otherwise the button is dead with no explanation. */}
                      <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-muted-foreground">
                        {planFormIssues.map((issue) => (
                          <li key={issue}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {planError && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{planError}</p>}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" disabled={isPending || !!errors.goal || !!errors.audience} onClick={() => dispatch({ type: "CREATE_CAMPAIGN", payload: { draft: draft() } })}>
                      {t("launch.saveDraft")}
                    </Button>
                    <Button disabled={prepareMetaPlan.isPending || planFormIssues.length > 0 || !!errors.goal || !!errors.audience} onClick={preparePlan}>
                      {prepareMetaPlan.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                      {t("launch.preparePlan")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
                    <p className="font-medium">{preparedPlan.title}</p>
                    <p className="mt-1">{t(planExecution ? "launch.metaAttempted" : "launch.savedNoWrite")}</p>
                  </div>
                  {!planPreview && (
                    <div className="space-y-3">
                      {!metaConnected && (
                        <p className="text-sm text-destructive">
                          {meta.data?.errorMessage ?? t("launch.requiresMeta")}
                        </p>
                      )}
                      <Button disabled={!metaConnected || previewMetaPlan.isPending} onClick={requestPlanApproval}>
                        {previewMetaPlan.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                        {t("launch.reviewPlan")}
                      </Button>
                    </div>
                  )}
                  {planPreview && (
                    <div className="space-y-3">
                      <p className="text-sm font-medium">{planPreview.message}</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <ReviewItem label={t("review.goal")}>
                          <p className="font-medium">{state.name}</p>
                          <p className="text-muted-foreground">{to(state.objective as CampaignObjective)} · {formatCurrency(state.dailyBudget, state.currency, locale)}/day</p>
                        </ReviewItem>
                        <ReviewItem label={t("review.audience")}>
                          <p className="font-medium">{state.audienceName}</p>
                          <p className="text-muted-foreground">{state.ageMin}–{state.ageMax} · {state.locations || "—"}</p>
                        </ReviewItem>
                        <ReviewItem label={t("review.creatives")}>
                          <p>{t("review.creativeCount", { count: state.creativeIds.length })}</p>
                          <p className="text-muted-foreground">{meta.data?.accountName ?? meta.data?.accountId ?? t("launch.metaAccountNotNamed")}</p>
                        </ReviewItem>
                        <ReviewItem label={t("launch.fields.destinationUrl")}>
                          <p className="break-all">{state.destinationUrl || "—"}</p>
                        </ReviewItem>
                      </div>
                      {planPreview.requiresConfirmation && (!planExecution || retryReview) && (
                        <Button disabled={confirmMetaPlan.isPending || previewMetaPlan.isPending || !metaConnected} onClick={executeApprovedPlan}>
                          {confirmMetaPlan.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                          {t(retryReview ? "launch.confirmRetry" : "launch.confirmPaused")}
                        </Button>
                      )}
                      {planExecution && (
                        <div className={cn("rounded-md border p-3 text-sm", planExecution.executed ? "border-emerald-500/30 bg-emerald-500/10" : "border-destructive/30 bg-destructive/5")}>
                          <p className="font-medium">{planExecution.message}</p>
                          {planExecution.recommendation.executionResult && (
                            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs" dir="ltr">{JSON.stringify(planExecution.recommendation.executionResult, null, 2)}</pre>
                          )}
                          {isSafeMetaPlanRetry(planExecution) && !retryReview && (
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                              <p className="text-xs text-muted-foreground">{t("launch.retrySafeHint")}</p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={confirmMetaPlan.isPending || previewMetaPlan.isPending || !metaConnected}
                                onClick={reviewSafeMetaRetry}
                              >
                                {previewMetaPlan.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                                {t("launch.retryMetaCreation")}
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                      {planExecution?.executed && (
                        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                          {activation?.executed ? (
                            <p className="font-medium text-emerald-600 dark:text-emerald-400">{activation.message}</p>
                          ) : (
                            <>
                              <p className="font-medium">{t("launch.activateTitle")}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{t("launch.activateWarn")}</p>
                              {activation?.requiresConfirmation && (
                                <ul className="mt-2 list-inside list-disc text-xs" dir="ltr">
                                  {activation.targets.map((target) => (
                                    <li key={target}>{target}</li>
                                  ))}
                                </ul>
                              )}
                              <div className="mt-3 flex flex-wrap gap-2">
                                {!activation?.requiresConfirmation ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={activateMetaPlan.isPending || !metaConnected}
                                    onClick={() => requestActivation(false)}
                                  >
                                    {t("launch.activatePreview")}
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    disabled={activateMetaPlan.isPending || !metaConnected}
                                    onClick={() => requestActivation(true)}
                                  >
                                    {activateMetaPlan.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                                    {t("launch.activateConfirm")}
                                  </Button>
                                )}
                              </div>
                              {activation?.unavailableReason && (
                                <p className="mt-2 text-xs text-destructive">{activation.unavailableReason}</p>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {planError && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{planError}</p>}
                </div>
              )}
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

function PlanField({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
