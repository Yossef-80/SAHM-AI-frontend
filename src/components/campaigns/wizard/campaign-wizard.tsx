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
  useAssistMetaAdPlan,
  usePrepareMetaAdPlan,
  useMetaInterestSearch,
  useAudiences,
  useCreateAudience,
  useUpdateAudience,
  useArchiveAudience,
  useSuggestAudiences,
  usePreviewMetaAdPlan,
  useConfirmMetaAdPlan,
  useActivateMetaAdPlan,
} from "@/hooks/use-api";
import { useUiStore } from "@/store/ui-store";
import { formatCurrency } from "@/lib/format";
import { buildMetaDetailedTargeting } from "@/lib/api/meta-targeting";
import { cn } from "@/lib/utils";
import {
  CampaignObjectiveSchema,
  TargetingCategorySchema,
  type CampaignDraft,
  type CampaignObjective,
  type GeneratedCampaignStrategy,
  type MetaAdPlanActivationResponse,
  type MetaAdPlanApprovalResponse,
  type MetaAdPlanAssistResponse,
  type MetaAdPlanSettings,
  type AudienceIdea,
  type AudienceTargetingTarget,
  type TargetingCategory,
} from "@/types";
import { GeneratedStrategyView } from "../detail/generated-strategy-view";
import { CreativeCard } from "@/components/creatives/creative-card";

const STEPS = ["goal", "audience", "strategy", "creatives", "review", "launch"] as const;

/** Meta expects selected gender IDs as an array; omit the key for all genders. */
const GENDER_TO_META = { male: 1, female: 2 } as const;
const TARGETING_CATEGORIES: TargetingCategory[] = [
  "interests",
  "behaviors",
  "job_titles",
  "employers",
  "education_majors",
  "education_schools",
  "life_events",
  "industries",
  "income",
  "family_statuses",
  "devices",
  "operating_systems",
];

type Step = (typeof STEPS)[number];

const DRAFT_STORAGE_KEY = "sahm_campaign_wizard_draft";

type WizardState = {
  name: string;
  objective: CampaignObjective | "";
  dailyBudget: number;
  currency: string;
  startDate: string;
  endDate: string;
  audienceName: string;
  audienceId: string | null;
  audienceLibraryId: string | null;
  audienceDescription: string;
  audienceSource: "manual" | "ai";
  ageMin: number;
  ageMax: number;
  gender: "all" | "male" | "female";
  locations: string;
  /** User-selected targeting options resolved to Meta IDs and category. */
  targetingTargets: AudienceTargetingTarget[];
  brief: string;
  strategy: GeneratedCampaignStrategy | null;
  creativeIds: string[];
  destinationUrl: string;
  primaryText: string;
  headline: string;
  callToActionType: string;
  billingEvent: string | null;
  optimizationGoal: string | null;
  destinationType: string | null;
  specialAdCategories: string[];
  instagramActorId: string;
  /** ISO country codes for Meta `geo_locations`. Chosen, never inferred. */
  countries: string[];
};

type PreparedMetaPlan = { campaignId: string; recommendationId: string; title: string };

