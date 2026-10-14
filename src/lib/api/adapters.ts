/* eslint-disable @typescript-eslint/no-explicit-any -- `Json` is the backend's
   untyped JSON; narrowing happens at every mapper via the `str`/`num`/`opt` helpers. */
/**
 * Wire adapters between the FastAPI backend (`sahm-ai backend`) and the
 * frontend's domain types.
 *
 * Why this file exists
 * --------------------
 * The backend speaks two dialects:
 *   1. camelCase  — every schema inheriting `ApiModel` (pydantic `to_camel` alias).
 *   2. snake_case — every schema inheriting `ToolOutput` (`ReferenceAnalysis`,
 *                   `GeneratedAsset`, `InsightsPayload`, `BreakdownPayload`).
 *
 * On top of that the backend's payloads are *narrower* than the shapes this UI
 * renders (a `Campaign` there has 15 fields, here it needs 17 with different
 * names). So `HttpApi` calls the raw endpoints, runs the payload through the
 * functions below, and only then validates against the existing Zod schemas.
 * That keeps every component untouched.
 *
 * Nothing in here talks to the network — it is pure data transformation, so it
 * is cheap to reason about and easy to test.
 */

import { ActionTypeSchema, AudienceTargetingSchema, CampaignAudienceSnapshotSchema, MEMORY_KINDS, TargetingCategorySchema } from "@/types";
import type {
  ActionType,
  Agent,
  AgentTask,
  AnyBlock,
  AuditEntry,
  AuditList,
  AuthSession,
  AuthUser,
  BrandProfile,
  Business,
  BusinessProfileForm,
  Campaign,
  Connector,
  ConnectorDeleteResult,
  ConnectorField,
  ConnectorSettings,
  ConnectorSource,
  ContentChannel,
  ContentFormat,
  ContentItem,
  ContentStatus,
  Conversation,
  Creative,
  CreativeReference,
  Insight,
  MemoryItem,
  MemoryItemList,
  Message,
  MessageBlock,
  MetaConnection,
  MetaAccountCampaignPage,
  Recommendation,
  ReferenceAnalysis,
  Role,
  SessionInfo,
  Settings,
  Usage,
  UsageBreakdown,
  WorkspaceMembership,
} from "@/types";

type ActionCardBlock = Extract<MessageBlock, { type: "action_card" }>;
type ErrorBlock = Extract<MessageBlock, { type: "error" }>;
type FindingsBlock = Extract<MessageBlock, { type: "findings" }>;
type FindingsItem = FindingsBlock["items"][number];
type MetricBlock = Extract<MessageBlock, { type: "metric" }>;
type TaskProgressBlock = Extract<MessageBlock, { type: "task_progress" }>;

/* -------------------------------------------------------------------------- */
/* Primitive coercion helpers                                                 */
/* -------------------------------------------------------------------------- */

type Json = Record<string, any>;

export function isRecord(v: unknown): v is Json {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** String or `fallback` when missing/blank. */
export function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() !== "" ? v : fallback;
}

/** Finite number, coercing numeric strings. `fallback` otherwise. */
export function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return fallback;
}

export function bool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

/** `null`/`undefined` → `undefined`, so optional Zod fields stay optional. */
export function opt<T>(v: T | null | undefined): T | undefined {
  return v === null || v === undefined ? undefined : v;
}

/**
 * A backend string that may legitimately be absent → `null`, never `""`.
 *
 * `nullableStr(x)` looks equivalent but is NOT: `str(null)` returns the
 * empty-string fallback, `opt("")` returns `""` (not undefined), so `?? null`
 * never fires. The mapper then hands an empty string to a schema such as
 * `IsoDateSchema = z.string().min(1)` and the whole response fails validation.
 * Use this instead.
 */
