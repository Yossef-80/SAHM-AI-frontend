import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

export const IdSchema = z.string().min(1);
/**
 * Loose on purpose. The backend serialises `datetime` values in several shapes
 * (offset-aware from Postgres, naive from SQLite) and asset fields can be
 * `data:` URLs, so a strict `.datetime()` / `.url()` check rejects valid data.
 */
export const IsoDateSchema = z.string().min(1);
export const LocaleSchema = z.enum(["en", "ar"]);
export type Locale = z.infer<typeof LocaleSchema>;

/* ------------------------------------------------------------------ */
/* Business & Brand                                                    */
/* ------------------------------------------------------------------ */

export const BusinessSchema = z.object({
  id: IdSchema,
  name: z.string(),
  industry: z.string(),
  website: z.string().optional(),
  country: z.string().length(2),
  description: z.string(),
  createdAt: IsoDateSchema,
});
export type Business = z.infer<typeof BusinessSchema>;

export const BrandProfileSchema = z.object({
  id: IdSchema,
  businessId: IdSchema,
  tone: z.array(z.string()),
  values: z.array(z.string()),
  primaryColor: z.string(),
  secondaryColor: z.string().optional(),
  logoUrl: z.string().optional(),
  tagline: z.string().optional(),
  doNotUse: z.array(z.string()).default([]),
  languages: z.array(LocaleSchema),
});
export type BrandProfile = z.infer<typeof BrandProfileSchema>;

/* ------------------------------------------------------------------ */
/* Audience                                                            */
/* ------------------------------------------------------------------ */

export const TargetingCategorySchema = z.enum([
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
]);
export type TargetingCategory = z.infer<typeof TargetingCategorySchema>;

export const AudienceInterestSchema = z.object({ id: z.string().min(1), name: z.string().min(1) });
export type AudienceInterest = z.infer<typeof AudienceInterestSchema>;

/** A Meta-resolved option selected explicitly by the user. */
export const AudienceTargetingTargetSchema = AudienceInterestSchema.extend({
  category: TargetingCategorySchema.default("interests"),
});
export type AudienceTargetingTarget = z.infer<typeof AudienceTargetingTargetSchema>;

/** An AI-generated search phrase; it is not itself an active targeting option. */
export const TargetingSearchTermSchema = z.object({
  category: TargetingCategorySchema.default("interests"),
  term: z.string().min(2).max(120),
});
export type TargetingSearchTerm = z.infer<typeof TargetingSearchTermSchema>;

export const AudienceTargetingSchema = z.object({
  ageMin: z.number().int().min(13).max(65).default(18),
  ageMax: z.number().int().min(13).max(65).default(65),
  genders: z.array(z.enum(["male", "female", "all"])).default(["all"]),
  locations: z.array(z.string()).default([]),
  countries: z.array(z.string()).default([]),
  interests: z.array(z.string()).default([]),
  interestTargets: z.array(AudienceInterestSchema).default([]),
  targetingTargets: z.array(AudienceTargetingTargetSchema).default([]),
  behaviors: z.array(z.string()).default([]),
});
export type AudienceTargeting = z.infer<typeof AudienceTargetingSchema>;

/** Flat view model used by the campaign detail audience tab. */
export const AudienceSchema = z.object({
  id: IdSchema,
  name: z.string(),
  description: z.string().nullable().optional(),
  ageMin: z.number().int().min(13),
  ageMax: z.number().int().max(65),
  genders: z.array(z.enum(["male", "female", "all"])),
  locations: z.array(z.string()),
  countries: z.array(z.string()).default([]),
  interests: z.array(z.string()),
  interestTargets: z.array(AudienceInterestSchema).default([]),
  targetingTargets: z.array(AudienceTargetingTargetSchema).default([]),
  behaviors: z.array(z.string()).default([]),
  source: z.enum(["manual", "ai"]).optional(),
  isArchived: z.boolean().optional(),
  estimatedReach: z.number().int().nonnegative().optional(),
});
export type Audience = z.infer<typeof AudienceSchema>;

export const SavedAudienceSchema = z.object({
  id: IdSchema,
  businessId: IdSchema,
  name: z.string(),
  description: z.string().nullable().optional(),
  targeting: AudienceTargetingSchema,
  source: z.enum(["manual", "ai"]),
  isArchived: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SavedAudience = z.infer<typeof SavedAudienceSchema>;

export const SavedAudienceListSchema = z.object({
  audiences: z.array(SavedAudienceSchema),
  total: z.number().int().nonnegative(),
});

export const SavedAudienceInputSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(1000).nullable().optional(),
  targeting: AudienceTargetingSchema,
  source: z.enum(["manual", "ai"]).default("manual"),
});
export type SavedAudienceInput = z.infer<typeof SavedAudienceInputSchema>;

export const AudienceSuggestionInputSchema = z.object({
  campaignName: z.string().min(2).max(200),
  objective: z.enum(["awareness", "traffic", "engagement", "leads", "sales", "app_installs"]),
  brief: z.string().max(4000).optional(),
  countries: z.array(z.string()).max(12).default([]),
  language: LocaleSchema.default("ar"),
});
export type AudienceSuggestionInput = z.infer<typeof AudienceSuggestionInputSchema>;

export const AudienceIdeaSchema = z.object({
  name: z.string(),
  summary: z.string(),
  approach: z.enum(["broad", "targeting_hypothesis", "interest_hypothesis"]),
  interestSearchTerms: z.array(z.string()).default([]),
  targetingSearchTerms: z.array(TargetingSearchTermSchema).default([]),
  rationale: z.string(),
});
export type AudienceIdea = z.infer<typeof AudienceIdeaSchema>;

export const AudienceSuggestionResponseSchema = z.object({
  suggestions: z.array(AudienceIdeaSchema),
  missingInputs: z.array(z.string()).default([]),
});
export type AudienceSuggestionResponse = z.infer<typeof AudienceSuggestionResponseSchema>;

/* ------------------------------------------------------------------ */
/* Creative                                                            */
/* ------------------------------------------------------------------ */

export const CreativeKindSchema = z.enum(["image", "video", "copy"]);
export type CreativeKind = z.infer<typeof CreativeKindSchema>;

export const CreativeStatusSchema = z.enum(["draft", "generating", "ready", "approved", "rejected"]);
export type CreativeStatus = z.infer<typeof CreativeStatusSchema>;