/**
 * Objective-bound delivery settings are derived, never carried over from a
 * previous wizard objective or written back from a generic MCP enum suggestion.
 * In particular Awareness must use IMPRESSIONS billing with REACH optimization.
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

function toGeneratedStrategy(s: unknown): GeneratedCampaignStrategy | null {
  if (!s || typeof s !== "object") return null;
  const strat = s as Record<string, unknown>;
  const rawChannels = Array.isArray(strat.channels) ? strat.channels : [];
  const channels = rawChannels.map((c) => {
    if (typeof c === "string") {
      return {
        channel: c,
        role: "Primary channel",
        placements: Array.isArray(strat.placements) ? (strat.placements as string[]) : [],
        rationale: "Selected for campaign objectives",
        budgetSharePct: null,
      };
    }
    return c;
  });

  return {
    summary: String(strat.summary ?? ""),
    objective: (strat.objective as string) ?? null,
    audience: (strat.audience as string) ?? null,
    positioning: (strat.positioning as string) ?? null,
    keyMessages: Array.isArray(strat.keyMessages) ? (strat.keyMessages as string[]) : [],
    channels: channels as GeneratedCampaignStrategy["channels"],
    placements: Array.isArray(strat.placements) ? (strat.placements as string[]) : [],
    creativeDirection: (strat.creativeDirection as string) ?? null,
    ctaDirection: (strat.ctaDirection as string) ?? null,
    creativesNeeded: Array.isArray(strat.creativesNeeded) ? (strat.creativesNeeded as string[]) : [],
    successMetrics: Array.isArray(strat.successMetrics)
      ? (strat.successMetrics as string[])
      : Array.isArray(strat.kpis)
      ? (strat.kpis as { metric: string; target: number }[]).map((k) => `${k.metric}: ${k.target}`)
      : [],
    evidence: Array.isArray(strat.evidence) ? (strat.evidence as string[]) : [],
    assumptions: Array.isArray(strat.assumptions) ? (strat.assumptions as string[]) : [],
    missingInputs: Array.isArray(strat.missingInputs) ? (strat.missingInputs as string[]) : [],
  };
}

function parseTargetingTargets(
  current: unknown,
  legacyInterests: unknown,
): AudienceTargetingTarget[] {
  const parse = (value: unknown, missingCategory: TargetingCategory) =>
    Array.isArray(value)
      ? value.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const candidate = item as { id?: unknown; name?: unknown; category?: unknown };
          const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
          const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
          if (!id || !name) return [];
          if (candidate.category === undefined || candidate.category === null || candidate.category === "") {
            return [{ id, name, category: missingCategory }];
          }
          const category = TargetingCategorySchema.safeParse(candidate.category);
          return category.success ? [{ id, name, category: category.data }] : [];
        })
      : [];
  const parsedCurrent = parse(current, "interests");
  return parsedCurrent.length ? parsedCurrent : parse(legacyInterests, "interests");
}

function parsePrefillToState(p: Partial<CampaignDraft> & Record<string, unknown>): WizardState {
  const aud = (p.audience ?? {}) as Record<string, unknown>;
  const rawGenders = (aud.genders ?? aud.gender) as string[] | string | undefined;
  const rawGender = Array.isArray(rawGenders) ? rawGenders[0] : rawGenders;
  const gender: "all" | "male" | "female" =
    rawGender === "male" || rawGender === "female" || rawGender === "all"
      ? rawGender
      : rawGender === "men"
        ? "male"
        : rawGender === "women"
          ? "female"
          : "all";

  const locationsStr = Array.isArray(aud.locations)
    ? (aud.locations as string[]).join(", ")
    : typeof aud.locations === "string"
      ? (aud.locations as string)
      : "Cairo, EG, Giza, EG, Alexandria, EG";

  const targetingTargets = parseTargetingTargets(
    aud.targetingTargets ?? aud.targeting_targets,
    aud.interestTargets ?? aud.interest_targets,
  );

  const rawStart = (p.startDate ?? p.start_date) as string | undefined;
  const startDateStr = rawStart ? String(rawStart).slice(0, 10) : today();
  
  const rawEnd = (p.endDate ?? p.end_date) as string | undefined;
  let endDateStr = rawEnd ? String(rawEnd).slice(0, 10) : "";
  if (!endDateStr) {
    const end = new Date(startDateStr);
    const duration = Number(p.durationDays ?? p.duration_days ?? 30);
    end.setDate(end.getDate() + (duration > 0 ? duration : 30));
    endDateStr = end.toISOString().slice(0, 10);
  }

  const rawBudget = Number(p.dailyBudget ?? p.daily_budget ?? 500);

  return {
    name: String(p.name ?? ""),
    objective: (p.objective as WizardState["objective"]) ?? "sales",
    dailyBudget: Number.isFinite(rawBudget) && rawBudget > 0 ? rawBudget : 500,
    currency: String(p.currency ?? "EGP"),
    startDate: startDateStr,
    endDate: endDateStr,
    audienceName: String(aud.name ?? aud.audience_name ?? "جمهور واسع"),
    audienceId: typeof aud.id === "string" ? aud.id : null,
    audienceLibraryId: typeof aud.id === "string" ? aud.id : null,
    audienceDescription: String(aud.description ?? ""),
    audienceSource: aud.source === "ai" ? "ai" : "manual",
    ageMin: Number(aud.ageMin ?? aud.age_min ?? 18),
    ageMax: Number(aud.ageMax ?? aud.age_max ?? 65),
    gender,
    locations: locationsStr,
    targetingTargets,
    brief: String(p.strategy?.summary ?? p.brief ?? ""),
    strategy: toGeneratedStrategy(p.strategy),
    creativeIds: p.creativeIds ?? [],
    destinationUrl: String(p.destinationUrl ?? ""),
    primaryText: String(p.primaryText ?? ""),
    headline: String(p.headline ?? ""),
    callToActionType: String(p.callToActionType ?? "LEARN_MORE"),
    billingEvent: null,
    optimizationGoal: null,
    destinationType: null,
    specialAdCategories: [],
    instagramActorId: "",
    countries: Array.isArray(aud.countries) ? aud.countries.map(String) : ["EG"],
  };
}

function getMetaPlanRecoveryAction(
  result: MetaAdPlanApprovalResponse | null,
): "retry" | "resume" | null {
  if (!result || result.executed) return null;
  const execution = result.recommendation.executionResult;
  if (!execution || execution.retry_safe !== true) return null;
  const createdIds = execution.created_ids;
  if (typeof createdIds !== "object" || createdIds === null || Array.isArray(createdIds)) return null;
  const ids = createdIds as Record<string, unknown>;

  if (execution.status === "failed_safe" && Object.keys(ids).length === 0) return "retry";
  if (execution.status === "partial" && execution.failure_status_code === 400) {
    const hasCampaign = typeof ids.campaign === "string" && ids.campaign.length > 0;
    if (
      hasCampaign &&
      (execution.attempted_step === "campaign_bid_strategy" || execution.attempted_step === "ad_set") &&
      Object.keys(ids).length === 1
    ) {
      return "resume";
    }

    // A rejected first Ad Creative may be reviewed and resumed with both
    // already-created paused objects. The backend independently validates the
    // step and creative order before making any further Graph API request.
    const noAdsCreated = Array.isArray(execution.ads) && execution.ads.length === 0;
    if (
      hasCampaign &&
      typeof ids.ad_set === "string" &&
      ids.ad_set.length > 0 &&
      Object.keys(ids).length === 2 &&
      typeof execution.attempted_step === "string" &&
      execution.attempted_step.startsWith("creative:") &&
      noAdsCreated
    ) {
      return "resume";
    }
  }
  return null;
}

/**
 * Which recorded step a safe continuation actually restarts from.
 *
 * `getMetaPlanRecoveryAction` returns "resume" for two different histories: the
 * ad set was never created, or it exists and only the first creative was
 * refused. The copy has to match -- telling a user whose ad set is already on
 * Meta that "this continues at ad set creation" reads as a promise to create a
 * second one.
 */