export function nullableStr(v: unknown): string | null {
  const s = str(v);
  return s === "" ? null : s;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function asArray(v: unknown): Json[] {
  return Array.isArray(v) ? (v as Json[]) : [];
}

/** `YYYY-MM-DD`-ish safe passthrough; the schemas were loosened to accept it. */
export function iso(v: unknown): string {
  if (typeof v === "string" && v.trim() !== "") return v;
  if (v instanceof Date) return v.toISOString();
  return new Date().toISOString();
}

export type Objective = "awareness" | "traffic" | "engagement" | "leads" | "sales" | "app_installs";

/** The backend stores `objective` as a free-text string; the UI needs an enum. */
export function mapObjective(v: unknown): Objective {
  const s = str(v).toLowerCase();
  if (!s) return "awareness";
  if (/(app[_ -]?install|download)/.test(s)) return "app_installs";
  if (/(sale|revenue|purchase|roas|conver)/.test(s)) return "sales";
  if (/(lead|sign[_ -]?up|message|enquir|submi)/.test(s)) return "leads";
  if (/(engage|communit|comment|like|share)/.test(s)) return "engagement";
  if (/(traffic|click|visit|link|lp|landing)/.test(s)) return "traffic";
  if (/(awareness|reach|brand|impression|know)/.test(s)) return "awareness";
  return "awareness";
}

export type CampaignStatus = "draft" | "scheduled" | "active" | "paused" | "completed" | "failed";

export function mapCampaignStatus(v: unknown): CampaignStatus {
  const s = str(v).toLowerCase();
  if (s === "active" || s === "running" || s === "launched" || s === "live") return "active";
  if (s === "paused" || s === "hold") return "paused";
  if (s === "completed" || s === "archived" || s === "ended") return "completed";
  if (s === "scheduled" || s === "queued") return "scheduled";
  if (s === "failed" || s === "error") return "failed";
  return "draft";
}

/** `CampaignSchema.currency` is exactly 3 chars. */
export function mapCurrency(v: unknown): string {
  const s = str(v).trim().toUpperCase();
  return /^[A-Z]{3}$/.test(s) ? s : "USD";
}

const ASPECT_RATIOS = ["1:1", "4:5", "9:16", "16:9"] as const;

/** The UI only renders four ratios; anything else is dropped. */
export function mapAspectRatio(v: unknown): (typeof ASPECT_RATIOS)[number] | undefined {
  const s = str(v).trim();
  return (ASPECT_RATIOS as readonly string[]).includes(s) ? (s as (typeof ASPECT_RATIOS)[number]) : undefined;
}

/* -------------------------------------------------------------------------- */
/* Error envelope                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The backend returns `{"error": {"code", "message", "detail", "requestId"}}`.
 * The old client parsed a flat `{code, message, details}` shape, so every real
 * message was silently discarded. This normalises both dialects.
 */
export function normalizeErrorBody(body: unknown): { code: string; message: string; details?: Record<string, unknown> } {
  if (isRecord(body) && isRecord(body.error)) {
    const e = body.error;
    const details: Record<string, unknown> = isRecord(e.detail) ? { ...e.detail } : {};
    if (e.requestId) details.requestId = e.requestId;
    return {
      code: str(e.code, "HTTP_ERROR"),
      message: str(e.message, "Request failed"),
      details: Object.keys(details).length ? details : undefined,
    };
  }
  if (isRecord(body) && typeof body.code === "string") {
    return {
      code: body.code,
      message: str(body.message, "Request failed"),
      details: isRecord(body.details) ? body.details : undefined,
    };
  }
  return { code: "HTTP_ERROR", message: "Request failed" };
}

/* -------------------------------------------------------------------------- */
/* Business / brand                                                           */
/* -------------------------------------------------------------------------- */

export function mapBusiness(profile: Json): Business {
  const goals = asArray(profile.goals).map((g) => str(g)).filter(Boolean);
  return {
    id: str(profile.businessId, "biz_unknown"),
    name: str(profile.name, "My Business"),
    industry: str(profile.industry, "General"),
    website: (nullableStr(profile.websiteUrl) ?? undefined),
    country: (str(profile.country, "EG") || "EG").slice(0, 2).toUpperCase(),
    description: goals.length ? goals.join(" · ") : str(profile.industry, "General"),
    createdAt: iso(profile.updatedAt),
  };
}

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function mapBrandProfile(profile: Json): BrandProfile {
  const visual = str(profile.visualStyle);
  const palette = visual.match(/#[0-9a-f]{3,6}/gi) ?? [];
  return {
    id: str(profile.businessId, "bp_unknown"),
    businessId: str(profile.businessId, "biz_unknown"),
    tone: str(profile.brandVoice) ? [str(profile.brandVoice)] : [],
    values: asArray(profile.keyOffers).map((v) => str(v)).filter(Boolean),
    primaryColor: palette.find((c) => HEX_COLOR.test(c)) ?? "#111827",
    secondaryColor: palette.length > 1 ? palette[1] : undefined,
    logoUrl: undefined,
    tagline: (nullableStr(profile.targetAudience) ?? undefined),
    doNotUse: asArray(profile.competitors).map((c) => str(c)).filter(Boolean),
    languages: [str(profile.language, "en") === "ar" ? "ar" : "en"],
  };
}

/* -------------------------------------------------------------------------- */
/* Campaigns                                                                  */
/* -------------------------------------------------------------------------- */

function mapCampaignAudienceSnapshot(raw: unknown) {
  if (!isRecord(raw)) return null;
  const source = isRecord(raw.targeting) ? raw.targeting : {};
  const list = (value: unknown) => asArray(value).map((item) => str(item)).filter(Boolean);
  const genders = list(source.genders).filter((value) => value === "all" || value === "male" || value === "female");
  const rawTargetingTargets = asArray(source.targetingTargets ?? source.targeting_targets);
  const parsedTargetingTargets = rawTargetingTargets.flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = str(item.id);
    const name = str(item.name);
    if (!id || !name) return [];
    const rawCategory = item.category;
    if (rawCategory === undefined || rawCategory === null || rawCategory === "") {
      return [{ id, name, category: "interests" as const }];
    }
    const category = TargetingCategorySchema.safeParse(rawCategory);
    return category.success ? [{ id, name, category: category.data }] : [];
  });
  const legacyInterestTargets = asArray(source.interestTargets ?? source.interest_targets).flatMap((item) => {
    if (!isRecord(item)) return [];
    const id = str(item.id);
    const name = str(item.name);
    return id && name ? [{ id, name }] : [];
  });
  const interestTargets = legacyInterestTargets.length
    ? legacyInterestTargets
    : parsedTargetingTargets
        .filter((item) => item.category === "interests")
        .map(({ id, name }) => ({ id, name }));
  const targetingTargets = parsedTargetingTargets.length
    ? parsedTargetingTargets
    : interestTargets.map(({ id, name }) => ({ id, name, category: "interests" as const }));
  const targeting = AudienceTargetingSchema.parse({
    ageMin: num(source.ageMin ?? source.age_min, 18),
    ageMax: num(source.ageMax ?? source.age_max, 65),
    genders: genders.length ? genders : ["all"],
    locations: list(source.locations),
    countries: list(source.countries),
    interests: list(source.interests),
    interestTargets,
    targetingTargets,
    behaviors: list(source.behaviors),
  });
  return CampaignAudienceSnapshotSchema.parse({
    id: str(raw.id),
    name: str(raw.name, "Saved audience"),
    description: nullableStr(raw.description),
    targeting,
  });
}

export function mapCampaign(raw: Json, detail?: Json): Campaign {
  const creatives = asArray(detail?.creatives);
  const creativeIds = creatives.map((c) => str(c.id)).filter(Boolean);
  const insightMetrics = isRecord(detail?.recentInsights) ? detail!.recentInsights.metrics : undefined;
  const metrics = isRecord(insightMetrics)
    ? {
        impressions: num(insightMetrics.impressions),
        reach: num(insightMetrics.reach, num(insightMetrics.impressions)),
        clicks: num(insightMetrics.clicks),
        ctr: num(insightMetrics.ctr),
        cpc: num(insightMetrics.cpc),
        cpm: num(insightMetrics.cpm),
        conversions: num(insightMetrics.conversions),
        cpa: num(insightMetrics.cpa),
        roas: num(insightMetrics.roas),
        spend: num(insightMetrics.spend),
      }
    : null;
  return {
    id: str(raw.id),
    businessId: str(raw.businessId, "biz_unknown"),
    name: str(raw.name, "Untitled campaign"),
    objective: mapObjective(raw.objective),
    status: mapCampaignStatus(raw.status),
    dailyBudget: num(raw.budget),
    currency: mapCurrency(raw.currency),
    startDate: iso(raw.startDate ?? raw.createdAt),
    endDate: opt(raw.endDate) ? iso(raw.endDate) : null,
    audienceId: nullableStr(raw.audienceId ?? raw.audience_id),
    audienceSnapshot: mapCampaignAudienceSnapshot(raw.audienceSnapshot ?? raw.audience_snapshot),
    strategy: null,
    creativeIds: creativeIds.length ? creativeIds : [],
    metaCampaignId: nullableStr(raw.metaCampaignId),
    metrics,
    healthScore: null,
    createdAt: iso(raw.createdAt),
    updatedAt: iso(raw.updatedAt),
  };
}