export const CreativeSchema = z.object({
  id: IdSchema,
  campaignId: IdSchema.nullable(),
  kind: CreativeKindSchema,
  title: z.string(),
  status: CreativeStatusSchema,
  /** Original generation prompt when the backend exposes it. */
  prompt: z.string().optional(),
  /** For image/video: URL of the asset. For copy: undefined. */
  assetUrl: z.string().optional(),
  /** Thumbnail / preview URL (image or video poster). */
  thumbnailUrl: z.string().optional(),
  headline: z.string().optional(),
  primaryText: z.string().optional(),
  cta: z.string().optional(),
  durationSec: z.number().nonnegative().optional(),
  aspectRatio: z.enum(["1:1", "4:5", "9:16", "16:9"]).optional(),
  tags: z.array(z.string()).default([]),
  score: z.number().min(0).max(100).optional(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});
export type Creative = z.infer<typeof CreativeSchema>;

/* ------------------------------------------------------------------ */
/* Campaign                                                            */
/* ------------------------------------------------------------------ */

export const CampaignObjectiveSchema = z.enum([
  "awareness",
  "traffic",
  "engagement",
  "leads",
  "sales",
  "app_installs",
]);
export type CampaignObjective = z.infer<typeof CampaignObjectiveSchema>;

export const CampaignStatusSchema = z.enum(["draft", "scheduled", "active", "paused", "completed", "failed"]);
export type CampaignStatus = z.infer<typeof CampaignStatusSchema>;

export const CampaignStrategySchema = z.object({
  summary: z.string(),
  keyMessages: z.array(z.string()),
  channels: z.array(z.enum(["facebook", "instagram", "messenger", "audience_network"])),
  placements: z.array(z.string()),
  biddingStrategy: z.enum(["lowest_cost", "cost_cap", "bid_cap", "roas_goal"]),
  phases: z.array(
    z.object({
      name: z.string(),
      durationDays: z.number().int().positive(),
      focus: z.string(),
    }),
  ),
  kpis: z.array(z.object({ metric: z.string(), target: z.number() })),
});
export type CampaignStrategy = z.infer<typeof CampaignStrategySchema>;

export const GeneratedCampaignChannelSchema = z.object({
  channel: z.string(),
  role: z.string().default(""),
  budgetSharePct: z.number().min(0).max(100).nullable().optional(),
  placements: z.array(z.string()).default([]),
  rationale: z.string().default(""),
});
export type GeneratedCampaignChannel = z.infer<typeof GeneratedCampaignChannelSchema>;

export const GeneratedCampaignStrategySchema = z.object({
  summary: z.string(),
  objective: z.string().nullable().optional(),
  audience: z.string().nullable().optional(),
  positioning: z.string().nullable().optional(),
  keyMessages: z.array(z.string()).default([]),
  channels: z.array(GeneratedCampaignChannelSchema).default([]),
  placements: z.array(z.string()).default([]),
  creativeDirection: z.string().nullable().optional(),
  ctaDirection: z.string().nullable().optional(),
  creativesNeeded: z.array(z.string()).default([]),
  successMetrics: z.array(z.string()).default([]),
  evidence: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  missingInputs: z.array(z.string()).default([]),
});
export type GeneratedCampaignStrategy = z.infer<typeof GeneratedCampaignStrategySchema>;

export const CampaignMetricsSchema = z.object({
  impressions: z.number().int().nonnegative(),
  reach: z.number().int().nonnegative(),
  clicks: z.number().int().nonnegative(),
  ctr: z.number().nonnegative(),
  cpc: z.number().nonnegative(),
  cpm: z.number().nonnegative(),
  conversions: z.number().int().nonnegative(),
  cpa: z.number().nonnegative(),
  roas: z.number().nonnegative(),
  spend: z.number().nonnegative(),
});
export type CampaignMetrics = z.infer<typeof CampaignMetricsSchema>;

export const MetricPointSchema = z.object({
  date: z.string(),
  impressions: z.number(),
  clicks: z.number(),
  conversions: z.number(),
  spend: z.number(),
});
export type MetricPoint = z.infer<typeof MetricPointSchema>;

export const CampaignAudienceSnapshotSchema = z.object({
  id: IdSchema,
  name: z.string(),
  description: z.string().nullable().optional(),
  targeting: AudienceTargetingSchema,
  estimatedReach: z.number().int().nonnegative().optional(),
});
export type CampaignAudienceSnapshot = z.infer<typeof CampaignAudienceSnapshotSchema>;

export const CampaignSchema = z.object({
  id: IdSchema,
  businessId: IdSchema,
  name: z.string(),
  objective: CampaignObjectiveSchema,
  status: CampaignStatusSchema,
  dailyBudget: z.number().nonnegative(),
  currency: z.string().length(3),
  startDate: IsoDateSchema,
  endDate: IsoDateSchema.nullable(),
  audienceId: IdSchema.nullable(),
  audienceSnapshot: CampaignAudienceSnapshotSchema.nullable().optional(),
  strategy: CampaignStrategySchema.nullable(),
  creativeIds: z.array(IdSchema),
  metaCampaignId: z.string().nullable(),
  metrics: CampaignMetricsSchema.nullable(),
  healthScore: z.number().min(0).max(100).nullable(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});
export type Campaign = z.infer<typeof CampaignSchema>;

export const CampaignDraftSchema = z.object({
  name: z.string().min(2),
  objective: CampaignObjectiveSchema,
  dailyBudget: z.number().positive(),
  currency: z.string().length(3).default("USD"),
  startDate: IsoDateSchema,
  endDate: IsoDateSchema.nullable().default(null),
  audience: AudienceSchema.omit({ id: true }).extend({ id: IdSchema.optional() }),
  strategy: CampaignStrategySchema.nullable().default(null),
  creativeIds: z.array(IdSchema).default([]),
  launchNow: z.boolean().default(false),
});
export type CampaignDraft = z.infer<typeof CampaignDraftSchema>;

/** Non-secret Meta settings collected by the campaign wizard; server validation is authoritative. */
export const MetaAdPlanSettingsSchema = z.object({
  objective: CampaignObjectiveSchema,
  creativeIds: z.array(IdSchema).min(1).max(10),
  pageId: z.string().optional(),
  targeting: z.record(z.string(), z.unknown()).optional(),
  billingEvent: z.string().optional(),
  optimizationGoal: z.string().optional(),
  specialAdCategories: z.array(z.string()).optional(),
  destinationType: z.string().optional(),
  promotedObject: z.record(z.string(), z.unknown()).optional(),
  destinationUrl: z.string().optional(),
  primaryText: z.string().optional(),
  headline: z.string().optional(),
  callToAction: z.record(z.string(), z.unknown()).optional(),
  instagramActorId: z.string().optional(),
});
export type MetaAdPlanSettings = z.infer<typeof MetaAdPlanSettingsSchema>;

export const MetaAdPlanAssistInputSchema = z.object({
  campaignName: z.string().min(2).max(200),
  objective: CampaignObjectiveSchema,
  dailyBudget: z.number().positive(),
  currency: z.string().length(3),
  brief: z.string().max(4000).optional(),
  language: z.enum(["ar", "en"]),
  strategy: GeneratedCampaignStrategySchema,
  audience: z.object({
    name: z.string().max(200),
    ageMin: z.number().int().min(13).max(65),
    ageMax: z.number().int().min(13).max(65),
    gender: z.enum(["all", "male", "female"]),
    countries: z.array(z.string()).max(12),
    interests: z.array(z.string()).max(20),
  }),
  destinationUrl: z.string().max(2000).optional(),
  primaryText: z.string().max(3000).optional(),
  headline: z.string().max(255).optional(),
  callToActionType: z.string().max(80).optional(),
  billingEvent: z.string().max(80).optional(),
  optimizationGoal: z.string().max(80).optional(),
  destinationType: z.string().max(80).optional(),
  specialAdCategories: z.array(z.string()).max(5).default([]),
});
export type MetaAdPlanAssistInput = z.infer<typeof MetaAdPlanAssistInputSchema>;

export const MetaAdPlanAssistResponseSchema = z.object({
  primaryText: z.string().nullable(),
  headline: z.string().nullable(),
  callToActionType: z.string().nullable(),
  billingEvent: z.string().nullable(),
  optimizationGoal: z.string().nullable(),
  destinationType: z.string().nullable(),
  specialAdCategories: z.array(z.string()).nullable(),
  bidStrategy: z.literal("LOWEST_COST_WITHOUT_CAP"),
  allowedValues: z.record(z.string(), z.array(z.string())).default({}),
  fieldValidation: z.record(z.string(), z.enum(["valid", "invalid", "unchecked"])).default({}),
  assumptions: z.array(z.string()).default([]),
  missingInputs: z.array(z.string()).default([]),
  mcpContextAvailable: z.boolean(),
  reviewRequired: z.boolean(),
  writesToMeta: z.boolean(),
});
export type MetaAdPlanAssistResponse = z.infer<typeof MetaAdPlanAssistResponseSchema>;

export const MetaAdPlanCreatedSchema = z.object({
  campaignId: IdSchema,
  recommendationId: IdSchema,
  title: z.string(),
  status: z.string(),
  message: z.string(),
});
export type MetaAdPlanCreated = z.infer<typeof MetaAdPlanCreatedSchema>;

export const MetaAdPlanApprovalResponseSchema = z.object({
  recommendation: z.object({
    id: IdSchema,
    actionType: z.string(),
    title: z.string(),
    status: z.string(),
    payload: z.record(z.string(), z.unknown()),
    executionResult: z.record(z.string(), z.unknown()).nullable().optional(),
  }).passthrough(),
  diff: z.array(z.object({
    field: z.string(),
    before: z.unknown().optional(),
    after: z.unknown().optional(),
  })),
  executed: z.boolean(),
  requiresConfirmation: z.boolean(),
  message: z.string(),
  auditLogId: z.string().nullable().optional(),
});
export type MetaAdPlanApprovalResponse = z.infer<typeof MetaAdPlanApprovalResponseSchema>;

export const MetaAdPlanActivationResponseSchema = z.object({
  recommendation: MetaAdPlanApprovalResponseSchema.shape.recommendation,
  executed: z.boolean(),
  requiresConfirmation: z.boolean(),
  targets: z.array(z.string()),
  activated: z.array(z.string()),
  message: z.string(),
  unavailableReason: z.string().nullable().optional(),
});
export type MetaAdPlanActivationResponse = z.infer<typeof MetaAdPlanActivationResponseSchema>;

export const MetaAdInsightSchema = z.object({
  metaAdId: z.string(),
  metaAdName: z.string(),
  creativeId: IdSchema.nullable(),
  prompt: z.string().nullable(),
  imageUrl: z.string().nullable(),
  referenceAnalysisId: z.string().nullable(),
  mapped: z.boolean(),
  dateStart: z.string().nullable(),
  dateEnd: z.string().nullable(),
  metrics: z.record(z.string(), z.number()),
  actions: z.array(z.record(z.string(), z.unknown())),
  retrievedAt: z.string(),
});
export type MetaAdInsight = z.infer<typeof MetaAdInsightSchema>;
export const MetaAdInsightsResponseSchema = z.object({
  campaignId: IdSchema,
  status: z.enum(["ok", "partial", "unavailable"]),
  reason: z.string().nullable(),
  dateStart: z.string(),
  dateEnd: z.string(),
  ads: z.array(MetaAdInsightSchema),
});
export type MetaAdInsightsResponse = z.infer<typeof MetaAdInsightsResponseSchema>;

/* ------------------------------------------------------------------ */
/* Reference analysis                                                  */
/* ------------------------------------------------------------------ */

export const ReferenceStyleElementSchema = z.object({
  element: z.string().default(""),
  relativePosition: z.string().default(""),
  relativeSize: z.string().default(""),
  visualAttributes: z.string().default(""),
  exactText: z.string().default(""),
  layerOrder: z.number().int().nullable().default(null),
});
export type ReferenceStyleElement = z.infer<typeof ReferenceStyleElementSchema>;

export const ReferenceStyleSchema = z.object({
  canvasRatio: z.string().default(""),
  background: z.string().default(""),
  lighting: z.string().default(""),
  visibleText: z.array(z.string()).default([]),
  elements: z.array(ReferenceStyleElementSchema).default([]),
  palette: z.array(z.string()).default([]),
  composition: z.string().default(""),
  typography: z.string().default(""),
  tone: z.string().default(""),
  layoutPattern: z.string().default(""),
  hookType: z.string().default(""),
  colorMood: z.string().default(""),
  textDensity: z.string().default(""),
  brandElements: z.array(z.string()).default([]),
  notes: z.string().default(""),
});
export type ReferenceStyle = z.infer<typeof ReferenceStyleSchema>;

export const ReferenceAnalysisSchema = z.object({
  id: IdSchema,
  sourceUrl: z.string().optional(),
  sourceName: z.string(),
  kind: CreativeKindSchema,
  status: z.enum(["ok", "partial", "unavailable"]).default("ok"),
  unavailableReason: z.string().optional(),
  hook: z.string(),
  structure: z.array(z.string()),
  visualStyle: z.array(z.string()),
  tone: z.array(z.string()),
  cta: z.string().optional(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  estimatedPerformance: z.enum(["low", "medium", "high", "unknown"]),
  inspiredBrief: z.string(),
  style: ReferenceStyleSchema.default(() => ReferenceStyleSchema.parse({})),
  observedOffers: z.array(z.string()).default([]),
  observedCta: z.array(z.string()).default([]),
  createdAt: IsoDateSchema,
});
export type ReferenceAnalysis = z.infer<typeof ReferenceAnalysisSchema>;

export type ChatAttachmentUpload = {
  /** `data:image/...;base64,...` — the payload the composer already builds. */
  source: string;
  fileName?: string;
  mime?: string;
};

export const ChatAttachmentSchema = z.object({
  id: IdSchema,
  name: z.string().default(""),
  mime: z.string().default("image/png"),
  createdAt: IsoDateSchema.nullable().optional(),
});
export type ChatAttachment = z.infer<typeof ChatAttachmentSchema>;

export const CreativeReferenceSchema = z.object({
  id: IdSchema,
  sourceName: z.string(),
  summary: z.string().default(""),
  style: ReferenceStyleSchema.default(() => ReferenceStyleSchema.parse({})),
  favorite: z.boolean().default(false),
  createdAt: IsoDateSchema.nullable().optional(),
});
export type CreativeReference = z.infer<typeof CreativeReferenceSchema>;

/* ------------------------------------------------------------------ */
/* Insights, Recommendations, Learnings                                */
/* ------------------------------------------------------------------ */

export const SeveritySchema = z.enum(["info", "warning", "critical"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const ActionTypeSchema = z.enum([
  "CREATE_CAMPAIGN",
  "CREATE_CREATIVE",
  "GENERATE_VARIATIONS",
  "ANALYZE_CAMPAIGN",
  "ANALYZE_CREATIVE",
  "RESEARCH_COMPETITORS",
  "OPTIMIZE_CAMPAIGN",
  "CONNECT_META",
  "APPLY_RECOMMENDATION",
  "ADD_TO_CAMPAIGN",
  "UPDATE_CAMPAIGN",
  // Research tools (agent tasks → results in a conversation)
  "ANALYZE_WEBSITE",
  "ANALYZE_SOCIAL_PROFILE",
  "ANALYZE_REVIEWS",
  "ANALYZE_MARKET",
  "ANALYZE_KEYWORDS",
  "ANALYZE_COMPETITOR_CREATIVES",
  "DETECT_MARKET_GAPS",
  // Generation tools
  "GENERATE_MARKETING_STRATEGY",
  "GENERATE_CONTENT_CALENDAR",
  "GENERATE_TEXT",
  "UPDATE_AGENT",
  "UPDATE_BRAND_PROFILE",
  "VIEW_USAGE",
]);
export type ActionType = z.infer<typeof ActionTypeSchema>;

/** An action reference as it appears in API payloads (insight buttons, chat action cards). */
export const ActionRefSchema = z.object({
  type: ActionTypeSchema,
  label: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
});
export type ActionRef = z.infer<typeof ActionRefSchema>;

export const ChangeDiffSchema = z.object({
  field: z.string(),
  label: z.string(),
  before: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  after: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});
export type ChangeDiff = z.infer<typeof ChangeDiffSchema>;

export const RecommendationSchema = z.object({
  id: IdSchema,
  campaignId: z.string().default("cmp_general"),
  title: z.string(),
  rationale: z.string(),
  expectedImpact: z.string(),
  confidence: z.number().min(0).max(1),
  changes: z.array(ChangeDiffSchema),
  status: z.enum(["pending", "applied", "dismissed"]),
  createdAt: IsoDateSchema,
});
export type Recommendation = z.infer<typeof RecommendationSchema>;

export const InsightSchema = z.object({
  id: IdSchema,
  campaignId: IdSchema.nullable(),
  creativeId: IdSchema.nullable(),
  severity: SeveritySchema,
  title: z.string(),
  observation: z.string(),
  explanation: z.string(),
  recommendedAction: z.string(),
  action: ActionRefSchema.nullable(),
  metric: z
    .object({
      label: z.string(),
      value: z.number(),
      unit: z.string().optional(),
      delta: z.number().optional(),
    })
    .optional(),
  createdAt: IsoDateSchema,
});
export type Insight = z.infer<typeof InsightSchema>;

export const LearningSchema = z.object({
  id: IdSchema,
  campaignId: IdSchema,
  category: z.enum(["audience", "creative", "timing", "budget", "messaging"]),
  statement: z.string(),
  evidence: z.string(),
  confidence: z.number().min(0).max(1),
  createdAt: IsoDateSchema,
});
export type Learning = z.infer<typeof LearningSchema>;

/* ------------------------------------------------------------------ */
/* Meta connection (state machine)                                     */
/* ------------------------------------------------------------------ */

export const MetaConnectionStatusSchema = z.enum([
  "not_connected",
  "connecting",
  "connected",
  "needs_reauth",
  "error",
]);
export type MetaConnectionStatus = z.infer<typeof MetaConnectionStatusSchema>;

export const MetaConnectionSchema = z.object({
  status: MetaConnectionStatusSchema,
  campaignReady: z.boolean().default(false),
  pageConfigured: z.boolean().default(false),
  accountId: z.string().nullable(),
  accountName: z.string().nullable(),
  pageName: z.string().nullable(),
  permissions: z.array(z.string()),
  connectedAt: IsoDateSchema.nullable(),
  expiresAt: IsoDateSchema.nullable(),
  errorMessage: z.string().nullable(),
});
export type MetaConnection = z.infer<typeof MetaConnectionSchema>;

/** Read-only campaign row fetched from the connected Meta account. */
export const MetaAccountCampaignSchema = z.object({
  metaCampaignId: z.string(),
  name: z.string(),
  objective: z.string().nullable(),
  status: z.string().nullable(),
  effectiveStatus: z.string().nullable(),
  createdTime: z.string().nullable(),
  startTime: z.string().nullable(),
  stopTime: z.string().nullable(),
});
export type MetaAccountCampaign = z.infer<typeof MetaAccountCampaignSchema>;

export const MetaAccountCampaignPageSchema = z.object({
  status: z.enum(["ok", "partial", "unavailable"]),
  source: z.string(),
  unavailableReason: z.string().nullable(),
  accountId: z.string().nullable(),
  campaigns: z.array(MetaAccountCampaignSchema),
  hasMore: z.boolean(),
  nextCursor: z.string().nullable(),
  retrievedAt: z.string().nullable(),
});
export type MetaAccountCampaignPage = z.infer<typeof MetaAccountCampaignPageSchema>;

export type ListMetaAccountCampaignsInput = {
  search?: string;
  limit?: number;
  after?: string;
};

/** One category-aware targeting option resolved by Meta Targeting Search. */
export const MetaInterestSuggestionSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: TargetingCategorySchema.default("interests"),
  audienceSize: z.number().nullable().optional(),
  description: z.string().nullable().optional(),
  path: z.array(z.string()).default([]),
});
export type MetaInterestSuggestion = z.infer<typeof MetaInterestSuggestionSchema>;

export const MetaTargetingSearchSchema = z.object({
  available: z.boolean().default(true),
  unavailableReason: z.string().nullable().optional(),
  results: z.array(MetaInterestSuggestionSchema).default([]),
  hasMore: z.boolean().default(false),
});
export type MetaTargetingSearch = z.infer<typeof MetaTargetingSearchSchema>;

/* ------------------------------------------------------------------ */
/* Agent tasks                                                         */
/* ------------------------------------------------------------------ */

export const AgentTaskStatusSchema = z.enum(["queued", "running", "succeeded", "failed"]);
export type AgentTaskStatus = z.infer<typeof AgentTaskStatusSchema>;

export const AgentTaskSchema = z.object({
  id: IdSchema,
  type: ActionTypeSchema,
  status: AgentTaskStatusSchema,
  label: z.string(),
  progress: z.number().min(0).max(100),
  steps: z.array(
    z.object({
      label: z.string(),
      status: AgentTaskStatusSchema,
    }),
  ),
  resultRef: z
    .object({
      entity: z.enum(["campaign", "creative", "insight", "recommendation", "analysis", "conversation"]),
      id: IdSchema,
    })
    .nullable(),
  result: z.record(z.string(), z.unknown()).nullable().optional(),
  error: z.string().nullable(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});
export type AgentTask = z.infer<typeof AgentTaskSchema>;

/* ------------------------------------------------------------------ */
/* Conversation & Message blocks                                       */
/* ------------------------------------------------------------------ */

export const TextBlockSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
  /** True while the backend is still streaming this block. */
  streaming: z.boolean().optional(),
});

export const FindingItemSchema = z.object({
  label: z.string(),
  title: z.string().optional(),
  detail: z.string(),
  sentiment: z.enum(["positive", "negative", "neutral"]).default("neutral"),
  source: z.string().nullable().optional(),
  confidence: z.union([z.number(), z.string()]).nullable().optional(),
  evidence: z.array(
    z.object({
      title: z.string().optional(),
      url: z.string().nullable().optional(),
      snippet: z.string().nullable().optional(),
      source: z.string().nullable().optional(),
    })
  ).default([]),
});
export type FindingItem = z.infer<typeof FindingItemSchema>;

export const FindingsBlockSchema = z.object({
  type: z.literal("findings"),
  title: z.string(),
  items: z.array(FindingItemSchema),
  findings: z.array(FindingItemSchema).optional(),
});
export type FindingsBlock = z.infer<typeof FindingsBlockSchema>;

export const RecommendationBlockSchema = z.object({
  type: z.literal("recommendation"),
  recommendation: RecommendationSchema.optional(),
  id: z.string().optional().nullable(),
  recommendationId: z.string().optional(),
  title: z.string().optional(),
  rationale: z.string().optional(),
  actionType: z.string().optional(),
  status: z.string().optional(),
  estimatedImpact: z.string().optional(),
}).transform((data) => {
  if (data.recommendation) {
    return {
      type: "recommendation" as const,
      recommendation: {
        ...data.recommendation,
        campaignId: data.recommendation.campaignId || "cmp_general",
      },
    };
  }
  return {
    type: "recommendation" as const,
    recommendation: {
      id: data.recommendationId || data.id || `rec_${Date.now()}`,
      campaignId: "cmp_general",
      title: data.title || "Strategic Recommendation",
      rationale: data.rationale || "",
      expectedImpact: data.estimatedImpact || "High",
      confidence: 0.8,
      changes: [],
      status: (data.status === "applied" ? "applied" : data.status === "dismissed" ? "dismissed" : "pending") as "pending" | "applied" | "dismissed",
      createdAt: new Date().toISOString(),
    },
  };
});

export const MetricBlockSchema = z.object({
  type: z.literal("metric"),
  metrics: z.array(
    z.object({
      label: z.string(),
      value: z.number(),
      unit: z.string().optional(),
      delta: z.number().optional(),
      format: z.enum(["number", "currency", "percent", "multiplier"]).default("number"),
    }),
  ),
});

export const ActionCardBlockSchema = z.object({
  type: z.literal("action_card"),
  title: z.string(),
  description: z.string().optional(),
  actions: z.array(ActionRefSchema).min(1),
});

export const TaskProgressBlockSchema = z.object({
  type: z.literal("task_progress"),
  taskId: IdSchema,
  task: AgentTaskSchema.optional(),
});

export const QuestionWithOptionsBlockSchema = z.object({
  type: z.literal("question_with_options"),
  question: z.string(),
  options: z.array(z.object({ id: z.string(), label: z.string(), description: z.string().optional() })).min(2),
  multiSelect: z.boolean().default(true),
  multi_select: z.boolean().optional(),
  answeredOptionIds: z.array(z.string()).optional(),
});
export type QuestionWithOptionsBlock = z.infer<typeof QuestionWithOptionsBlockSchema>;

export const ErrorBlockSchema = z.object({
  type: z.literal("error"),
  message: z.string(),
  retryable: z.boolean().default(true),
});

/** Brand-memory context the backend consulted to answer. */
export const ContextUsedBlockSchema = z.object({
  type: z.literal("context_used"),
  items: z.array(
    z.object({
      kind: z.string(),
      label: z.string(),
      detail: z.string().default(""),
      similarity: z.number().optional(),
      memoryId: z.string().optional(),
    }),
  ),
  tokenEstimate: z.number().int().nonnegative().default(0),
  truncated: z.boolean().default(false),
});

export const MessageBlockSchema = z.discriminatedUnion("type", [
  TextBlockSchema,
  FindingsBlockSchema,
  RecommendationBlockSchema,
  MetricBlockSchema,
  ActionCardBlockSchema,
  TaskProgressBlockSchema,
  ContextUsedBlockSchema,
  QuestionWithOptionsBlockSchema,
  ErrorBlockSchema,
]);
export type MessageBlock = z.infer<typeof MessageBlockSchema>;
export type MessageBlockType = MessageBlock["type"];

/**
 * A block whose `type` is unknown to this frontend version.
 * The renderer degrades these to plain text instead of crashing.
 */
export const UnknownBlockSchema = z
  .object({ type: z.string() })
  .passthrough();
export type UnknownBlock = z.infer<typeof UnknownBlockSchema>;

/** Wire-level block: known union OR unknown passthrough. */
export const AnyBlockSchema = z.union([MessageBlockSchema, UnknownBlockSchema]);
export type AnyBlock = z.infer<typeof AnyBlockSchema>;

export const ContextChipSchema = z.object({
  /**
   * `attachment` is an image the user attached to this message (uploaded through
   * `/assistant/attachments`). It is intentionally its own kind rather than a
   * `reference`: an attachment is "a picture to talk about", while a reference
   * is "a picture Layla must design from".
   */
  kind: z.enum(["campaign", "creative", "insight", "competitor", "reference", "attachment"]),
  id: IdSchema,
  label: z.string(),
});
export type ContextChip = z.infer<typeof ContextChipSchema>;

export const MessageSchema = z.object({
  id: IdSchema,
  conversationId: IdSchema,
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().optional(),
  blocks: z.array(AnyBlockSchema),
  context: z.array(ContextChipSchema).default([]),
  createdAt: IsoDateSchema,
});
export type Message = z.infer<typeof MessageSchema>;

export const AssistantConversationContextSchema = z.object({
  campaignId: IdSchema.nullable().optional(),
  creativeId: IdSchema.nullable().optional(),
  insightId: IdSchema.nullable().optional(),
  referenceAnalysisId: IdSchema.nullable().optional(),
  workflow: z.enum(["creative_prompt"]).nullable().optional(),
  promptType: z.enum(["image", "video"]).nullable().optional(),
  /** Sticky picker choice: chat, a written prompt, or an actual image. */
  creativeMode: z.enum(["chat", "prompt", "design"]).nullable().optional(),
  personaId: z.string().nullable().optional(),
  businessId: IdSchema.nullable().optional(),
});
export type AssistantConversationContext = z.infer<typeof AssistantConversationContextSchema>;

export const ConversationSchema = z.object({
  id: IdSchema,
  title: z.string(),
  lastMessagePreview: z.string(),
  messageCount: z.number().int().nonnegative(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
  context: AssistantConversationContextSchema.optional(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

/* ------------------------------------------------------------------ */
/* API input schemas                                                   */
/* ------------------------------------------------------------------ */

export const ListCampaignsInputSchema = z.object({
  status: CampaignStatusSchema.optional(),
  search: z.string().optional(),
});
export type ListCampaignsInput = z.infer<typeof ListCampaignsInputSchema>;

export const UpdateCampaignInputSchema = z.object({
  id: IdSchema,
  patch: z.object({
    name: z.string().optional(),
    status: CampaignStatusSchema.optional(),
    dailyBudget: z.number().nonnegative().optional(),
    endDate: IsoDateSchema.nullable().optional(),
  }),
});
export type UpdateCampaignInput = z.infer<typeof UpdateCampaignInputSchema>;

export const GenerateStrategyInputSchema = z.object({
  campaignName: z.string().optional(),
  objective: CampaignObjectiveSchema,
  audience: AudienceSchema.omit({ id: true }).partial(),
  dailyBudget: z.number().positive(),
  currency: z.string().length(3).optional(),
  brief: z.string().optional(),
  language: z.enum(["ar", "en"]).optional(),
});
export type GenerateStrategyInput = z.infer<typeof GenerateStrategyInputSchema>;

export const GenerateCreativeInputSchema = z.object({
  kind: CreativeKindSchema,
  brief: z.string().min(3),
  campaignId: IdSchema.nullable().default(null),
  referenceAnalysisId: IdSchema.optional(),
  referenceImageUrl: z.string().url().optional(),
  aspectRatio: z.enum(["1:1", "4:5", "9:16", "16:9"]).optional(),
  count: z.number().int().min(1).max(6).default(1),
});
export type GenerateCreativeInput = z.infer<typeof GenerateCreativeInputSchema>;

export const GenerateVariationsInputSchema = z.object({
  creativeId: IdSchema,
  count: z.number().int().min(1).max(6).default(3),
});
export type GenerateVariationsInput = z.infer<typeof GenerateVariationsInputSchema>;

export const AnalyzeReferenceInputSchema = z.object({
  /** PNG/JPEG/WebP data URL from the browser or a public remote image URL. */
  source: z.string().min(1),
  fileName: z.string().optional(),
  kind: CreativeKindSchema,
});
export type AnalyzeReferenceInput = z.infer<typeof AnalyzeReferenceInputSchema>;

export const ListInsightsInputSchema = z.object({
  campaignId: IdSchema.optional(),
  severity: SeveritySchema.optional(),
});
export type ListInsightsInput = z.infer<typeof ListInsightsInputSchema>;

export const SendMessageInputSchema = z.object({
  conversationId: IdSchema.nullable(),
  text: z.string().min(1),
  context: z.array(ContextChipSchema).default([]),
  language: z.enum(["en", "ar"]).optional(),
  personaId: z.string().optional(),
  workflow: z.enum(["creative_prompt"]).optional(),
  promptType: z.enum(["image", "video"]).optional(),
  creativeMode: z.enum(["chat", "prompt", "design"]).optional(),
  referenceAnalysisId: IdSchema.nullable().optional(),
  /** Images attached to this turn only (`POST /assistant/attachments`). */
  attachmentIds: z.array(IdSchema).max(4).optional(),
  /** Set when replying to a question_with_options block. */
  answer: z.object({ messageId: IdSchema, optionIds: z.array(z.string()) }).optional(),
});
export type SendMessageInput = z.infer<typeof SendMessageInputSchema>;

export const SendMessageOutputSchema = z.object({
  conversation: ConversationSchema,
  userMessage: MessageSchema,
  assistantMessage: MessageSchema,
});
export type SendMessageOutput = z.infer<typeof SendMessageOutputSchema>;

export type AssistantProgressEvent = {
  type: "started" | "conversation_started" | "step_started" | "tool_called" | "tool_result" | "failed";
  step?: string;
  detail?: string;
  status?: string;
  conversationId?: string;
};

export const ApplyRecommendationInputSchema = z.object({
  recommendationId: IdSchema,
});
export type ApplyRecommendationInput = z.infer<typeof ApplyRecommendationInputSchema>;

export const AddToCampaignInputSchema = z.object({
  campaignId: IdSchema,
  creativeId: IdSchema,
});
export type AddToCampaignInput = z.infer<typeof AddToCampaignInputSchema>;

export const StartTaskInputSchema = z.object({
  type: ActionTypeSchema,
  payload: z.record(z.string(), z.unknown()).default({}),
  conversationId: IdSchema.optional(),
});
export type StartTaskInput = z.infer<typeof StartTaskInputSchema>;

export const SettingsSchema = z.object({
  locale: LocaleSchema,
  timezone: z.string(),
  currency: z.string().length(3),
  notifications: z.object({
    email: z.boolean(),
    criticalInsights: z.boolean(),
    weeklyDigest: z.boolean(),
  }),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type ApiErrorShape = z.infer<typeof ApiErrorSchema>;

/* ------------------------------------------------------------------ */
/* Research tools                                                      */
/* ------------------------------------------------------------------ */

export const ResearchToolSchema = z.enum([
  "analyze_website",
  "analyze_competitor",
  "analyze_social_profile",
  "analyze_reviews",
  "analyze_market",
  "analyze_keywords",
  "analyze_competitor_creatives",
  "detect_market_gaps",
]);
export type ResearchTool = z.infer<typeof ResearchToolSchema>;

/* ------------------------------------------------------------------ */
/* Content calendar                                                    */
/* ------------------------------------------------------------------ */

export const ContentChannelSchema = z.enum(["instagram", "facebook", "tiktok", "email", "blog"]);
export type ContentChannel = z.infer<typeof ContentChannelSchema>;
export const ContentFormatSchema = z.enum(["post", "reel", "story", "ad", "email", "article"]);
export type ContentFormat = z.infer<typeof ContentFormatSchema>;
export const ContentStatusSchema = z.enum(["idea", "draft", "scheduled", "published"]);
export type ContentStatus = z.infer<typeof ContentStatusSchema>;

export const ContentItemSchema = z.object({
  id: IdSchema,
  /** YYYY-MM-DD in the business timezone */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  channel: ContentChannelSchema,
  format: ContentFormatSchema,
  title: z.string(),
  hook: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  hashtags: z.array(z.string()).default([]),
  status: ContentStatusSchema,
  campaignId: IdSchema.nullable(),
  creativeId: IdSchema.nullable(),
  pillar: z.string().nullable().optional(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});
export type ContentItem = z.infer<typeof ContentItemSchema>;

export const ListContentInputSchema = z.object({
  /** YYYY-MM */
  month: z.string().regex(/^\d{4}-\d{2}$/),
  campaignId: IdSchema.optional(),
});
export type ListContentInput = z.infer<typeof ListContentInputSchema>;

export const GenerateContentCalendarInputSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  campaignId: IdSchema.nullable().default(null),
  postsPerWeek: z.number().int().min(1).max(14).default(4),
  channels: z.array(ContentChannelSchema).min(1).default(["instagram", "facebook"]),
  brief: z.string().optional(),
});
export type GenerateContentCalendarInput = z.infer<typeof GenerateContentCalendarInputSchema>;

export const UpdateContentItemInputSchema = z.object({
  id: IdSchema,
  patch: ContentItemSchema.pick({ date: true, time: true, title: true, caption: true, status: true, channel: true, format: true }).partial(),
});
export type UpdateContentItemInput = z.infer<typeof UpdateContentItemInputSchema>;

/* ------------------------------------------------------------------ */
/* Text generation tools                                               */
/* ------------------------------------------------------------------ */

export const TextToolSchema = z.enum([
  "generate_creative_brief",
  "generate_commercial_script",
  "generate_image_prompt",
  "generate_video_prompt",
  "generate_ad_copy",
  "generate_ad_variations",
]);
export type TextTool = z.infer<typeof TextToolSchema>;

export const GenerateTextInputSchema = z.object({
  tool: TextToolSchema,
  brief: z.string().min(3),
  campaignId: IdSchema.nullable().default(null),
  creativeId: IdSchema.nullable().default(null),
  language: LocaleSchema.default("en"),
});
export type GenerateTextInput = z.infer<typeof GenerateTextInputSchema>;

export const GeneratedTextSchema = z.object({
  id: IdSchema,
  tool: TextToolSchema,
  title: z.string(),
  sections: z.array(z.object({ heading: z.string(), body: z.string() })).min(1),
  /** Flattened plain text for copy-to-clipboard / "use as brief". */
  plainText: z.string(),
  createdAt: IsoDateSchema,
});
export type GeneratedText = z.infer<typeof GeneratedTextSchema>;

/* ------------------------------------------------------------------ */
/* Agents & personas                                                   */
/* ------------------------------------------------------------------ */

export const AgentRoleSchema = z.enum(["researcher", "strategist", "creative", "analyst", "optimizer"]);
export type AgentRole = z.infer<typeof AgentRoleSchema>;

export const AgentToneSchema = z.enum(["professional", "friendly", "bold", "playful", "minimal"]);
export type AgentTone = z.infer<typeof AgentToneSchema>;

/** How much the agent may do without asking. Live campaign changes ALWAYS require human confirmation regardless. */
export const AgentAutonomySchema = z.enum(["ask_first", "suggest", "auto_draft"]);
export type AgentAutonomy = z.infer<typeof AgentAutonomySchema>;

// Keep this contract aligned with the backend persona catalog. The backend
// exposes the executable tool ids directly (for example `web_search` and
// `get_brand_context`), while the research/text schemas above also describe
// user-facing workflow names used elsewhere in the UI.
export const AgentToolSchema = z.enum([
  "analyze_website",
  "analyze_competitor",
  "analyze_social_profile",
  "analyze_market",
  "analyze_reviews",
  "analyze_keywords",
  "analyze_competitor_creatives",
  "detect_market_gaps",
  "generate_creative_brief",
  "generate_commercial_script",
  "generate_image_prompt",
  "generate_video_prompt",
  "generate_ad_copy",
  "generate_campaign_strategy",
  "generate_marketing_strategy",
  "generate_content_calendar",
  "generate_ad_variations",
  "search_web",
  "publish_meta_ads",
  "analyze_performance",
  "web_search",
  "get_social_profile",
  "get_reviews",
  "get_keywords",
  "get_competitor_ads",
  "get_brand_context",
  "save_learning",
  "analyze_reference_creative",
  "generate_image",
  "get_campaign_insights",
  "get_breakdowns",
  "create_recommendation",
]);
export type AgentTool = z.infer<typeof AgentToolSchema>;

export const AgentSchema = z.object({
  id: IdSchema,
  role: AgentRoleSchema,
  name: z.string().min(1),
  emoji: z.string().min(1),
  description: z.string(),
  persona: z.object({
    tone: AgentToneSchema,
    language: LocaleSchema,
    instructions: z.string().max(2000),
    signOff: z.string().optional(),
  }),
  allowedTools: z.array(AgentToolSchema),
  availableTools: z.array(AgentToolSchema),
  autonomy: AgentAutonomySchema,
  enabled: z.boolean(),
  updatedAt: IsoDateSchema,
});
export type Agent = z.infer<typeof AgentSchema>;

export const UpdateAgentInputSchema = z.object({
  id: IdSchema,
  patch: AgentSchema.pick({ name: true, emoji: true, persona: true, allowedTools: true, autonomy: true, enabled: true }).partial(),
});
export type UpdateAgentInput = z.infer<typeof UpdateAgentInputSchema>;

/* ------------------------------------------------------------------ */
/* Auth, workspaces & admin surfaces (P1 auth UI, P3 admin panel)      */
/* ------------------------------------------------------------------ */

/** Roles come straight from the backend membership row; unknown values degrade to `viewer`. */
export const RoleSchema = z.enum(["owner", "member", "viewer"]);
export type Role = z.infer<typeof RoleSchema>;

export const AuthUserSchema = z.object({
  id: IdSchema,
  email: z.string(),
  fullName: z.string().nullable().default(null),
  isActive: z.boolean().default(true),
  lastLoginAt: IsoDateSchema.nullable().optional(),
  createdAt: IsoDateSchema.nullable().optional(),
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

export const WorkspaceMembershipSchema = z.object({
  workspaceId: IdSchema,
  businessId: IdSchema,
  businessName: z.string(),
  role: RoleSchema,
  isPrimary: z.boolean().default(false),
});
export type WorkspaceMembership = z.infer<typeof WorkspaceMembershipSchema>;

/** `POST /auth/register|login|refresh` — the token plus everything needed to render the shell. */
export const AuthSessionSchema = z.object({
  accessToken: z.string().min(1),
  tokenType: z.string().default("Bearer"),
  expiresIn: z.number().int().nonnegative().default(0),
  user: AuthUserSchema,
  workspaces: z.array(WorkspaceMembershipSchema).default([]),
  activeWorkspaceId: z.string().nullable().default(null),
});
export type AuthSession = z.infer<typeof AuthSessionSchema>;

/** `GET /auth/me` — identity without a token, used as the boot check. */
export const SessionInfoSchema = z.object({
  user: AuthUserSchema,
  workspaces: z.array(WorkspaceMembershipSchema).default([]),
  activeWorkspaceId: z.string().nullable().default(null),
  activeRole: RoleSchema.nullable().default(null),
});
export type SessionInfo = z.infer<typeof SessionInfoSchema>;

export const LogoutResultSchema = z.object({ revoked: z.boolean() });
export type LogoutResult = z.infer<typeof LogoutResultSchema>;

/**
 * Client-side mirror of the backend password policy (P1.1 / P1.3) so a bad
 * password is caught before the round trip. The server stays authoritative —
 * this only removes a guaranteed 422.
 */
export const MIN_PASSWORD_LENGTH = 10;

export const RegisterInputSchema = z.object({
  email: z.string().min(3).max(320),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(256),
  fullName: z.string().max(200).optional(),
  workspaceName: z.string().min(1).max(200).optional(),
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = z.object({
  email: z.string().min(3).max(320),
  password: z.string().min(1).max(256),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

/* Business profile form ---------------------------------------------------- */

/**
 * The writable face of `GET /business/profile`. Scalars are nullable because the
 * backend distinguishes "unset" from "empty", and the form has to preserve that.
 */
export const BusinessProfileFormSchema = z.object({
  businessId: IdSchema,
  name: z.string(),
  industry: z.string().nullable().default(null),
  websiteUrl: z.string().nullable().default(null),
  country: z.string().nullable().default(null),
  language: z.string().default("en"),
  currency: z.string().nullable().default(null),
  monthlyBudget: z.number().nullable().default(null),
  dailyTokenBudget: z.number().int().nullable().default(null),
  goals: z.array(z.string()).default([]),
  brandVoice: z.string().nullable().default(null),
  visualStyle: z.string().nullable().default(null),
  targetAudience: z.string().nullable().default(null),
  keyOffers: z.array(z.string()).default([]),
  competitors: z.array(z.string()).default([]),
  updatedAt: IsoDateSchema.nullable().optional(),
});
export type BusinessProfileForm = z.infer<typeof BusinessProfileFormSchema>;

/**
 * `PATCH /business/profile` uses **exclude-unset** semantics, and the distinction
 * is the whole point: an omitted key leaves the stored value alone, an explicit
 * `null` clears a scalar, and `[]`/`null` empties a list. So every field is
 * `.optional()` (omit) *and* `.nullable()` (clear) — never give them a default,
 * because a defaulted key would be indistinguishable from "not sent".
 */
export const BusinessProfileUpdateInputSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  industry: z.string().max(120).nullable().optional(),
  websiteUrl: z.string().max(500).nullable().optional(),
  country: z.string().max(2).nullable().optional(),
  language: z.string().max(2).nullable().optional(),
  currency: z.string().max(8).nullable().optional(),
  monthlyBudget: z.number().nonnegative().nullable().optional(),
  dailyTokenBudget: z.number().int().nonnegative().nullable().optional(),
  goals: z.array(z.string().max(200)).max(50).nullable().optional(),
  brandVoice: z.string().max(4000).nullable().optional(),
  visualStyle: z.string().max(4000).nullable().optional(),
  targetAudience: z.string().max(4000).nullable().optional(),
  keyOffers: z.array(z.string().max(200)).max(50).nullable().optional(),
  competitors: z.array(z.string().max(200)).max(50).nullable().optional(),
});
export type BusinessProfileUpdateInput = z.infer<typeof BusinessProfileUpdateInputSchema>;

/* Brand memory ------------------------------------------------------------- */

export const MemoryKindSchema = z.enum([
  "voice_example",
  "visual_style",
  "offer",
  "audience",
  "competitor_note",
  "learning",
  "reference_analysis",
]);
export type MemoryKind = z.infer<typeof MemoryKindSchema>;

/** The seven writable kinds, in the order the backend declares them. */
export const MEMORY_KINDS: readonly MemoryKind[] = MemoryKindSchema.options;

export const MemoryItemSchema = z.object({
  id: IdSchema,
  businessId: IdSchema,
  kind: MemoryKindSchema,
  text: z.string(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  campaignId: z.string().nullable().default(null),
  createdAt: IsoDateSchema.nullable().optional(),
  /** Only present on a similarity search (`GET /memory/items?q=`). */
  score: z.number().nullable().optional(),
});
export type MemoryItem = z.infer<typeof MemoryItemSchema>;

export const MemoryItemListSchema = z.object({
  items: z.array(MemoryItemSchema).default([]),
  total: z.number().int().default(0),
  limit: z.number().int().default(50),
  kind: z.string().nullable().default(null),
  query: z.string().nullable().default(null),
  /** `recent` = newest first, `similar` = embedding similarity to `q`. Never assume substring matching. */
  mode: z.enum(["recent", "similar"]).default("recent"),
});
export type MemoryItemList = z.infer<typeof MemoryItemListSchema>;

export const ListMemoryItemsInputSchema = z.object({
  kind: MemoryKindSchema.optional(),
  q: z.string().max(200).optional(),
  limit: z.number().int().min(1).max(200).optional(),
});
export type ListMemoryItemsInput = z.infer<typeof ListMemoryItemsInputSchema>;

export const CreateMemoryItemInputSchema = z.object({
  kind: MemoryKindSchema,
  text: z.string().min(1).max(4000),
  metadata: z.record(z.string(), z.unknown()).default({}),
  campaignId: z.string().nullable().default(null),
});
export type CreateMemoryItemInput = z.infer<typeof CreateMemoryItemInputSchema>;

/** `kind` is intentionally not editable server-side — re-kind by delete + create. */
export const UpdateMemoryItemInputSchema = z.object({
  id: IdSchema,
  text: z.string().min(1).max(4000).optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type UpdateMemoryItemInput = z.infer<typeof UpdateMemoryItemInputSchema>;

export const MemoryReindexResultSchema = z.object({
  reindexed: z.number().int().default(0),
  kind: z.string().nullable().default(null),
  itemIds: z.array(z.string()).default([]),
});
export type MemoryReindexResult = z.infer<typeof MemoryReindexResultSchema>;

/* Connectors --------------------------------------------------------------- */

export const ConnectorSourceSchema = z.enum(["workspace", "env", "default", "unset"]);
export type ConnectorSource = z.infer<typeof ConnectorSourceSchema>;

/**
 * One resolved connector field. `value` is **always null when `secret` is true** —
 * the backend never puts a secret on the wire, so a form renders an empty password
 * input plus a "configured" hint, never a pre-filled value.
 */
export const ConnectorFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  secret: z.boolean().default(false),
  required: z.boolean().default(false),
  maxLength: z.number().int().default(500),
  description: z.string().default(""),
  value: z.string().nullable().default(null),
  hasValue: z.boolean().default(false),
  masked: z.string().nullable().default(null),
  source: ConnectorSourceSchema.default("unset"),
});
export type ConnectorField = z.infer<typeof ConnectorFieldSchema>;

export const ConnectorSchema = z.object({
  connector: z.string(),
  label: z.string(),
  source: ConnectorSourceSchema.default("unset"),
  hasOverride: z.boolean().default(false),
  configured: z.boolean().default(false),
  provider: z.string().nullable().default(null),
  /** True when the chosen provider returns placeholder data rather than live data. */
  placeholder: z.boolean().default(false),
  fields: z.array(ConnectorFieldSchema).default([]),
  notes: z.string().default(""),
});
export type Connector = z.infer<typeof ConnectorSchema>;

export const ConnectorSettingsSchema = z.object({
  businessId: IdSchema,
  environment: z.string(),
  overrideCount: z.number().int().default(0),
  connectors: z.array(ConnectorSchema).default([]),
  encryptionKeyConfigured: z.boolean().default(true),
});
export type ConnectorSettings = z.infer<typeof ConnectorSettingsSchema>;

/**
 * `PATCH /settings/connectors/{connector}` takes one flat camelCase body for all
 * connectors. `null` or `""` clears a stored value; an omitted key leaves it.
 * Sending a key the addressed connector does not own is a 422, never a silent drop.
 */
export const ConnectorUpdateInputSchema = z.object({
  appId: z.string().max(120).nullable().optional(),
  appSecret: z.string().nullable().optional(),
  adAccountId: z.string().max(120).nullable().optional(),
  pageId: z.string().max(120).nullable().optional(),
  accessToken: z.string().nullable().optional(),
  baseUrl: z.string().max(500).nullable().optional(),
  apiKey: z.string().nullable().optional(),
  provider: z.string().max(30).nullable().optional(),
  login: z.string().max(200).nullable().optional(),
  password: z.string().nullable().optional(),
  model: z.string().max(80).nullable().optional(),
});
export type ConnectorUpdateInput = z.infer<typeof ConnectorUpdateInputSchema>;

export const ConnectorDeleteResultSchema = z.object({
  connector: z.string(),
  removed: z.boolean(),
  source: ConnectorSourceSchema.default("env"),
  configured: z.boolean().default(false),
});
export type ConnectorDeleteResult = z.infer<typeof ConnectorDeleteResultSchema>;

/* LLM providers ------------------------------------------------------------ */

export const LlmProviderSchema = z.enum([
  "mock", "openai", "claude", "groq", "gemini", "deepseek", "mistral",
  "openrouter", "together", "fireworks", "perplexity", "xai", "custom",
]);
export type LlmProvider = z.infer<typeof LlmProviderSchema>;

export const LlmTierSettingsSchema = z.object({
  provider: LlmProviderSchema,
  model: z.string(),
  baseUrl: z.string().nullable().default(null),
  keyConfigured: z.boolean().default(false),
  keySource: z.enum(["workspace", "environment", "missing"]).default("missing"),
  extraHeadersConfigured: z.boolean().default(false),
  extraHeadersSource: z.enum(["workspace", "environment", "missing"]).default("missing"),
});
export type LlmTierSettings = z.infer<typeof LlmTierSettingsSchema>;

export const LlmSettingsSchema = z.object({
  businessId: IdSchema,
  fast: LlmTierSettingsSchema,
  strong: LlmTierSettingsSchema,
  hasWorkspaceOverride: z.boolean().default(false),
  encryptionKeyConfigured: z.boolean().default(true),
});
export type LlmSettings = z.infer<typeof LlmSettingsSchema>;

export const LlmTierUpdateInputSchema = z.object({
  provider: LlmProviderSchema.optional(),
  model: z.string().max(120).nullable().optional(),
  apiKey: z.string().nullable().optional(),
  baseUrl: z.string().max(500).nullable().optional(),
  extraHeaders: z.record(z.string(), z.string()).nullable().optional(),
});
export type LlmTierUpdateInput = z.infer<typeof LlmTierUpdateInputSchema>;

export const LlmSettingsUpdateInputSchema = z.object({
  fast: LlmTierUpdateInputSchema.optional(),
  strong: LlmTierUpdateInputSchema.optional(),
});
export type LlmSettingsUpdateInput = z.infer<typeof LlmSettingsUpdateInputSchema>;

/* Usage -------------------------------------------------------------------- */

export const UsagePeriodSchema = z.enum(["today", "month"]);
export type UsagePeriod = z.infer<typeof UsagePeriodSchema>;

export const UsageBreakdownSchema = z.object({
  key: z.string(),
  tokens: z.number().int().default(0),
  /** Share of the period total, 0..1. */
  share: z.number().default(0),
});
export type UsageBreakdown = z.infer<typeof UsageBreakdownSchema>;

/**
 * `percentUsed` is deliberately **unclamped**: 140% must be renderable, otherwise
 * "at the limit" and "double the limit" look identical. `burnRatePerHour` and
 * `projectedTotalTokens` are a linear extrapolation and the UI must say so.
 */
export const UsageSchema = z.object({
  workspaceId: IdSchema,
  businessId: IdSchema,
  period: z.string(),
  tokensIn: z.number().int().default(0),
  tokensOut: z.number().int().default(0),
  totalTokens: z.number().int().default(0),
  budgetTokens: z.number().int().default(0),
  remainingTokens: z.number().int().default(0),
  percentUsed: z.number().default(0),
  exceeded: z.boolean().default(false),
  resetAt: IsoDateSchema,
  periodStart: IsoDateSchema,
  calls: z.number().int().default(0),
  burnRatePerHour: z.number().default(0),
  projectedTotalTokens: z.number().int().default(0),
  budgetSource: z.string().default("default"),
  byModel: z.array(UsageBreakdownSchema).default([]),
  byPersona: z.array(UsageBreakdownSchema).default([]),
  /** Tokens per action (`chat.turn`, `research.analyze_website`, ...). */
  byAction: z.array(UsageBreakdownSchema).default([]),
  /** Calls billed from an estimate because the provider reported no usage. */
  estimatedCalls: z.number().int().default(0),
  /** Null unless the workspace configured a token price — never a guess. */
  estimatedCostUsd: z.number().nullable().default(null),
  costPerMillionInUsd: z.number().default(0),
  costPerMillionOutUsd: z.number().default(0),
});
export type Usage = z.infer<typeof UsageSchema>;

/* Audit -------------------------------------------------------------------- */

export const AuditEntrySchema = z.object({
  id: IdSchema,
  actor: z.string().default("system"),
  action: z.string(),
  entityType: z.string().default("recommendation"),
  entityId: z.string().nullable().default(null),
  businessId: z.string().nullable().default(null),
  requestId: z.string().nullable().default(null),
  /** Redacted server-side — never a raw secret. */
  before: z.record(z.string(), z.unknown()).nullable().default(null),
  after: z.record(z.string(), z.unknown()).nullable().default(null),
  result: z.record(z.string(), z.unknown()).nullable().default(null),
  createdAt: IsoDateSchema.nullable().optional(),
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

export const AuditListSchema = z.object({
  entries: z.array(AuditEntrySchema).default([]),
  limit: z.number().int().default(50),
  total: z.number().int().default(0),
  entityType: z.string().nullable().default(null),
  entityId: z.string().nullable().default(null),
  actor: z.string().nullable().default(null),
});
export type AuditList = z.infer<typeof AuditListSchema>;

export const AuditFiltersSchema = z.object({
  entityType: z.string().max(60).optional(),
  entityId: z.string().max(64).optional(),
  actor: z.string().max(120).optional(),
  action: z.string().max(80).optional(),
  limit: z.number().int().min(1).max(500).optional(),
});
export type AuditFilters = z.infer<typeof AuditFiltersSchema>;

/** Addresses the backend ships with a known-password list; mirrored for instant feedback. */
export const BREACHED_PASSWORDS: readonly string[] = [
  "password",
  "password1",
  "password123",
  "1234567890",
  "12345678901",
  "qwertyuiop",
  "iloveyou123",
  "administrator",
  "letmein1234",
  "welcome1234",
];

export type PasswordProblem = "length" | "breached" | "whitespace";

/** `null` when the password is acceptable, otherwise the reason to show. */
export function checkPasswordPolicy(password: string): PasswordProblem | null {
  if (password.length < MIN_PASSWORD_LENGTH) return "length";
  if (BREACHED_PASSWORDS.includes(password.toLowerCase())) return "breached";
  if (password.trim() !== password) return "whitespace";
  return null;
}

/* ------------------------------------------------------------------ */
/* Comprehensive Brand Identity                                        */
/* ------------------------------------------------------------------ */

export const ColorPaletteSchema = z.object({
  primary: z.string().default("#2563EB"),
  secondary: z.string().default("#1E293B"),
  accent: z.string().default("#F59E0B"),
  background: z.string().default("#F8FAFC"),
  text: z.string().default("#0F172A"),
  palette: z.array(z.string()).default([]),
});
export type ColorPalette = z.infer<typeof ColorPaletteSchema>;

export const SWOTAnalysisSchema = z.object({
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  opportunities: z.array(z.string()).default([]),
  threats: z.array(z.string()).default([]),
});
export type SWOTAnalysis = z.infer<typeof SWOTAnalysisSchema>;

export const IdentityEssenceSchema = z.object({
  tagline: z.string().nullable().optional().default(""),
  mission: z.string().nullable().optional().default(""),
  vision: z.string().nullable().optional().default(""),
  brandVoice: z.string().nullable().optional().default(""),
  toneKeywords: z.array(z.string()).default([]),
  archetype: z.string().nullable().optional(),
});
export type IdentityEssence = z.infer<typeof IdentityEssenceSchema>;

export const TargetAudienceProfileSchema = z.object({
  summary: z.string().nullable().optional().default(""),
  demographics: z.string().nullable().optional().default(""),
  painPoints: z.array(z.string()).default([]),
  goals: z.array(z.string()).default([]),
});
export type TargetAudienceProfile = z.infer<typeof TargetAudienceProfileSchema>;

export const BrandIdentityResponseSchema = z.object({
  businessId: z.string(),
  brandName: z.string(),
  industry: z.string(),
  palette: ColorPaletteSchema,
  essence: IdentityEssenceSchema,
  targetAudience: TargetAudienceProfileSchema,
  swot: SWOTAnalysisSchema,
  keyOffers: z.array(z.string()).default([]),
  competitors: z.array(z.string()).default([]),
  marketGaps: z.array(z.string()).default([]),
  syncedAt: z.string().nullable().optional(),
});
export type BrandIdentityResponse = z.infer<typeof BrandIdentityResponseSchema>;

export type BrandIdentityUpdateRequest = Partial<{
  brandName: string;
  industry: string;
  palette: Partial<ColorPalette>;
  essence: Partial<IdentityEssence>;
  targetAudience: Partial<TargetAudienceProfile>;
  swot: Partial<SWOTAnalysis>;
  keyOffers: string[];
  competitors: string[];
  marketGaps: string[];
}>;