function getResumeStage(result: MetaAdPlanApprovalResponse | null): "ad_set" | "creative" {
  const step = result?.recommendation.executionResult?.attempted_step;
  return typeof step === "string" && step.startsWith("creative:") ? "creative" : "ad_set";
}

export function CampaignWizard() {
  const t = useTranslations("campaigns.wizard");
  const tc = useTranslations("common");
  const to = useTranslations("objective");
  const locale = useLocale();
  const targetingCategoryLabels: Record<TargetingCategory, string> = {
    interests: t("audience.categories.interests"),
    behaviors: t("audience.categories.behaviors"),
    job_titles: t("audience.categories.jobTitles"),
    employers: t("audience.categories.employers"),
    education_majors: t("audience.categories.educationMajors"),
    education_schools: t("audience.categories.educationSchools"),
    life_events: t("audience.categories.lifeEvents"),
    industries: t("audience.categories.industries"),
    income: t("audience.categories.income"),
    family_statuses: t("audience.categories.familyStatuses"),
    devices: t("audience.categories.devices"),
    operating_systems: t("audience.categories.operatingSystems"),
  };
  const prefill = useUiStore((s) => s.campaignPrefill);
  const setPrefill = useUiStore((s) => s.setCampaignPrefill);
  const { dispatch, isPending } = useAction();
  const genStrategy = useGenerateStrategy();
  const assistMetaPlan = useAssistMetaAdPlan();
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
  const savedAudiences = useAudiences();
  const createAudience = useCreateAudience();
  const updateAudience = useUpdateAudience();
  const archiveAudience = useArchiveAudience();
  const suggestAudience = useSuggestAudiences();
  const [audienceIdeas, setAudienceIdeas] = useState<AudienceIdea[]>([]);
  const [audienceSuggestionError, setAudienceSuggestionError] = useState<string | null>(null);
  const [audienceSaveMessage, setAudienceSaveMessage] = useState<string | null>(null);
  const [audienceMissingInputs, setAudienceMissingInputs] = useState<string[]>([]);

  const [isAiPrefilled, setIsAiPrefilled] = useState(false);
  const [hasDraftRestored, setHasDraftRestored] = useState(false);

  const [step, setStep] = useState<Step>(() => {
    if (prefill?.name && prefill?.audience?.name) {
      return "review";
    }
    if (typeof window !== "undefined") {
      try {
        const pendingRaw = localStorage.getItem("sahm_campaign_wizard_prefill_pending");
        if (pendingRaw) {
          const p = JSON.parse(pendingRaw);
          if (p?.name && p?.audience?.name) return "review";
        }
        const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.step && STEPS.includes(parsed.step)) return parsed.step;
        }
      } catch {}
    }
    return "goal";
  });

  // Category-aware type-ahead for Meta Targeting Search. AI phrases only
  // prefill this search; a result must still be selected explicitly.
  const [targetingCategory, setTargetingCategory] = useState<TargetingCategory>("interests");
  const [targetingQuery, setTargetingQuery] = useState("");
  const targetingTerms = targetingQuery.split(/[,،;؛\r\n]+/).map((term) => term.trim()).filter(Boolean);
  const targetingSearchTerm = targetingTerms[targetingTerms.length - 1] ?? "";
  const targetingQueryHasSeparators = /[,،;؛\r\n]/.test(targetingQuery);
  const targetingSearch = useMetaInterestSearch(targetingSearchTerm, targetingCategory);

  const [state, setState] = useState<WizardState>(() => {
    if (prefill) {
      return parsePrefillToState(prefill);
    }
    if (typeof window !== "undefined") {
      try {
        const pendingRaw = localStorage.getItem("sahm_campaign_wizard_prefill_pending");
        if (pendingRaw) {
          const p = JSON.parse(pendingRaw);
          return parsePrefillToState(p);
        }
        const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.state && typeof parsed.state === "object") {
            const restored = parsed.state as WizardState & { interests?: unknown };
            return {
              ...restored,
              targetingTargets: parseTargetingTargets(
                restored.targetingTargets,
                restored.interests,
              ),
            };
          }
        }
      } catch {}
    }
    return {
      name: "",
      objective: "sales",
      dailyBudget: 500,
      currency: "EGP",
      startDate: today(),
      endDate: "",
      audienceName: "جمهور واسع",
      audienceId: null,
      audienceLibraryId: null,
      audienceDescription: "",
      audienceSource: "manual",
      ageMin: 18,
      ageMax: 65,
      gender: "all",
      locations: "Cairo, EG",
      targetingTargets: [],
      brief: "",
      strategy: null,
      creativeIds: [],
      destinationUrl: "",
      primaryText: "",
      headline: "",
      callToActionType: "LEARN_MORE",
      billingEvent: null,
      optimizationGoal: null,
      destinationType: null,
      specialAdCategories: [],
      instagramActorId: "",
      countries: ["EG"],
    };
  });

  const targetingOptions = (targetingSearch.isDebouncing ? [] : targetingSearch.data?.results ?? []).filter(
    (result) => !state.targetingTargets.some(
      (selected) => selected.category === result.category && selected.id === result.id,
    ),
  );
  const targetingSearchHasNoResults =
    !targetingSearch.isDebouncing &&
    !targetingSearch.isFetching &&
    targetingSearchTerm.length >= 2 &&
    targetingSearch.data?.available === true &&
    targetingSearch.data.results.length === 0;

  const [preparedPlan, setPreparedPlan] = useState<PreparedMetaPlan | null>(null);
  const [planPreview, setPlanPreview] = useState<MetaAdPlanApprovalResponse | null>(null);
  const [planExecution, setPlanExecution] = useState<MetaAdPlanApprovalResponse | null>(null);
  const [retryReview, setRetryReview] = useState(false);
  // Activation is a separate two-phase step: preview first, then spend.
  const [activation, setActivation] = useState<MetaAdPlanActivationResponse | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [assistResult, setAssistResult] = useState<MetaAdPlanAssistResponse | null>(null);
  const [assistError, setAssistError] = useState<string | null>(null);

  // Handle incoming prefill updates
  useEffect(() => {
    let activePrefill = prefill;
    if (!activePrefill && typeof window !== "undefined") {
      try {
        const pendingRaw = localStorage.getItem("sahm_campaign_wizard_prefill_pending");
        if (pendingRaw) {
          activePrefill = JSON.parse(pendingRaw);
          localStorage.removeItem("sahm_campaign_wizard_prefill_pending");
        }
      } catch {}
    }

    if (activePrefill) {
      const parsedState = parsePrefillToState(activePrefill);
      setState(parsedState);
      setIsAiPrefilled(true);
      if (parsedState.name && parsedState.audienceName) {
        setStep("review");
      }
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ state: parsedState, step: "review" }));
      } catch {}
      setPrefill(null);
    } else if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.state?.name || parsed?.state?.audienceName) {
            setHasDraftRestored(true);
          }
        }
      } catch {}
    }
  }, [prefill, setPrefill]);

  // Auto-save draft changes to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ state, step }));
    } catch {}
  }, [state, step]);

  const discardDraft = () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {}
    setState({
      name: "",
      objective: "sales",
      dailyBudget: 500,
      currency: "EGP",
      startDate: today(),
      endDate: "",
      audienceName: "جمهور واسع",
      audienceId: null,
      audienceLibraryId: null,
      audienceDescription: "",
      audienceSource: "manual",
      ageMin: 18,
      ageMax: 65,
      gender: "all",
      locations: "Cairo, EG",
      targetingTargets: [],
      brief: "",
      strategy: null,
      creativeIds: [],
      destinationUrl: "",
      primaryText: "",
      headline: "",
      callToActionType: "LEARN_MORE",
      billingEvent: null,
      optimizationGoal: null,
      destinationType: null,
      specialAdCategories: [],
      instagramActorId: "",
      countries: ["EG"],
    });
    setStep("goal");
    setHasDraftRestored(false);
    setIsAiPrefilled(false);
  };

  const set = <K extends keyof WizardState>(k: K, v: WizardState[K]) => {
    setAssistResult(null);
    setAssistError(null);
    const targetingFields: Array<keyof WizardState> = [
      "audienceName", "audienceDescription", "ageMin", "ageMax", "gender",
      "locations", "countries", "targetingTargets",
    ];
    setState((s) => ({
      ...s,
      [k]: v,
      ...(targetingFields.includes(k) ? { audienceId: null } : {}),
      ...(k === "objective"
        ? { billingEvent: null, optimizationGoal: null, destinationType: null }
        : {}),
    }));
  };

  const selectSavedAudience = (value: string) => {
    setAudienceSaveMessage(null);
    if (value === "new") {
      setState((current) => ({
        ...current,
        audienceId: null,
        audienceLibraryId: null,
        audienceSource: "manual",
        audienceDescription: "",
      }));
      return;
    }
    const saved = savedAudiences.data?.find((audience) => audience.id === value);
    if (!saved) return;
    const genders = saved.targeting.genders;
    const gender: WizardState["gender"] =
      genders.includes("male") && !genders.includes("female")
        ? "male"
        : genders.includes("female") && !genders.includes("male")
          ? "female"
          : "all";
    setState((current) => ({
      ...current,
      audienceId: saved.id,
      audienceLibraryId: saved.id,
      audienceName: saved.name,
      audienceDescription: saved.description ?? "",
      audienceSource: saved.source,
      ageMin: saved.targeting.ageMin,
      ageMax: saved.targeting.ageMax,
      gender,
      locations: saved.targeting.locations.join(", "),
      countries: saved.targeting.countries,
      targetingTargets: saved.targeting.targetingTargets.length
        ? saved.targeting.targetingTargets
        : saved.targeting.interestTargets.map((target) => ({ ...target, category: "interests" as const })),
    }));
    setTargetingQuery("");
  };

  const suggestAudienceIdeas = async () => {
    setAudienceSuggestionError(null);
    setAudienceMissingInputs([]);
    try {
      const result = await suggestAudience.mutateAsync({
        campaignName: state.name.trim(),
        objective: state.objective as CampaignObjective,
        brief: state.brief.trim() || undefined,
        countries: state.countries,
        language: locale === "ar" ? "ar" : "en",
      });
      setAudienceIdeas(result.suggestions);
      setAudienceMissingInputs(result.missingInputs);
    } catch (error) {
      setAudienceSuggestionError(error instanceof Error ? error.message : String(error));
    }
  };

  const saveAudience = async () => {
    setAudienceSaveMessage(null);
    const targeting = {
      ageMin: state.ageMin,
      ageMax: state.ageMax,
      genders: [state.gender],
      locations: state.locations.split(",").map((location) => location.trim()).filter(Boolean),
      countries: state.countries,
      interests: state.targetingTargets
        .filter((target) => target.category === "interests")
        .map((target) => target.name),
      interestTargets: state.targetingTargets
        .filter((target) => target.category === "interests")
        .map(({ id, name }) => ({ id, name })),
      targetingTargets: state.targetingTargets,
      behaviors: state.targetingTargets
        .filter((target) => target.category === "behaviors")
        .map((target) => target.name),
    };
    const payload = {
      name: state.audienceName.trim(),
      description: state.audienceDescription.trim() || null,
      targeting,
      source: state.audienceSource,
    };
    try {
      const saved = state.audienceLibraryId
        ? await updateAudience.mutateAsync({ id: state.audienceLibraryId, patch: payload })
        : await createAudience.mutateAsync(payload);
      setState((current) => ({
        ...current,
        audienceId: saved.id,
        audienceLibraryId: saved.id,
        audienceName: saved.name,
        audienceDescription: saved.description ?? "",
        audienceSource: saved.source,
      }));
      setAudienceSaveMessage(
        state.audienceLibraryId ? t("audience.updateSuccess") : t("audience.saveSuccess"),
      );
    } catch (error) {
      setAudienceSaveMessage(error instanceof Error ? error.message : t("audience.saveFailed"));
    }
  };

  const archiveSelectedAudience = async () => {
    if (!state.audienceLibraryId) return;
    if (typeof window !== "undefined" && !window.confirm(t("audience.archiveConfirm"))) return;
    try {
      await archiveAudience.mutateAsync(state.audienceLibraryId);
      setState((current) => ({
        ...current,
        audienceId: null,
        audienceLibraryId: null,
        audienceSource: "manual",
      }));
      setAudienceSaveMessage(t("audience.archiveSuccess"));
    } catch (error) {
      setAudienceSaveMessage(error instanceof Error ? error.message : t("audience.archiveFailed"));
    }
  };

  const applyAudienceIdea = (idea: AudienceIdea) => {
    setState((current) => ({
      ...current,
      audienceId: null,
      audienceLibraryId: null,
      audienceName: idea.name,
      audienceDescription: idea.summary,
      audienceSource: "ai",
    }));
    setAudienceSaveMessage(null);
  };

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
      id: state.audienceId ?? undefined,
      name: state.audienceName.trim(),
      description: state.audienceDescription || null,
      ageMin: state.ageMin,
      ageMax: state.ageMax,
      genders: [state.gender],
      locations: state.locations.split(",").map((s) => s.trim()).filter(Boolean),
      countries: state.countries,
      interests: state.targetingTargets
        .filter((target) => target.category === "interests")
        .map((target) => target.name),
      interestTargets: state.targetingTargets
        .filter((target) => target.category === "interests")
        .map(({ id, name }) => ({ id, name })),
      targetingTargets: state.targetingTargets,
      behaviors: state.targetingTargets
        .filter((target) => target.category === "behaviors")
        .map((target) => target.name),
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
    const detailedTargeting = buildMetaDetailedTargeting(state.targetingTargets);
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
      // Only explicitly selected Meta results are included under documented
      // fields; AI phrases and plain-text audience names are never sent.
      ...detailedTargeting,
    },
    billingEvent: derived.billingEvent,
    optimizationGoal: derived.optimizationGoal,
    // Keep the current explicit no-special-category state unless MCP returns an
    // exact, validated value from a brief that states one.
    specialAdCategories: [...state.specialAdCategories],
    destinationType: derived.destinationType,
    // Left unset: needs a Meta Pixel / app object the workspace owner configures.
    promotedObject: undefined,
    destinationUrl: state.destinationUrl.trim() || undefined,
    primaryText: state.primaryText.trim() || undefined,
    headline: state.headline.trim() || undefined,
    callToAction: {
      type: state.callToActionType || "LEARN_MORE",
      value: { link: state.destinationUrl.trim() },
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
    if (!preparedPlan || !getMetaPlanRecoveryAction(planExecution)) return;
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
  const recoveryAction = getMetaPlanRecoveryAction(planExecution);
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
          interests: state.targetingTargets
            .filter((target) => target.category === "interests")
            .map((target) => target.name),
          behaviors: state.targetingTargets
            .filter((target) => target.category === "behaviors")
            .map((target) => target.name),
        },
      },
      { onSuccess: (s) => set("strategy", s) },
    );

  const metaConnected = meta.data?.campaignReady === true;

  const requestMetaAssist = async () => {
    if (!state.strategy || !state.objective) return;
    const derived = META_OBJECTIVE_DEFAULTS[state.objective] ?? META_OBJECTIVE_DEFAULTS.traffic;
    setAssistError(null);
    setAssistResult(null);
    try {
      const result = await assistMetaPlan.mutateAsync({
        campaignName: state.name,
        objective: state.objective,
        dailyBudget: state.dailyBudget,
        currency: state.currency,
        brief: state.brief || undefined,
        language: locale === "ar" ? "ar" : "en",
        strategy: state.strategy,
        audience: {
          name: state.audienceName,
          ageMin: state.ageMin,
          ageMax: state.ageMax,
          gender: state.gender,
          countries: [...state.countries],
          interests: state.targetingTargets
            .filter((target) => target.category === "interests")
            .map((target) => target.name),
        },
        destinationUrl: state.destinationUrl || undefined,
        primaryText: state.primaryText,
        headline: state.headline,
        callToActionType: state.callToActionType || undefined,
        billingEvent: derived.billingEvent,
        optimizationGoal: derived.optimizationGoal,
        destinationType: derived.destinationType,
        specialAdCategories: [...state.specialAdCategories],
      });
      setState((current) => ({
        ...current,
        primaryText: current.primaryText.trim() ? current.primaryText : result.primaryText ?? current.primaryText,
        headline: current.headline.trim() ? current.headline : result.headline ?? current.headline,
        callToActionType:
          result.fieldValidation.callToActionType === "valid" && result.callToActionType
            ? result.callToActionType
            : current.callToActionType,
        // Billing, performance goal, and destination remain objective-derived;
        // the MCP context validates them but never overrides the fixed mapping.
        specialAdCategories:
          result.fieldValidation.specialAdCategories === "valid" && result.specialAdCategories
            ? result.specialAdCategories
            : current.specialAdCategories,
      }));
      setAssistResult(result);
    } catch (error) {
      setAssistError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PageHeader title={t("title")} />
        {(hasDraftRestored || isAiPrefilled || state.name) && (
          <Button variant="ghost" size="sm" onClick={discardDraft} className="text-muted-foreground hover:text-destructive">
            {t("launch.discardDraft")}
          </Button>
        )}
      </div>

      {isAiPrefilled && (
        <div className="mb-4 flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span>{t("launch.aiPrefilledBanner")}</span>
          </div>
        </div>
      )}

      {hasDraftRestored && !isAiPrefilled && (
        <div className="mb-4 flex items-center justify-between rounded-md border border-muted bg-muted/40 p-2.5 text-xs text-muted-foreground">
          <span>{t("launch.draftRestored")}</span>
          <button type="button" onClick={discardDraft} className="font-medium underline hover:text-destructive">
            {t("launch.discardDraft")}
          </button>
        </div>
      )}

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
              <div className="space-y-4 sm:col-span-2">
                <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2 sm:items-end">
                  <div className="space-y-1.5">
                    <Label>{t("audience.savedLabel")}</Label>
                    <p className="text-xs text-muted-foreground">{t("audience.libraryHint")}</p>
                  </div>
                  <Select value={state.audienceLibraryId ?? "new"} onValueChange={selectSavedAudience}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("audience.savedPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">{t("audience.buildNew")}</SelectItem>
                      {(savedAudiences.data ?? []).map((audience) => (
                        <SelectItem key={audience.id} value={audience.id}>
                          {audience.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!savedAudiences.isLoading && savedAudiences.data?.length === 0 && (
                    <p className="text-xs text-muted-foreground sm:col-span-2">{t("audience.emptyLibrary")}</p>
                  )}
                  {savedAudiences.isError && (
                    <p role="alert" className="text-xs text-destructive sm:col-span-2">
                      {t("audience.libraryLoadFailed")}
                    </p>
                  )}
                </div>

                <div className="space-y-2 rounded-lg border border-dashed p-3">
                  <div>
                    <Label htmlFor="audience-brief">{t("audience.helperBrief")}</Label>
                    <p className="mt-1 text-xs text-muted-foreground">{t("audience.helperHint")}</p>
                  </div>
                  <Textarea
                    id="audience-brief"
                    value={state.brief}
                    onChange={(event) => set("brief", event.target.value)}
                    placeholder={t("audience.helperPlaceholder")}
                    rows={2}
                    maxLength={4000}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={suggestAudienceIdeas}
                    disabled={!state.name.trim() || suggestAudience.isPending}
                  >
                    {suggestAudience.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Sparkles className="me-2 h-4 w-4" />}
                    {suggestAudience.isPending ? t("audience.suggesting") : t("audience.suggest")}
                  </Button>
                  {audienceSuggestionError && (
                    <p role="alert" className="text-xs text-destructive">{audienceSuggestionError}</p>
                  )}
                  {audienceMissingInputs.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {t("audience.missingInputs", { inputs: audienceMissingInputs.join(" · ") })}
                    </p>
                  )}
                  {audienceIdeas.length > 0 && (
                    <div className="grid gap-2 pt-1 md:grid-cols-2">
                      {audienceIdeas.map((idea, index) => {
                        const searchTerms = [
                          ...idea.targetingSearchTerms,
                          ...idea.interestSearchTerms.map((term) => ({ category: "interests" as const, term })),
                        ].filter((item, itemIndex, all) =>
                          all.findIndex((candidate) => candidate.category === item.category && candidate.term === item.term) === itemIndex,
                        );
                        return (
                          <div key={`${idea.name}-${index}`} className="space-y-2 rounded-md border bg-muted/20 p-3">
                            <div>
                              <p className="text-sm font-medium">{idea.name}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{idea.summary}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{idea.rationale}</p>
                            </div>
                            <Button type="button" size="sm" variant="secondary" onClick={() => applyAudienceIdea(idea)}>
                              {t("audience.useSuggestion")}
                            </Button>
                            {searchTerms.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">{t("audience.searchTermsHint")}</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {searchTerms.map(({ category, term }, termIndex) => (
                                    <Button
                                      key={`${category}-${term}-${termIndex}`}
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setTargetingCategory(category);
                                        setTargetingQuery(term);
                                      }}
                                    >
                                      <span className="me-1 text-muted-foreground">{targetingCategoryLabels[category]}:</span>
                                      {term}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={saveAudience}
                    disabled={createAudience.isPending || updateAudience.isPending || state.audienceName.trim().length < 2}
                  >
                    {(createAudience.isPending || updateAudience.isPending) && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                    {state.audienceLibraryId ? t("audience.updateSaved") : t("audience.saveToLibrary")}
                  </Button>
                  {state.audienceLibraryId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={archiveSelectedAudience}
                      disabled={archiveAudience.isPending}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      {archiveAudience.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                      {t("audience.archive")}
                    </Button>
                  )}
                  {audienceSaveMessage && (
                    <p role="status" className="text-xs text-muted-foreground">{audienceSaveMessage}</p>
                  )}
                </div>
              </div>

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
              <div className="space-y-3 sm:col-span-2">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                  <div className="space-y-1.5">
                    <Label htmlFor="targeting-category">{t("audience.targetingCategory")}</Label>
                    <Select
                      value={targetingCategory}
                      onValueChange={(value) => setTargetingCategory(value as TargetingCategory)}
                    >
                      <SelectTrigger id="targeting-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TARGETING_CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {targetingCategoryLabels[category]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="targeting-search">
                      {t("audience.searchWithinCategory", { category: targetingCategoryLabels[targetingCategory] })}
                    </Label>
                    <Input
                      id="targeting-search"
                      value={targetingQuery}
                      onChange={(event) => setTargetingQuery(event.target.value)}
                      placeholder={t("audience.targetingPlaceholder")}
                      autoComplete="off"
                    />
                    {targetingQueryHasSeparators && (
                      <p className="text-xs text-muted-foreground">
                        {t("audience.targetingLastTermOnly")}
                      </p>
                    )}
                  </div>
                </div>

                {state.targetingTargets.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {state.targetingTargets.map((target) => (
                      <span
                        key={`${target.category}:${target.id}`}
                        className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-muted/40 px-2 py-1 text-xs"
                      >
                        <span className="text-muted-foreground">{targetingCategoryLabels[target.category]}</span>
                        <span className="font-medium">{target.name}</span>
                        <code className="max-w-28 truncate text-[10px] text-muted-foreground">{target.id}</code>
                        <button
                          type="button"
                          className="p-0.5 text-muted-foreground hover:text-foreground"
                          aria-label={t("audience.removeTargeting", { name: target.name })}
                          onClick={() =>
                            set(
                              "targetingTargets",
                              state.targetingTargets.filter(
                                (selected) => selected.category !== target.category || selected.id !== target.id,
                              ),
                            )
                          }
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {targetingOptions.length > 0 && (
                  <div className="space-y-1.5">
                    {targetingOptions.map((result) => (
                      <Button
                        key={`${result.category}:${result.id}`}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-auto w-full justify-start py-2 text-start"
                        disabled={state.targetingTargets.length >= 20}
                        onClick={() => {
                          set("targetingTargets", [
                            ...state.targetingTargets,
                            { id: result.id, name: result.name, category: result.category },
                          ]);
                          setTargetingQuery("");
                        }}
                      >
                        <Plus className="me-2 h-3 w-3 shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{result.name}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                              {targetingCategoryLabels[result.category]}
                            </Badge>
                            <span>{t("audience.metaId", { id: result.id })}</span>
                          </span>
                          {result.description && (
                            <span className="mt-1 block whitespace-normal text-xs text-muted-foreground">
                              {result.description}
                            </span>
                          )}
                        </span>
                      </Button>
                    ))}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  {!targetingSearch.isDebouncing && targetingSearch.data && !targetingSearch.data.available
                    ? t("audience.targetingUnavailable", { category: targetingCategoryLabels[targetingCategory] })
                    : t("audience.targetingHint")}
                </p>
                {state.targetingTargets.length >= 20 && (
                  <p className="text-xs text-muted-foreground">{t("audience.targetingLimit")}</p>
                )}
                {targetingSearchTerm.length >= 2 &&
                  (targetingSearch.isDebouncing || targetingSearch.isFetching) && (
                    <p className="text-xs text-muted-foreground" aria-live="polite">
                      {t("audience.targetingSearching")}
                    </p>
                  )}
                {targetingSearchHasNoResults && (
                  <p className="text-xs text-muted-foreground">
                    {t("audience.targetingNoResults", { category: targetingCategoryLabels[targetingCategory] })}
                  </p>
                )}
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
            <div className="space-y-4">
              <dl className="grid gap-4 text-sm sm:grid-cols-2">
                <ReviewItem label={t("review.goal")}>
                  <p className="font-medium text-base text-foreground">{state.name}</p>
                  <p className="text-muted-foreground mt-0.5">
                    {to(state.objective as CampaignObjective)} · {formatCurrency(state.dailyBudget, state.currency, locale)}/day
                  </p>
                  {state.startDate && state.endDate && (
                    <p className="text-xs text-muted-foreground mt-1">
                      📅 {state.startDate} → {state.endDate}
                    </p>
                  )}
                </ReviewItem>
                <ReviewItem label={t("review.audience")}>
                  <p className="font-medium">{state.audienceName}</p>
                  <p className="text-muted-foreground mt-0.5">
                    {state.ageMin}–{state.ageMax} · {state.gender === "all" ? "الكل" : state.gender === "male" ? "رجال" : "نساء"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    📍 {state.locations}
                  </p>
                  {state.targetingTargets.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      🎯 {state.targetingTargets
                        .map((target) => `${targetingCategoryLabels[target.category]}: ${target.name}`)
                        .join(", ")}
                    </p>
                  )}
                </ReviewItem>
                <ReviewItem label={t("review.strategy")}>
                  <p className="line-clamp-4 text-xs leading-relaxed">{state.strategy?.summary ?? t("review.noStrategy")}</p>
                </ReviewItem>
                <ReviewItem label={t("review.creatives")}>
                  <p className="font-medium">{t("review.creativeCount", { count: state.creativeIds.length })}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {state.creativeIds.length > 0 ? "جاهزة للإطلاق" : "سيتم توليد المحتوى الإعلاني تلقائياً وفق الاستراتيجية"}
                  </p>
                </ReviewItem>
              </dl>
              <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => {
                    try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch {}
                    dispatch({ type: "CREATE_CAMPAIGN", payload: { draft: draft() } });
                  }}
                >
                  {t("launch.saveDraft")}
                </Button>
                <Button
                  size="sm"
                  onClick={() => setStep("launch")}
                >
                  {t("launch.reviewPlan")}
                </Button>
              </div>
            </div>
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
                  <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium">{t("launch.assistTitle")}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{t("launch.assistHint")}</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!state.strategy || !metaConnected || assistMetaPlan.isPending || !!errors.goal || !!errors.audience}
                        onClick={requestMetaAssist}
                      >
                        {assistMetaPlan.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Sparkles className="me-2 h-4 w-4" />}
                        {assistMetaPlan.isPending ? t("launch.assistPending") : t("launch.assistButton")}
                      </Button>
                    </div>
                    {!state.strategy && <p className="mt-2 text-xs text-muted-foreground">{t("launch.assistNeedsStrategy")}</p>}
                    {!metaConnected && <p className="mt-2 text-xs text-muted-foreground">{t("launch.assistNeedsConnection")}</p>}
                    {assistError && <p role="alert" className="mt-2 text-sm text-destructive">{assistError}</p>}
                    {assistResult && (
                      <div className="mt-3 space-y-2 border-t border-primary/10 pt-3 text-xs">
                        <p className="font-medium">
                          {assistResult.mcpContextAvailable ? t("launch.assistContextReady") : t("launch.assistContextUnavailable")}
                        </p>
                        <p className="text-muted-foreground">{t("launch.assistDraftOnly")}</p>
                        {assistResult.assumptions.length > 0 && (
                          <div>
                            <p className="font-medium">{t("launch.assistAssumptions")}</p>
                            <ul className="mt-1 list-inside list-disc text-muted-foreground">
                              {assistResult.assumptions.map((item, index) => <li key={`assumption-${index}`}>{item}</li>)}
                            </ul>
                          </div>
                        )}
                        {assistResult.missingInputs.length > 0 && (
                          <div>
                            <p className="font-medium">{t("launch.assistMissing")}</p>
                            <ul className="mt-1 list-inside list-disc text-muted-foreground">
                              {assistResult.missingInputs.map((item, index) => <li key={`missing-${index}`}>{item}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
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
                          {t(
                            retryReview
                              ? recoveryAction === "resume"
                                ? "launch.confirmResume"
                                : "launch.confirmRetry"
                              : "launch.confirmPaused",
                          )}
                        </Button>
                      )}
                      {planExecution && (
                        <div className={cn("rounded-md border p-3 text-sm", planExecution.executed ? "border-emerald-500/30 bg-emerald-500/10" : "border-destructive/30 bg-destructive/5")}>
                          <p className="font-medium">{planExecution.message}</p>
                          {planExecution.recommendation.executionResult && (
                            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs" dir="ltr">{JSON.stringify(planExecution.recommendation.executionResult, null, 2)}</pre>
                          )}
                          {recoveryAction && !retryReview && (
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                              <p className="text-xs text-muted-foreground">
                                {t(
                                  recoveryAction === "resume"
                                    ? getResumeStage(planExecution) === "creative"
                                      ? "launch.resumeCreativeHint"
                                      : "launch.resumeSafeHint"
                                    : "launch.retrySafeHint",
                                )}
                              </p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={confirmMetaPlan.isPending || previewMetaPlan.isPending || !metaConnected}
                                onClick={reviewSafeMetaRetry}
                              >
                                {previewMetaPlan.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                                {t(recoveryAction === "resume" ? "launch.resumeMetaCreation" : "launch.retryMetaCreation")}
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