/** `CampaignDraft` (UI) → backend `CampaignCreateRequest`. */
export function toCampaignCreateBody(draft: Json): Json {
  const audience = isRecord(draft.audience) ? draft.audience : {};
  const audienceLabel = [str(audience.name), asArray(audience.locations).map((l) => str(l)).filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(" · ");
  return {
    name: str(draft.name),
    objective: str(draft.objective),
    channel: "meta_ads",
    budget: num(draft.dailyBudget),
    currency: mapCurrency(draft.currency),
    startDate: iso(draft.startDate),
    endDate: draft.endDate ? iso(draft.endDate) : null,
    targetAudience: audienceLabel || null,
    audienceId: nullableStr(audience.id),
    notes: null,
  };
}

/* -------------------------------------------------------------------------- */
/* Creatives                                                                  */
/* -------------------------------------------------------------------------- */

export function mapCreative(raw: Json): Creative {
  const url = str(raw.url) || str(raw.assetUrl) || str(raw.thumbnailUrl);
  const created = iso(raw.createdAt);
  return {
    id: str(raw.id),
    campaignId: nullableStr(raw.campaignId),
    kind: "image",
    title: str(raw.prompt, "Creative").slice(0, 80),
    status: str(raw.status, "ready") === "ready" ? "ready" : "draft",
    prompt: str(raw.prompt) || undefined,
    assetUrl: url || undefined,
    thumbnailUrl: url || undefined,
    // Tool outputs are plain BaseModels with no alias generator, so this field
    // arrives snake_case from the backend; camelCase is kept for the mocks.
    aspectRatio: mapAspectRatio(raw.aspectRatio ?? raw.aspect_ratio),
    tags: [],
    createdAt: created,
    updatedAt: iso(raw.updatedAt ?? created),
  };
}

/** `StyleSpec` arrives camelCase already, but be defensive about nulls. */
function mapStyleSpec(raw: unknown): string[] {
  if (!isRecord(raw)) return [];
  return [str(raw.typography), str(raw.tone), str(raw.colorMood), ...asArray(raw.brandElements).map((b) => str(b))]
    .filter(Boolean);
}

export function mapReferenceAnalysis(raw: Json): ReferenceAnalysis {
  const style = isRecord(raw.style) ? raw.style : {};
  const observedOffers = asArray(raw.observedOffers).map((o) => str(o)).filter(Boolean);
  const observedCta = asArray(raw.observedCta).map((o) => str(o)).filter(Boolean);
  const elements = asArray(style.elements).filter(isRecord).map((element) => ({
    element: str(element.element),
    relativePosition: str(element.relativePosition ?? element.relative_position),
    relativeSize: str(element.relativeSize ?? element.relative_size),
    visualAttributes: str(element.visualAttributes ?? element.visual_attributes),
    exactText: str(element.exactText ?? element.exact_text),
    layerOrder: typeof element.layerOrder === "number"
      ? element.layerOrder
      : typeof element.layer_order === "number"
        ? element.layer_order
        : null,
  }));
  return {
    id: str(raw.id, "ref_unknown"),
    sourceUrl: (nullableStr(raw.source) ?? undefined),
    sourceName: str(raw.sourceName ?? raw.source_name ?? raw.model, "Reference creative"),
    kind: "image",
    status: (["ok", "partial", "unavailable"].includes(str(raw.status, "ok"))
      ? str(raw.status, "ok")
      : "ok") as ReferenceAnalysis["status"],
    unavailableReason: nullableStr(raw.unavailableReason ?? raw.unavailable_reason) ?? undefined,
    hook: str(style.hookType ?? style.hook_type),
    structure: [str(style.composition), str(style.layoutPattern ?? style.layout_pattern)].filter(Boolean),
    visualStyle: [str(style.typography), str(style.tone), str(style.colorMood ?? style.color_mood), ...asArray(style.palette).map((p) => str(p))].filter(Boolean),
    tone: [str(style.tone)].filter(Boolean),
    cta: observedCta[0],
    strengths: [],
    weaknesses: [],
    estimatedPerformance: "unknown",
    inspiredBrief: str(raw.summary, style.notes && str(style.notes)),
    style: {
      canvasRatio: str(style.canvasRatio ?? style.canvas_ratio),
      background: str(style.background),
      lighting: str(style.lighting),
      visibleText: asArray(style.visibleText ?? style.visible_text).map((item) => str(item)).filter(Boolean),
      elements,
      palette: asArray(style.palette).map((item) => str(item)).filter(Boolean),
      composition: str(style.composition),
      typography: str(style.typography),
      tone: str(style.tone),
      layoutPattern: str(style.layoutPattern ?? style.layout_pattern),
      hookType: str(style.hookType ?? style.hook_type),
      colorMood: str(style.colorMood ?? style.color_mood),
      textDensity: str(style.textDensity ?? style.text_density),
      brandElements: asArray(style.brandElements ?? style.brand_elements).map((item) => str(item)).filter(Boolean),
      notes: str(style.notes),
    },
    observedOffers,
    observedCta,
    createdAt: iso(raw.createdAt ?? raw.created_at),
  };
}

/* -------------------------------------------------------------------------- */
/* Insights                                                                   */
/* -------------------------------------------------------------------------- */

export function mapInsight(raw: Json): Insight {
  const metrics = isRecord(raw.metrics) ? raw.metrics : {};
  const [firstKey, firstValue] = Object.entries(metrics)[0] ?? [];
  return {
    id: str(raw.id),
    campaignId: nullableStr(raw.campaignId),
    creativeId: null,
    severity: (["info", "warning", "critical"].includes(str(raw.severity, "info"))
      ? str(raw.severity)
      : "info") as Insight["severity"],
    title: str(raw.title, "Insight"),
    observation: str(raw.detail),
    explanation: str(raw.kind),
    recommendedAction: "",
    action: null,
    metric: firstKey ? { label: firstKey.replace(/_/g, " "), value: num(firstValue), unit: undefined, delta: undefined } : undefined,
    createdAt: iso(raw.createdAt),
  };
}

export function mapCreativeReference(raw: Json): CreativeReference {
  const mapped = mapReferenceAnalysis(raw);
  return {
    id: str(raw.id),
    sourceName: str(raw.sourceName ?? raw.source_name, mapped.sourceName),
    summary: str(raw.summary, mapped.inspiredBrief),
    style: mapped.style,
    favorite: bool(raw.favorite),
    createdAt: nullableStr(raw.createdAt ?? raw.created_at),
  };
}

/* -------------------------------------------------------------------------- */
/* Recommendations                                                            */
/* -------------------------------------------------------------------------- */

export function mapRecommendation(raw: Json): Recommendation {
  const statusRaw = str(raw.status, "pending");
  const status =
    statusRaw === "pending"
      ? "pending"
      : statusRaw === "approved" || statusRaw === "executed"
        ? "applied"
        : "dismissed";
  const changes = Array.isArray(raw.changes) ? raw.changes : [];
  const recId = str(raw.id) || str(raw.recommendationId) || `rec_${Date.now()}`;
  const campaignId = str(raw.campaignId) || "cmp_general";
  return {
    id: recId,
    campaignId,
    title: str(raw.title, "Recommendation"),
    rationale: str(raw.rationale),
    expectedImpact: str(raw.estimatedImpact) || str(raw.expectedImpact) || "High",
    confidence: typeof raw.confidence === "number" ? raw.confidence : 0.8,
    changes: changes.map((c) => ({
      field: str(c.field),
      label: str(c.label || c.field).replace(/_/g, " "),
      before: c.before ?? null,
      after: c.after ?? null,
    })),
    status,
    createdAt: iso(raw.createdAt),
  };
}

/* -------------------------------------------------------------------------- */
/* Tasks                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The backend identifies work by `(persona_id, task_name)`; the UI identifies it
 * by a single `ActionType`. This is the single translation table between them.
 */
export const ACTION_TASK_MAP: Record<string, { task: string; personaId: string }> = {
  ANALYZE_WEBSITE: { task: "competitor_research", personaId: "researcher" },
  ANALYZE_SOCIAL_PROFILE: { task: "competitor_research", personaId: "researcher" },
  ANALYZE_REVIEWS: { task: "competitor_research", personaId: "researcher" },
  ANALYZE_COMPETITOR_CREATIVES: { task: "competitor_research", personaId: "researcher" },
  RESEARCH_COMPETITORS: { task: "competitor_research", personaId: "researcher" },
  ANALYZE_MARKET: { task: "market_analysis", personaId: "researcher" },
  ANALYZE_KEYWORDS: { task: "market_analysis", personaId: "researcher" },
  DETECT_MARKET_GAPS: { task: "market_gaps", personaId: "researcher" },
  GENERATE_MARKETING_STRATEGY: { task: "marketing_strategy", personaId: "omar" },
  CREATE_CAMPAIGN: { task: "campaign_strategy", personaId: "omar" },
  GENERATE_CONTENT_CALENDAR: { task: "content_calendar", personaId: "omar" },
  ANALYZE_CAMPAIGN: { task: "performance_analysis", personaId: "karim" },
  OPTIMIZE_CAMPAIGN: { task: "optimization_proposal", personaId: "salma" },
  ADD_TO_CAMPAIGN: { task: "optimization_proposal", personaId: "salma" },
  UPDATE_CAMPAIGN: { task: "optimization_proposal", personaId: "salma" },
  APPLY_RECOMMENDATION: { task: "optimization_proposal", personaId: "salma" },
  CONNECT_META: { task: "optimization_proposal", personaId: "salma" },
};

/** Reverse lookup: backend `task_name` → the `ActionType` the UI dispatched. */
const TASK_TYPE_MAP: Record<string, string> = {
  ...Object.entries(ACTION_TASK_MAP).reduce<Record<string, string>>(
    (acc, [action, { task }]) => {
      if (!acc[task]) acc[task] = action;
      return acc;
    },
    {},
  ),
  // Historical assistant cards map to the new Write with AI dialog action;
  // this does not make Layla's old `/tasks` endpoint executable again.
  ad_variations: "GENERATE_VARIATIONS",
};

function mapStepStatus(v: unknown): AgentTask["status"] {
  const s = str(v, "pending");
  if (s === "running") return "running";
  if (s === "succeeded") return "succeeded";
  if (s === "queued" || s === "pending") return "queued";
  return "failed";
}

export function mapAgentTask(raw: Json, fallbackType = "ANALYZE_CAMPAIGN"): AgentTask {
  const rawProgress = num(raw.progress);
  const progress = clamp(rawProgress <= 1 ? rawProgress * 100 : rawProgress, 0, 100);
  const result = isRecord(raw.result) ? raw.result : {};
  const output = isRecord(result.output) ? result.output : result;
  const recommendationId = str(
    result.recommendationId ?? result.recommendation_id ?? output.recommendationId ?? output.recommendation_id,
  );
  const campaignId = str(
    result.campaignId ?? result.campaign_id ?? output.campaignId ?? output.campaign_id,
  );
  const conversationId = str(raw.conversationId);
  return {
    id: str(raw.id),
    type: (TASK_TYPE_MAP[str(raw.taskName)] ?? fallbackType) as AgentTask["type"],
    status: mapStepStatus(raw.status === "cancelled" ? "failed" : raw.status),
    label: str(raw.taskName, "Agent task").replace(/_/g, " "),
    progress: Math.round(progress),
    steps: asArray(raw.steps).map((s) => ({ label: str(s.name ?? s.label, "step"), status: mapStepStatus(s.status) })),
    resultRef: recommendationId
      ? { entity: "recommendation", id: recommendationId }
      : campaignId
        ? { entity: "campaign", id: campaignId }
        : conversationId
          ? { entity: "conversation", id: conversationId }
          : null,
    result: isRecord(raw.result) ? raw.result : null,
    error: nullableStr(raw.error),
    createdAt: iso(raw.createdAt),
    updatedAt: iso(raw.updatedAt),
  };
}

/* -------------------------------------------------------------------------- */
/* Message blocks                                                             */
/* -------------------------------------------------------------------------- */

function mapFinding(f: Json): FindingsItem {
  const confidence = f.confidence === undefined || f.confidence === null ? undefined : num(f.confidence);
  const title = str(f.title ?? f.label, "Finding");
  const evidence = Array.isArray(f.evidence) ? f.evidence : [];
  return {
    label: title,
    title,
    detail: str(f.detail),
    sentiment: confidence === undefined ? "neutral" : confidence >= 0.7 ? "positive" : confidence < 0.4 ? "negative" : "neutral",
    source: f.source ? String(f.source) : null,
    confidence: confidence ?? null,
    evidence: evidence as any,
  };
}

function mapMetricFormat(unit: string): "number" | "currency" | "percent" | "multiplier" {
  const u = unit.trim().toLowerCase();
  if (u === "%" || u === "percent") return "percent";
  if (u === "$" || u === "egp" || u === "usd" || u === "eur" || u.includes("curren")) return "currency";
  if (u === "x" || u === "times" || u === "multiple") return "multiplier";
  return "number";
}

export function mapBlock(raw: unknown): AnyBlock | null {
  if (!isRecord(raw)) return null;
  const type = str(raw.type);

  switch (type) {
    case "text": {
      const text = str(raw.text);
      return text ? ({ type: "text", text } as MessageBlock) : null;
    }
    case "findings": {
      const items = asArray(raw.findings ?? raw.items).map((f) => mapFinding(isRecord(f) ? f : {}));
      const block: FindingsBlock = {
        type: "findings",
        title: str(raw.title, "Findings"),
        items,
        findings: items,
      };
      return block;
    }
    case "recommendation": {
      const payload = isRecord(raw.payload) ? raw.payload : {};
      const recId = str(raw.recommendationId) || str(raw.id) || `rec_${Date.now()}`;
      const campId = str(payload.campaignId) || str(raw.campaignId) || "cmp_general";
      return {
        type: "recommendation",
        recommendation: mapRecommendation({
          id: recId,
          campaignId: campId,
          actionType: str(raw.actionType, "general_recommendation"),
          title: str(raw.title, "Strategic Recommendation"),
          rationale: str(raw.rationale),
          status: raw.status || "pending",
          estimatedImpact: str(raw.estimatedImpact) || str(raw.expectedImpact) || "High",
          createdAt: payload.createdAt || raw.createdAt,
        }),
      } as MessageBlock;
    }
    case "metric": {
      const block: MetricBlock = {
        type: "metric",
        metrics: [
          {
            label: str(raw.label, "Metric"),
            value: num(raw.value),
            unit: (nullableStr(raw.unit) ?? undefined),
            delta: opt(num(raw.delta, 0)),
            format: mapMetricFormat(str(raw.unit)),
          },
        ],
      };
      return block;
    }
    case "action_card": {
      const payload = isRecord(raw.payload) ? raw.payload : {};
      const inputs = isRecord(raw.inputs) ? raw.inputs : {};
      const taskName = str(raw.task);
      const actionType = str(raw.action_type || raw.actionType);
      const title = str(raw.title || raw.label, "Suggested next step");
      const desc = nullableStr(raw.description) ?? undefined;

      const isUsageAction = (s: string) =>
        /usage|quota|token|استهلاك|حصة|كوتا|توكن/i.test(s);

      const isBrandAction = (s: string) =>
        /brand|identity|تسمية|هوية|براند/i.test(s);

      const normalizePayload = (p: Record<string, unknown>) => {
        const out = { ...p };
        for (const [wireKey, uiKey] of [
          ["campaign_id", "campaignId"],
          ["creative_id", "creativeId"],
          ["conversation_id", "conversationId"],
        ] as const) {
          if (out[uiKey] === undefined && out[wireKey] !== undefined) {
            out[uiKey] = out[wireKey];
          }
          delete out[wireKey];
        }
        return out;
      };

      const rawActions = asArray(raw.actions);
      let actions: ActionCardBlock["actions"] = [];

      if (rawActions.length > 0) {
        actions = rawActions.map((act) => {
          const actType = str(act.type);
          const actLabel = str(act.label || raw.label || "Run");
          const actPayload = isRecord(act.payload) ? act.payload : {};

          let resolvedType: ActionType = "CREATE_CAMPAIGN";
          if (actType === "VIEW_USAGE" || isUsageAction(actType) || isUsageAction(actLabel) || isUsageAction(title)) {
            resolvedType = "VIEW_USAGE";
          } else if (actType === "UPDATE_BRAND_PROFILE" || isBrandAction(actType) || isBrandAction(actLabel) || isBrandAction(title)) {
            resolvedType = "UPDATE_BRAND_PROFILE";
          } else if (TASK_TYPE_MAP[actType]) {
            resolvedType = TASK_TYPE_MAP[actType] as ActionType;
          } else if (TASK_TYPE_MAP[taskName]) {
            resolvedType = TASK_TYPE_MAP[taskName] as ActionType;
          } else if (actType && actType !== "CREATE_CAMPAIGN") {
            resolvedType = (ActionTypeSchema.safeParse(actType).success ? actType : "CREATE_CAMPAIGN") as ActionType;
          }

          return {
            type: resolvedType,
            label: actLabel,
            payload: normalizePayload({ ...payload, ...actPayload, task: taskName || actType }),
          };
        });
      } else {
        const isUsage = isUsageAction(actionType) || isUsageAction(taskName) || isUsageAction(title) || isUsageAction(str(raw.label));
        const isBrand = isBrandAction(actionType) || isBrandAction(taskName) || isBrandAction(title) || isBrandAction(str(raw.label));
        const resolvedType: ActionType = isUsage
          ? "VIEW_USAGE"
          : isBrand
          ? "UPDATE_BRAND_PROFILE"
          : (((taskName ? TASK_TYPE_MAP[taskName] : undefined) ?? (actionType ? TASK_TYPE_MAP[actionType] : undefined) ?? "CREATE_CAMPAIGN") as ActionType);

        actions = [
          {
            type: resolvedType,
            label: str(raw.label, isUsage ? "عرض الاستهلاك" : isBrand ? "Manage Brand Profile" : "Run"),
            payload: normalizePayload({ ...payload, ...inputs, task: taskName }),
          },
        ];
      }

      const block: ActionCardBlock = {
        type: "action_card",
        title,
        description: desc,
        actions,
      };
      return block;
    }
    case "task_progress": {
      const block: TaskProgressBlock = {
        type: "task_progress",
        taskId: str(raw.taskId),
        task: mapAgentTask(
          {
            id: str(raw.taskId),
            taskName: str(raw.taskName),
            status: raw.status,
            steps: raw.steps,
            progress: raw.progress,
            error: raw.message,
          },
          "ANALYZE_CAMPAIGN",
        ),
      };
      return block;
    }
    case "context_used":
      return {
        type: "context_used",
        items: asArray(raw.items).map((i) => ({
          kind: str(i.kind, "memory"),
          label: str(i.label),
          detail: str(i.detail),
          similarity: opt(num(i.similarity, 0)),
          memoryId: (nullableStr(i.memoryId) ?? undefined),
        })),
        tokenEstimate: num(raw.tokenEstimate),
        truncated: bool(raw.truncated),
      } as unknown as MessageBlock;
    case "question_with_options":
      return {
        type: "question_with_options",
        question: str(raw.question, "Could you clarify?"),
        options: asArray(raw.options).map((o) => ({
          id: str(o.id, "option"),
          label: str(o.label, "Option"),
          description: (nullableStr(o.description) ?? undefined),
        })),
        multiSelect: false,
      } as MessageBlock;
    case "error": {
      const block: ErrorBlock = {
        type: "error",
        message: str(raw.message, "Something went wrong"),
        retryable: bool(raw.retryable, true),
      };
      return block;
    }
    default:
      // Forward compatibility: keep unrecognised blocks rather than dropping them.
      return { ...raw, type } as AnyBlock;
  }
}

export function mapMessage(raw: Json, conversationId: string): Message {
  const blocks = asArray(raw.blocks)
    .map((b) => mapBlock(b))
    .filter((b): b is AnyBlock => b !== null);
  const content = str(raw.content);
  if (blocks.length === 0 && content) blocks.push({ type: "text", text: content });
  const role = ["user", "assistant", "system"].includes(str(raw.role)) ? str(raw.role) : "assistant";
  return {
    id: str(raw.id, `msg_${Date.now()}`),
    conversationId: str(raw.conversationId, conversationId),
    role: role as Message["role"],
    content,
    blocks,
    context: [],
    createdAt: iso(raw.createdAt),
  };
}

/* -------------------------------------------------------------------------- */
/* Conversations                                                              */
/* -------------------------------------------------------------------------- */

export function mapConversationSummary(raw: Json): Conversation {
  return {
    id: str(raw.id),
    title: str(raw.title, "New conversation"),
    lastMessagePreview: str(raw.lastMessagePreview),
    messageCount: num(raw.messageCount),
    createdAt: iso(raw.createdAt),
    updatedAt: iso(raw.updatedAt),
  };
}

export function sortMessagesChronologically(messages: Message[]): Message[] {
  return [...messages].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    const validA = !isNaN(timeA);
    const validB = !isNaN(timeB);

    if (validA && validB) {
      const diff = timeA - timeB;
      // If timestamps differ by more than 500ms, strictly respect chronological order
      if (Math.abs(diff) > 500) {
        return diff;
      }
      // Within the same conversational turn (exact tie or sub-500ms clock skew):
      // A user query MUST ALWAYS precede an assistant response
      if (a.role === "user" && b.role !== "user") return -1;
      if (a.role !== "user" && b.role === "user") return 1;
      return diff;
    }
    // Deterministic tie-breaker: user query always precedes assistant response
    if (a.role === "user" && b.role !== "user") return -1;
    if (a.role !== "user" && b.role === "user") return 1;
    return 0;
  });
}

