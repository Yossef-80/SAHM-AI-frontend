import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

export const IdSchema = z.string().min(1);
export const IsoDateSchema = z.string().datetime({ offset: true });
export const LocaleSchema = z.enum(["en", "ar"]);
export type Locale = z.infer<typeof LocaleSchema>;

/* ------------------------------------------------------------------ */
/* Business & Brand                                                    */
/* ------------------------------------------------------------------ */

export const BusinessSchema = z.object({
  id: IdSchema,
  name: z.string(),
  industry: z.string(),
  website: z.string().url().optional(),
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
  logoUrl: z.string().url().optional(),
  tagline: z.string().optional(),
  doNotUse: z.array(z.string()).default([]),
  languages: z.array(LocaleSchema),
});
export type BrandProfile = z.infer<typeof BrandProfileSchema>;

/* ------------------------------------------------------------------ */
/* Audience                                                            */
/* ------------------------------------------------------------------ */

export const AudienceSchema = z.object({
  id: IdSchema,
  name: z.string(),
  ageMin: z.number().int().min(13),
  ageMax: z.number().int().max(65),
  genders: z.array(z.enum(["male", "female", "all"])),
  locations: z.array(z.string()),
  interests: z.array(z.string()),
  behaviors: z.array(z.string()).default([]),
  estimatedReach: z.number().int().nonnegative().optional(),
});
export type Audience = z.infer<typeof AudienceSchema>;

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
  /** For image/video: URL of the asset. For copy: undefined. */
  assetUrl: z.string().url().optional(),
  /** Thumbnail / preview URL (image or video poster). */
  thumbnailUrl: z.string().url().optional(),
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

/* ------------------------------------------------------------------ */
/* Reference analysis                                                  */
/* ------------------------------------------------------------------ */

export const ReferenceAnalysisSchema = z.object({
  id: IdSchema,
  sourceUrl: z.string().url().optional(),
  sourceName: z.string(),
  kind: CreativeKindSchema,
  hook: z.string(),
  structure: z.array(z.string()),
  visualStyle: z.array(z.string()),
  tone: z.array(z.string()),
  cta: z.string().optional(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  estimatedPerformance: z.enum(["low", "medium", "high"]),
  inspiredBrief: z.string(),
  createdAt: IsoDateSchema,
});
export type ReferenceAnalysis = z.infer<typeof ReferenceAnalysisSchema>;

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
  campaignId: IdSchema,
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
  accountId: z.string().nullable(),
  accountName: z.string().nullable(),
  pageName: z.string().nullable(),
  permissions: z.array(z.string()),
  connectedAt: IsoDateSchema.nullable(),
  expiresAt: IsoDateSchema.nullable(),
  errorMessage: z.string().nullable(),
});
export type MetaConnection = z.infer<typeof MetaConnectionSchema>;

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

export const FindingsBlockSchema = z.object({
  type: z.literal("findings"),
  title: z.string(),
  items: z.array(
    z.object({
      label: z.string(),
      detail: z.string(),
      sentiment: z.enum(["positive", "negative", "neutral"]).default("neutral"),
    }),
  ),
});

export const RecommendationBlockSchema = z.object({
  type: z.literal("recommendation"),
  recommendation: RecommendationSchema,
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
  multiSelect: z.boolean().default(false),
  answeredOptionIds: z.array(z.string()).optional(),
});

export const ErrorBlockSchema = z.object({
  type: z.literal("error"),
  message: z.string(),
  retryable: z.boolean().default(true),
});

export const MessageBlockSchema = z.discriminatedUnion("type", [
  TextBlockSchema,
  FindingsBlockSchema,
  RecommendationBlockSchema,
  MetricBlockSchema,
  ActionCardBlockSchema,
  TaskProgressBlockSchema,
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
  kind: z.enum(["campaign", "creative", "insight"]),
  id: IdSchema,
  label: z.string(),
});
export type ContextChip = z.infer<typeof ContextChipSchema>;

export const MessageSchema = z.object({
  id: IdSchema,
  conversationId: IdSchema,
  role: z.enum(["user", "assistant", "system"]),
  blocks: z.array(AnyBlockSchema),
  context: z.array(ContextChipSchema).default([]),
  createdAt: IsoDateSchema,
});
export type Message = z.infer<typeof MessageSchema>;

export const ConversationSchema = z.object({
  id: IdSchema,
  title: z.string(),
  lastMessagePreview: z.string(),
  messageCount: z.number().int().nonnegative(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
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
  objective: CampaignObjectiveSchema,
  audience: AudienceSchema.omit({ id: true }).partial(),
  dailyBudget: z.number().positive(),
  brief: z.string().optional(),
});
export type GenerateStrategyInput = z.infer<typeof GenerateStrategyInputSchema>;

export const GenerateCreativeInputSchema = z.object({
  kind: CreativeKindSchema,
  brief: z.string().min(3),
  campaignId: IdSchema.nullable().default(null),
  referenceAnalysisId: IdSchema.optional(),
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
  /** Base64 data URL or remote URL. Backend accepts either. */
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
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  channel: ContentChannelSchema,
  format: ContentFormatSchema,
  title: z.string(),
  hook: z.string().optional(),
  caption: z.string().optional(),
  hashtags: z.array(z.string()).default([]),
  status: ContentStatusSchema,
  campaignId: IdSchema.nullable(),
  creativeId: IdSchema.nullable(),
  pillar: z.string().optional(),
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

export const AgentToolSchema = z.union([ResearchToolSchema, TextToolSchema, z.enum(["generate_campaign_strategy", "generate_marketing_strategy", "generate_content_calendar", "generate_ad_variations", "search_web", "publish_meta_ads", "analyze_performance"])]);
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