export function mapConversationDetail(raw: Json): { conversation: Conversation; messages: Message[] } {
  const id = str(raw.id);
  const messages = sortMessagesChronologically(asArray(raw.messages).map((m) => mapMessage(m, id)));
  const last = messages[messages.length - 1];
  const preview = last ? (last.blocks.find((b) => b.type === "text") as { text?: string } | undefined)?.text ?? "" : "";
  return {
    conversation: {
      id,
      title: str(raw.title, "New conversation"),
      lastMessagePreview: preview.slice(0, 120),
      messageCount: messages.length,
      createdAt: iso(raw.createdAt),
      updatedAt: iso(raw.updatedAt),
      context: (() => {
        const ctx = isRecord(raw.context) ? raw.context : {};
        return {
          campaignId: nullableStr(ctx.campaignId ?? ctx.campaign_id) ?? undefined,
          creativeId: nullableStr(ctx.creativeId ?? ctx.creative_id) ?? undefined,
          insightId: nullableStr(ctx.insightId ?? ctx.insight_id) ?? undefined,
          referenceAnalysisId: nullableStr(ctx.referenceAnalysisId ?? ctx.reference_analysis_id) ?? undefined,
          workflow: str(ctx.workflow) === "creative_prompt" ? "creative_prompt" as const : undefined,
          promptType: ["image", "video"].includes(str(ctx.promptType ?? ctx.prompt_type))
            ? str(ctx.promptType ?? ctx.prompt_type) as "image" | "video"
            : undefined,
          creativeMode: ["chat", "prompt", "design"].includes(str(ctx.creativeMode ?? ctx.creative_mode))
            ? str(ctx.creativeMode ?? ctx.creative_mode) as "chat" | "prompt" | "design"
            : undefined,
          personaId: nullableStr(ctx.personaId ?? ctx.persona_id) ?? undefined,
          businessId: nullableStr(ctx.businessId ?? ctx.business_id) ?? undefined,
        };
      })(),
    },
    messages,
  };
}

/* -------------------------------------------------------------------------- */
/* Meta integration                                                           */
/* -------------------------------------------------------------------------- */

export function mapMetaAccountCampaignPage(raw: Json): MetaAccountCampaignPage {
  const rawStatus = str(raw.status).toLowerCase();
  const status = rawStatus === "ok" || rawStatus === "partial" ? rawStatus : "unavailable";
  const campaigns = asArray(raw.campaigns).flatMap((row) => {
    if (!isRecord(row)) return [];
    const metaCampaignId = str(row.metaCampaignId ?? row.meta_campaign_id);
    if (!metaCampaignId) return [];
    return [{
      metaCampaignId,
      name: str(row.name),
      objective: nullableStr(row.objective),
      status: nullableStr(row.status),
      effectiveStatus: nullableStr(row.effectiveStatus ?? row.effective_status),
      createdTime: nullableStr(row.createdTime ?? row.created_time),
      startTime: nullableStr(row.startTime ?? row.start_time),
      stopTime: nullableStr(row.stopTime ?? row.stop_time),
    }];
  });
  return {
    status,
    source: str(raw.source, "meta_marketing_api"),
    unavailableReason: nullableStr(raw.unavailableReason ?? raw.unavailable_reason),
    accountId: nullableStr(raw.accountId ?? raw.account_id),
    campaigns,
    hasMore: bool(raw.hasMore ?? raw.has_more),
    nextCursor: nullableStr(raw.nextCursor ?? raw.next_cursor),
    retrievedAt: nullableStr(raw.retrievedAt ?? raw.retrieved_at),
  };
}

export function mapMetaStatus(raw: Json): MetaConnection {
  const connected = bool(raw.connected);
  const campaignReady = bool(raw.campaignReady);
  const reason = (nullableStr(raw.unavailableReason) ?? undefined);
  return {
    status: connected ? "connected" : reason ? "error" : "not_connected",
    campaignReady,
    pageConfigured: bool(raw.pageConfigured),
    accountId: nullableStr(raw.adAccountId),
    accountName: nullableStr(raw.adAccountName),
    pageName: null,
    permissions: asArray(raw.scopes).map((s) => str(s)).filter(Boolean),
    connectedAt: raw.lastSyncedAt ? iso(raw.lastSyncedAt) : null,
    expiresAt: raw.tokenExpiresAt ? iso(raw.tokenExpiresAt) : null,
    // Keyed to campaignReady, not connected. An account can be fully connected
    // and still be unable to publish because the Page ID is missing; gating on
    // `connected` threw away the backend's precise diagnosis in exactly that
    // case, leaving the wizard to show a generic "configure everything".
    errorMessage: campaignReady ? null : (reason ?? nullableStr(raw.message) ?? null),
  };
}

/* -------------------------------------------------------------------------- */
/* Personas → agents                                                          */
/* -------------------------------------------------------------------------- */

const PERSONA_ROLE_MAP: Record<string, string> = {
  researcher: "researcher",
  omar: "strategist",
  layla: "creative",
  karim: "analyst",
  salma: "optimizer",
};

export function mapPersona(raw: Json): Agent {
  const tone = str(raw.tone, "professional");
  const autonomy = str(raw.autonomy, "suggest");
  const language = str(raw.language, "en") === "ar" ? "ar" : "en";
  const tools = asArray(raw.allowedTools).map((t) => str(t)).filter(Boolean);
  return {
    id: str(raw.id),
    role: (PERSONA_ROLE_MAP[str(raw.id)] ?? "researcher") as Agent["role"],
    name: str(raw.name, "Agent"),
    emoji: str(raw.emoji, "🤖"),
    description: str(raw.description),
    persona: {
      tone: (tone === "bold" || tone === "playful" || tone === "minimal" ? tone : "professional") as Agent["persona"]["tone"],
      language,
      instructions: str(raw.systemPrompt).slice(0, 2000),
    },
    allowedTools: tools as Agent["allowedTools"],
    availableTools: tools as Agent["availableTools"],
    autonomy: (["ask_first", "suggest", "auto_draft"].includes(autonomy) ? autonomy : "suggest") as Agent["autonomy"],
    enabled: true,
    updatedAt: new Date().toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/* Auth, workspaces & admin surfaces                                          */
/* -------------------------------------------------------------------------- */

/** `member`/`owner`/`viewer` are the only roles; anything else reads as `viewer`. */
export function mapRole(v: unknown): Role {
  const s = str(v).toLowerCase();
  return s === "owner" || s === "member" ? s : "viewer";
}

export function mapAuthUser(raw: Json): AuthUser {
  return {
    id: str(raw.id, "usr_unknown"),
    email: str(raw.email),
    fullName: nullableStr(raw.fullName),
    isActive: bool(raw.isActive, true),
    lastLoginAt: nullableStr(raw.lastLoginAt),
    createdAt: nullableStr(raw.createdAt),
  };
}

export function mapWorkspaceMembership(raw: Json): WorkspaceMembership {
  return {
    workspaceId: str(raw.workspaceId, "ws_unknown"),
    businessId: str(raw.businessId, "biz_unknown"),
    businessName: str(raw.businessName, "Workspace"),
    role: mapRole(raw.role),
    isPrimary: bool(raw.isPrimary, false),
  };
}

export function mapAuthSession(raw: Json): AuthSession {
  return {
    accessToken: str(raw.accessToken),
    tokenType: str(raw.tokenType, "Bearer"),
    expiresIn: num(raw.expiresIn, 0),
    user: mapAuthUser(isRecord(raw.user) ? raw.user : {}),
    workspaces: asArray(raw.workspaces).map(mapWorkspaceMembership),
    activeWorkspaceId: nullableStr(raw.activeWorkspaceId),
  };
}

export function mapSessionInfo(raw: Json): SessionInfo {
  return {
    user: mapAuthUser(isRecord(raw.user) ? raw.user : {}),
    workspaces: asArray(raw.workspaces).map(mapWorkspaceMembership),
    activeWorkspaceId: nullableStr(raw.activeWorkspaceId),
    activeRole: raw.activeRole ? mapRole(raw.activeRole) : null,
  };
}

/* Business profile ---------------------------------------------------------- */

/**
 * `GET /business/profile` → the writable form model. Scalars stay `null` rather
 * than collapsing to `""` so the form can tell "stored as NULL" from "empty
 * string", which is the difference between *omit* and *clear* on the PATCH.
 */
export function mapBusinessProfileForm(raw: Json): BusinessProfileForm {
  const strings = (v: unknown) => asArray(v).map((x) => str(x)).filter(Boolean);
  return {
    businessId: str(raw.businessId, "biz_unknown"),
    name: str(raw.name),
    industry: nullableStr(raw.industry),
    websiteUrl: nullableStr(raw.websiteUrl),
    country: nullableStr(raw.country),
    language: str(raw.language, "en"),
    currency: nullableStr(raw.currency),
    monthlyBudget: raw.monthlyBudget === null || raw.monthlyBudget === undefined ? null : num(raw.monthlyBudget, 0),
    dailyTokenBudget:
      raw.dailyTokenBudget === null || raw.dailyTokenBudget === undefined ? null : Math.round(num(raw.dailyTokenBudget, 0)),
    goals: strings(raw.goals),
    brandVoice: nullableStr(raw.brandVoice),
    visualStyle: nullableStr(raw.visualStyle),
    targetAudience: nullableStr(raw.targetAudience),
    keyOffers: strings(raw.keyOffers),
    competitors: strings(raw.competitors),
    updatedAt: nullableStr(raw.updatedAt),
  };
}

/**
 * `PATCH /business/profile` request body. The input is already exclude-unset
 * shaped (see `BusinessProfileUpdateInput`), so this only *strips empty scalars
 * into `null`* for fields the user explicitly blanked, and passes lists through
 * unchanged — an absent key is the "leave it alone" instruction.
 */
export function toBusinessProfilePatch(patch: Json): Json {
  const body: Json = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    body[key] = value;
  }
  return body;
}

/* Brand memory -------------------------------------------------------------- */

export function mapMemoryItem(raw: Json): MemoryItem {
  const kind = str(raw.kind) as MemoryItem["kind"];
  return {
    id: str(raw.id, "mem_unknown"),
    businessId: str(raw.businessId, "biz_unknown"),
    kind: MEMORY_KINDS.includes(kind) ? kind : "learning",
    text: str(raw.text),
    metadata: isRecord(raw.metadata) ? raw.metadata : {},
    campaignId: nullableStr(raw.campaignId),
    createdAt: nullableStr(raw.createdAt) ?? undefined,
    score: raw.score === null || raw.score === undefined ? null : num(raw.score, 0),
  };
}

export function mapMemoryItemList(raw: Json): MemoryItemList {
  const mode = str(raw.mode) === "similar" ? "similar" : "recent";
  return {
    items: asArray(raw.items).map(mapMemoryItem),
    total: num(raw.total, 0),
    limit: num(raw.limit, 50),
    kind: nullableStr(raw.kind),
    query: nullableStr(raw.query),
    mode,
  };
}

/* Connectors ---------------------------------------------------------------- */

export function mapConnectorSource(v: unknown): ConnectorSource {
  const s = str(v).toLowerCase();
  return s === "workspace" || s === "env" || s === "default" ? s : "unset";
}

export function mapConnectorField(raw: Json): ConnectorField {
  const secret = bool(raw.secret, false);
  return {
    key: str(raw.key),
    label: str(raw.label, str(raw.key)),
    secret,
    required: bool(raw.required, false),
    maxLength: num(raw.maxLength, 500),
    description: str(raw.description),
    // Defence in depth: the backend already nulls every secret, but a form that
    // pre-fills a secret is a leak, so the mask is never promoted to a value here.
    value: secret ? null : (nullableStr(raw.value)),
    hasValue: bool(raw.hasValue, false),
    masked: nullableStr(raw.masked),
    source: mapConnectorSource(raw.source),
  };
}

export function mapConnector(raw: Json): Connector {
  return {
    connector: str(raw.connector),
    label: str(raw.label, str(raw.connector)),
    source: mapConnectorSource(raw.source),
    hasOverride: bool(raw.hasOverride, false),
    configured: bool(raw.configured, false),
    provider: nullableStr(raw.provider),
    placeholder: bool(raw.placeholder, false),
    fields: asArray(raw.fields).map(mapConnectorField),
    notes: str(raw.notes),
  };
}

export function mapConnectorSettings(raw: Json): ConnectorSettings {
  return {
    businessId: str(raw.businessId, "biz_unknown"),
    environment: str(raw.environment, "development"),
    overrideCount: num(raw.overrideCount, 0),
    connectors: asArray(raw.connectors).map(mapConnector),
    encryptionKeyConfigured: bool(raw.encryptionKeyConfigured, true),
  };
}

export function mapConnectorDeleteResult(raw: Json): ConnectorDeleteResult {
  return {
    connector: str(raw.connector),
    removed: bool(raw.removed, false),
    source: mapConnectorSource(raw.source),
    configured: bool(raw.configured, false),
  };
}

/* Usage --------------------------------------------------------------------- */

export function mapUsageBreakdown(raw: Json): UsageBreakdown {
  return { key: str(raw.key, "unknown"), tokens: num(raw.tokens, 0), share: num(raw.share, 0) };
}

export function mapUsage(raw: Json): Usage {
  return {
    workspaceId: str(raw.workspaceId, "ws_unknown"),
    businessId: str(raw.businessId, "biz_unknown"),
    period: str(raw.period, "today"),
    tokensIn: num(raw.tokensIn, 0),
    tokensOut: num(raw.tokensOut, 0),
    totalTokens: num(raw.totalTokens, 0),
    budgetTokens: num(raw.budgetTokens, 0),
    remainingTokens: num(raw.remainingTokens, 0),
    percentUsed: num(raw.percentUsed, 0),
    exceeded: bool(raw.exceeded, false),
    resetAt: iso(raw.resetAt),
    periodStart: iso(raw.periodStart),
    calls: num(raw.calls, 0),
    burnRatePerHour: num(raw.burnRatePerHour, 0),
    projectedTotalTokens: num(raw.projectedTotalTokens, 0),
    budgetSource: str(raw.budgetSource, "default"),
    byModel: asArray(raw.byModel).map(mapUsageBreakdown),
    byPersona: asArray(raw.byPersona).map(mapUsageBreakdown),
    byAction: asArray(raw.byAction).map(mapUsageBreakdown),
    estimatedCalls: num(raw.estimatedCalls, 0),
    // Null (not 0) until a price is configured: an unpriced workspace must show
    // tokens only rather than a made-up currency figure.
    estimatedCostUsd: typeof raw.estimatedCostUsd === "number" ? raw.estimatedCostUsd : null,
    costPerMillionInUsd: num(raw.costPerMillionInUsd, 0),
    costPerMillionOutUsd: num(raw.costPerMillionOutUsd, 0),
  };
}

/* Audit --------------------------------------------------------------------- */

export function mapAuditEntry(raw: Json): AuditEntry {
  const record = (v: unknown) => (isRecord(v) ? v : null);
  return {
    id: str(raw.id, "aud_unknown"),
    actor: str(raw.actor, "system"),
    action: str(raw.action, "unknown"),
    entityType: str(raw.entityType, "recommendation"),
    entityId: nullableStr(raw.entityId),
    businessId: nullableStr(raw.businessId),
    requestId: nullableStr(raw.requestId),
    before: record(raw.before),
    after: record(raw.after),
    result: record(raw.result),
    createdAt: nullableStr(raw.createdAt) ?? undefined,
  };
}

export function mapAuditList(raw: Json): AuditList {
  return {
    entries: asArray(raw.entries).map(mapAuditEntry),
    limit: num(raw.limit, 50),
    total: num(raw.total, 0),
    entityType: nullableStr(raw.entityType),
    entityId: nullableStr(raw.entityId),
    actor: nullableStr(raw.actor),
  };
}

/* -------------------------------------------------------------------------- */
/* Content calendar                                                           */
/* -------------------------------------------------------------------------- */

export function mapContentItem(raw: Json): ContentItem {
  return {
    id: str(raw.id),
    date: str(raw.date),
    time: raw.time ? str(raw.time) : undefined,
    channel: (str(raw.channel, "instagram") as ContentChannel),
    format: (str(raw.format, "post") as ContentFormat),
    title: str(raw.title, "Untitled Post"),
    hook: raw.hook ? str(raw.hook) : undefined,
    caption: raw.caption ? str(raw.caption) : undefined,
    hashtags: asArray(raw.hashtags).map((h) => str(h)).filter(Boolean),
    status: (str(raw.status, "scheduled") as ContentStatus),
    campaignId: nullableStr(raw.campaignId),
    creativeId: nullableStr(raw.creativeId),
    pillar: raw.pillar ? str(raw.pillar) : undefined,
    createdAt: iso(raw.createdAt),
    updatedAt: iso(raw.updatedAt),
  };
}

/* -------------------------------------------------------------------------- */
/* Settings                                                                   */
/* -------------------------------------------------------------------------- */

/** The backend has no settings endpoint; derive a stable local default. */
export function defaultSettings(): Settings {
  return {
    locale: "en",
    timezone: "Africa/Cairo",
    currency: "USD",
    notifications: { email: true, criticalInsights: true, weeklyDigest: false },
  };
}

export function toGeneratedText(input: { tool: string; brief: string }, title: string, body: string) {
  return {
    id: `gen_${Date.now()}`,
    tool: input.tool,
    title,
    sections: [{ heading: title, body }],
    plainText: `${title}\n\n${body}`,
    createdAt: new Date().toISOString(),
  };
}

export { mapStyleSpec };
export type { Json };
