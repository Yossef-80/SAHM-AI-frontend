import type { MarketingApi } from "./types";
import { ApiError } from "./types";
import * as fx from "@/lib/mock/fixtures";
import * as fxx from "@/lib/mock/fixtures-extra";
import * as fxa from "@/lib/mock/fixtures-admin";
import { useAuthStore } from "@/store/auth-store";
import type {
  AgentTask,
  AuditFilters,
  AuditList,
  AuthSession,
  BusinessProfileForm,
  BusinessProfileUpdateInput,
  Campaign,
  CampaignDraft,
  Connector,
  ConnectorDeleteResult,
  ConnectorSettings,
  ConnectorUpdateInput,
  Conversation,
  CreateMemoryItemInput,
  Creative,
  Insight,
  Learning,
  ListMemoryItemsInput,
  LlmSettings,
  LlmSettingsUpdateInput,
  LoginInput,
  LogoutResult,
  MemoryItem,
  MemoryItemList,
  MemoryReindexResult,
  Message,
  MetaConnection,
  Recommendation,
  ReferenceAnalysis,
  RegisterInput,
  SendMessageInput,
  SendMessageOutput,
  SessionInfo,
  Settings,
  ActionType,
  AnyBlock,
  AgentTaskStatus,
  Agent,
  ContentItem,
  GeneratedText,
  UpdateMemoryItemInput,
  Usage,
  UsagePeriod,
} from "@/types";
import {
  AddToCampaignInputSchema,
  AnalyzeReferenceInputSchema,
  ApplyRecommendationInputSchema,
  CampaignDraftSchema,
  GenerateCreativeInputSchema,
  GenerateStrategyInputSchema,
  GenerateVariationsInputSchema,
  SendMessageInputSchema,
  StartTaskInputSchema,
  UpdateCampaignInputSchema,
  GenerateContentCalendarInputSchema,
  GenerateTextInputSchema,
  ListContentInputSchema,
  UpdateAgentInputSchema,
  UpdateContentItemInputSchema,
} from "@/types";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const ERROR_RATE = Number(process.env.NEXT_PUBLIC_MOCK_ERROR_RATE ?? "0.1");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const latency = () => sleep(300 + Math.random() * 500);
const now = () => new Date().toISOString();
let seq = 1000;
const uid = (prefix: string) => `${prefix}_${++seq}`;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/** Simulates a realistic call: latency + occasional failure. */
async function simulate(opts: { safe?: boolean } = {}) {
  await latency();
  if (!opts.safe && Math.random() < ERROR_RATE) {
    throw new ApiError("MOCK_RANDOM_FAILURE", "Simulated network error – please retry.", 503);
  }
}

/* ------------------------------------------------------------------ */
/* In-memory state                                                     */
/* ------------------------------------------------------------------ */

type State = {
  campaigns: Campaign[];
  businessProfile: BusinessProfileForm;
  memory: MemoryItem[];
  connectors: ConnectorSettings;
  audit: AuditList;
  creatives: Creative[];
  recommendations: Recommendation[];
  insights: Insight[];
  learnings: Learning[];
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  tasks: Record<string, AgentTask>;
  analyses: Record<string, ReferenceAnalysis>;
  meta: MetaConnection;
  settings: Settings;
  content: Record<string, ContentItem[]>;
  agents: Agent[];
};

const state: State = {
  campaigns: clone(fx.campaigns),
  businessProfile: clone(fxa.mockBusinessProfile) as BusinessProfileForm,
  memory: clone(fxa.mockMemoryItems),
  connectors: clone(fxa.mockConnectorSettings),
  audit: clone(fxa.mockAuditList),
  creatives: clone(fx.creatives),
  recommendations: clone(fx.recommendations),
  insights: clone(fx.insights),
  learnings: clone(fx.learnings),
  conversations: clone(fx.conversations),
  messages: clone(fx.messages),
  tasks: {},
  analyses: {},
  meta: clone(fx.metaConnection),
  settings: clone(fx.settings),
  content: {},
  agents: clone(fxx.agents),
};

const img = (seed: string, w = 800, h = 800) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

function findOr404<T extends { id: string }>(list: T[], id: string, entity: string): T {
  const found = list.find((x) => x.id === id);
  if (!found) throw new ApiError("NOT_FOUND", `${entity} ${id} not found`, 404);
  return found;
}

/* ------------------------------------------------------------------ */
/* Task simulation                                                     */
/* ------------------------------------------------------------------ */

const TASK_STEPS: Record<ActionType, string[]> = {
  CREATE_CAMPAIGN: ["Analyze business", "Draft strategy", "Build audience", "Prepare creatives"],
  CREATE_CREATIVE: ["Read brand profile", "Draft concepts", "Render asset", "Score creative"],
  GENERATE_VARIATIONS: ["Analyze source creative", "Generate variants", "Score variants"],
  ANALYZE_CAMPAIGN: ["Pull Meta metrics", "Compare to benchmarks", "Identify root causes", "Write findings"],
  ANALYZE_CREATIVE: ["Extract visual features", "Compare to winners", "Write critique"],
  RESEARCH_COMPETITORS: ["Query Ad Library", "Cluster offers", "Summarize positioning"],
  OPTIMIZE_CAMPAIGN: ["Pull metrics", "Simulate changes", "Rank recommendations"],
  CONNECT_META: ["Open OAuth", "Verify permissions", "Sync ad account"],
  APPLY_RECOMMENDATION: ["Validate change", "Push to Meta", "Verify"],
  ADD_TO_CAMPAIGN: ["Validate creative", "Attach to ad set"],
  UPDATE_CAMPAIGN: ["Validate change", "Push to Meta", "Verify"],
  ANALYZE_WEBSITE: ["Crawl pages", "Extract positioning & offers", "Infer audience", "Draft brand notes"],
  ANALYZE_SOCIAL_PROFILE: ["Fetch profile & recent posts", "Score content pillars", "Benchmark engagement"],
  ANALYZE_REVIEWS: ["Collect reviews", "Cluster themes", "Extract quotes & sentiment"],
  ANALYZE_MARKET: ["Size the market", "Map segments", "Identify trends"],
  ANALYZE_KEYWORDS: ["Seed keywords", "Expand & cluster", "Estimate volume & intent"],
  ANALYZE_COMPETITOR_CREATIVES: ["Query Ad Library", "Classify hooks & formats", "Rank by longevity"],
  DETECT_MARKET_GAPS: ["Merge research", "Find unserved needs", "Rank opportunities"],
  GENERATE_MARKETING_STRATEGY: ["Read brand & research", "Define positioning", "Plan channels & budget", "Set KPIs"],
  GENERATE_CONTENT_CALENDAR: ["Pick content pillars", "Schedule posts", "Write hooks"],
  GENERATE_TEXT: ["Read brand voice", "Draft", "Polish"],
  UPDATE_AGENT: ["Save"],
};

const taskCallbacks: Record<string, (task: AgentTask) => void> = {};

function advanceTask(task: AgentTask) {
  const total = task.steps.length;
  const tick = () => {
    const current = state.tasks[task.id];
    if (!current) return;
    const idx = current.steps.findIndex((s) => s.status !== "succeeded");
    if (idx === -1) return;
    if (Math.random() < 0.05) {
      current.status = "failed";
      current.error = "Agent step failed: upstream timeout";
      current.steps[idx].status = "failed";
      current.updatedAt = now();
      return;
    }
    current.steps[idx].status = "succeeded";
    if (idx + 1 < total) current.steps[idx + 1].status = "running";
    current.progress = Math.round(((idx + 1) / total) * 100);
    current.status = idx + 1 === total ? "succeeded" : "running";
    current.updatedAt = now();
    if (current.status !== "succeeded") setTimeout(tick, 900 + Math.random() * 900);
    else taskCallbacks[current.id]?.(current);
  };
  setTimeout(tick, 700);
}

function createTask(
  type: ActionType,
  label: string,
  resultRef: AgentTask["resultRef"] = null,
  onComplete?: (task: AgentTask) => void,
): AgentTask {
  const steps = TASK_STEPS[type].map((s, i) => ({ label: s, status: (i === 0 ? "running" : "queued") as AgentTaskStatus }));
  const task: AgentTask = {
    id: uid("task"),
    type,
    status: "running",
    label,
    progress: 0,
    steps,
    resultRef,
    error: null,
    createdAt: now(),
    updatedAt: now(),
  };
  state.tasks[task.id] = task;
  if (onComplete) taskCallbacks[task.id] = onComplete;
  advanceTask(task);
  return task;
}

/** Result blocks appended to the conversation when an agent task finishes. */
function taskResultBlocks(type: ActionType, payload: Record<string, unknown>): AnyBlock[] {
  const campaignId = typeof payload.campaignId === "string" ? payload.campaignId : "cmp_1";
  const campaign = state.campaigns.find((c) => c.id === campaignId);
  switch (type) {
    case "RESEARCH_COMPETITORS":
      return [clone(fx.messages.conv_2[1].blocks[0]), clone(fx.messages.conv_2[1].blocks[1])];
    case "ANALYZE_CREATIVE":
      return [
        {
          type: "findings",
          title: "Creative critique",
          items: [
            { label: "Hook", detail: "Product appears at 0.4s – strong", sentiment: "positive" },
            { label: "Text density", detail: "Headline is 11 words; aim for ≤6", sentiment: "negative" },
            { label: "CTA", detail: "Single CTA at end only", sentiment: "neutral" },
          ],
        },
        {
          type: "action_card",
          title: "Improve it",
          actions: [{ type: "GENERATE_VARIATIONS", label: "Generate 3 variations", payload: { creativeId: payload.creativeId ?? "cr_2", count: 3 } }],
        },
      ];
    case "OPTIMIZE_CAMPAIGN": {
      const recs = state.recommendations.filter((r) => r.campaignId === campaignId && r.status === "pending");
      return [
        { type: "text", text: `I found ${recs.length} optimization${recs.length === 1 ? "" : "s"} for ${campaign?.name ?? "this campaign"}. Each needs your approval before anything changes.` },
        ...recs.map((r) => ({ type: "recommendation" as const, recommendation: clone(r) })),
      ];
    }
    case "ANALYZE_WEBSITE":
      return [
        { type: "text", text: `Here's what your website (**${String(payload.url ?? "your site")}**) tells a first-time visitor:` },
        { type: "findings", title: "Positioning & offers", items: [
          { label: "Positioning", detail: "Freshness-first specialty roaster; 'roasted this week' is the strongest claim", sentiment: "positive" },
          { label: "Hero offer", detail: "Cold brew 3-pack with free delivery over 500 EGP", sentiment: "positive" },
          { label: "Gap", detail: "No subscription CTA above the fold although 31% of traffic is returning", sentiment: "negative" },
          { label: "Trust", detail: "Only 2 reviews visible; no press or certifications", sentiment: "negative" },
        ] },
        { type: "action_card", title: "Use this", actions: [
          { type: "GENERATE_MARKETING_STRATEGY", label: "Draft marketing strategy", payload: {} },
          { type: "ANALYZE_KEYWORDS", label: "Find keywords", payload: { seed: "cold brew cairo" } },
        ] },
      ];
    case "ANALYZE_SOCIAL_PROFILE":
      return [
        { type: "metric", metrics: [
          { label: "Followers", value: 18400, format: "number" },
          { label: "Eng. rate", value: 3.4, format: "percent", delta: 0.12 },
          { label: "Posts / wk", value: 2.5, format: "number" },
        ] },
        { type: "findings", title: `@${String(payload.handle ?? "profile")} – content pillars`, items: [
          { label: "Reels", detail: "61% of reach from 20% of posts – under-invested", sentiment: "negative" },
          { label: "Product shots", detail: "Consistent look, low saves", sentiment: "neutral" },
          { label: "Customer UGC", detail: "Highest saves & shares", sentiment: "positive" },
        ] },
        { type: "action_card", title: "Next", actions: [{ type: "GENERATE_CONTENT_CALENDAR", label: "Plan next month", payload: {} }] },
      ];
    case "ANALYZE_REVIEWS":
      return [
        { type: "findings", title: "Review themes (184 reviews)", items: [
          { label: "Freshness", detail: "Mentioned in 42% of 5★ reviews – 'you can smell it through the bag'", sentiment: "positive" },
          { label: "Delivery time", detail: "Top complaint (17%) – 'took 4 days to New Cairo'", sentiment: "negative" },
          { label: "Price", detail: "Neutral; 'worth it' outweighs 'expensive' 3:1", sentiment: "neutral" },
        ] },
        { type: "text", text: "Suggested messaging: lead with freshness proof (roast date on pack) and pre-empt delivery concerns with an explicit ETA." },
      ];
    case "ANALYZE_MARKET":
      return [
        { type: "metric", metrics: [
          { label: "Specialty coffee EG", value: 1200000000, unit: "EGP", format: "currency" },
          { label: "YoY growth", value: 18, format: "percent", delta: 0.04 },
          { label: "Online share", value: 22, format: "percent" },
        ] },
        { type: "findings", title: "Segments", items: [
          { label: "Home brewers 25–40", detail: "Largest, price-sensitive, bean buyers", sentiment: "neutral" },
          { label: "Office / RTD", detail: "Fastest growing (+34%), low competition", sentiment: "positive" },
          { label: "Gifting", detail: "Seasonal spikes (Ramadan, Eid)", sentiment: "neutral" },
        ] },
        { type: "action_card", title: "Next", actions: [{ type: "DETECT_MARKET_GAPS", label: "Find gaps", payload: {} }] },
      ];
    case "ANALYZE_KEYWORDS":
      return [
        { type: "findings", title: `Keyword clusters for "${String(payload.seed ?? "cold brew")}"`, items: [
          { label: "cold brew cairo delivery", detail: "1.9k/mo · commercial · low difficulty", sentiment: "positive" },
          { label: "best specialty coffee egypt", detail: "4.4k/mo · informational · medium", sentiment: "neutral" },
          { label: "قهوة باردة توصيل", detail: "2.7k/mo · commercial · low – no strong competitor page", sentiment: "positive" },
          { label: "nespresso alternative egypt", detail: "900/mo · high intent", sentiment: "neutral" },
        ] },
      ];
    case "ANALYZE_COMPETITOR_CREATIVES":
      return [
        { type: "findings", title: "Competitor ads running > 30 days (likely winners)", items: [
          { label: "Brew & Co – '3 for 2' reel", detail: "Pour hook, price on screen at 1s, 9:16, 47 days", sentiment: "negative" },
          { label: "Frost – UGC testimonial", detail: "Face-to-camera, subtitles, 62 days", sentiment: "negative" },
          { label: "Cairo Beans – static carousel", detail: "Product grid, 9 days – likely fatigued", sentiment: "positive" },
        ] },
        { type: "action_card", title: "Respond", actions: [
          { type: "CREATE_CREATIVE", label: "Create a UGC-style reel", payload: { kind: "video", brief: "UGC-style 15s reel: customer opens the box, smells the beans, first sip reaction, price on screen by 2s" } },
        ] },
      ];
    case "DETECT_MARKET_GAPS":
      return [
        { type: "findings", title: "Ranked opportunities", items: [
          { label: "1. Office RTD subscription", detail: "Fast-growing segment, only one weak competitor, matches your cold brew SKU", sentiment: "positive" },
          { label: "2. Arabic-first content", detail: "All competitors advertise in English only; 2.7k/mo Arabic search demand", sentiment: "positive" },
          { label: "3. Same-day New Cairo delivery", detail: "Top review complaint across every brand", sentiment: "positive" },
        ] },
        { type: "action_card", title: "Act on it", actions: [
          { type: "CREATE_CAMPAIGN", label: "Campaign: office subscription", payload: { prefill: { name: "Office RTD subscription", objective: "leads" } } },
          { type: "GENERATE_MARKETING_STRATEGY", label: "Full marketing strategy", payload: {} },
        ] },
      ];
    case "GENERATE_MARKETING_STRATEGY":
      return [
        { type: "text", text: "**Big idea: 'Roasted this week.'** Own freshness as the reason to switch from supermarket and capsule coffee, and use cold brew as the summer wedge." },
        { type: "findings", title: "90-day plan", items: [
          { label: "Positioning", detail: "Freshest coffee in Cairo – roast date on every pack", sentiment: "positive" },
          { label: "Channels", detail: "Instagram Reels (40%), Meta retargeting (25%), email (15%), TikTok tests (10%), search (10%)", sentiment: "neutral" },
          { label: "Phase 1 (wk 1–4)", detail: "Cold brew summer launch, UGC + pour reels", sentiment: "neutral" },
          { label: "Phase 2 (wk 5–8)", detail: "Office subscription lead-gen; Arabic-first creative", sentiment: "neutral" },
          { label: "Phase 3 (wk 9–12)", detail: "Retention: roast-drop email, bundles, referral", sentiment: "neutral" },
          { label: "KPIs", detail: "Blended ROAS 3.0 · CPA ≤ 85 EGP · 1,000 subscribers", sentiment: "positive" },
        ] },
        { type: "action_card", title: "Next", actions: [
          { type: "GENERATE_CONTENT_CALENDAR", label: "Generate content calendar", payload: {} },
          { type: "CREATE_CAMPAIGN", label: "Create phase 1 campaign", payload: { prefill: { name: "Cold brew summer launch", objective: "sales" } } },
        ] },
      ];
    case "ANALYZE_CAMPAIGN":
    default:
      return [
        clone(fx.messages.conv_1[1].blocks[1]),
        clone(fx.messages.conv_1[1].blocks[2]),
        {
          type: "action_card",
          title: "Next",
          actions: [{ type: "OPTIMIZE_CAMPAIGN", label: "Run optimizer", payload: { campaignId } }],
        },
      ];
  }
}

const payload_str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

const AGENT_TASK_TYPES: ActionType[] = [
  "ANALYZE_CAMPAIGN",
  "ANALYZE_CREATIVE",
  "RESEARCH_COMPETITORS",
  "OPTIMIZE_CAMPAIGN",
  "ANALYZE_WEBSITE",
  "ANALYZE_SOCIAL_PROFILE",
  "ANALYZE_REVIEWS",
  "ANALYZE_MARKET",
  "ANALYZE_KEYWORDS",
  "ANALYZE_COMPETITOR_CREATIVES",
  "DETECT_MARKET_GAPS",
  "GENERATE_MARKETING_STRATEGY",
];

/* ------------------------------------------------------------------ */
/* Assistant response synthesis                                        */
/* ------------------------------------------------------------------ */

function synthesizeAssistantBlocks(input: SendMessageInput): AnyBlock[] {
  const t = input.text.toLowerCase();
  const ctxCampaign = input.context.find((c) => c.kind === "campaign");
  const campaign = ctxCampaign ? state.campaigns.find((c) => c.id === ctxCampaign.id) : state.campaigns[0];

  if (input.answer) {
    return [
      {
        type: "text",
        text: `Great choice. I'll build the counter-campaign around "${input.answer.optionIds.join(", ")}". Want me to draft it now?`,
      },
      {
        type: "action_card",
        title: "Draft counter-campaign",
        actions: [{ type: "CREATE_CAMPAIGN", label: "Create campaign", payload: { angle: input.answer.optionIds[0] } }],
      },
    ];
  }

  if (/website|site|landing/.test(t)) {
    const task = createTask("ANALYZE_WEBSITE", "Analyze website");
    return [{ type: "text", text: "Analyzing the website now – positioning, offers, trust signals and gaps." }, { type: "task_progress", taskId: task.id, task: clone(task) }];
  }
  if (/review/.test(t)) return [{ type: "text", text: "Here's what customers keep saying in reviews:" }, ...taskResultBlocks("ANALYZE_REVIEWS", {})];
  if (/keyword|seo|search/.test(t)) return [{ type: "text", text: "Top keyword clusters for your category:" }, ...taskResultBlocks("ANALYZE_KEYWORDS", { seed: input.text })];
  if (/gap|opportunit/.test(t)) return taskResultBlocks("DETECT_MARKET_GAPS", {});
  if (/calendar|schedule|content plan/.test(t)) {
    return [
      { type: "text", text: "I can generate a month of content mapped to your pillars and campaigns." },
      { type: "action_card", title: "Content calendar", actions: [{ type: "GENERATE_CONTENT_CALENDAR", label: "Generate this month", payload: {} }] },
    ];
  }
  if (/marketing strategy|overall strategy|positioning/.test(t)) return taskResultBlocks("GENERATE_MARKETING_STRATEGY", {});
  if (/compet|rival|market/.test(t)) {
    return [
      { type: "text", text: "Here's a quick scan of who else is bidding on your audience right now." },
      clone(fx.messages.conv_2[1].blocks[0]),
      {
        type: "action_card",
        title: "Go deeper",
        actions: [{ type: "RESEARCH_COMPETITORS", label: "Full competitor report", payload: {} }],
      },
    ];
  }

  if (/creative|image|video|ad copy|variation/.test(t)) {
    return [
      { type: "text", text: "I can generate fresh creatives that match your brand tone (warm, confident, playful)." },
      {
        type: "question_with_options",
        question: "What format do you want first?",
        options: [
          { id: "image", label: "Image", description: "Static, 1:1 or 4:5" },
          { id: "video", label: "Video", description: "9:16 reel, 15s" },
          { id: "copy", label: "Copy", description: "Headline + primary text" },
        ],
        multiSelect: false,
      },
    ];
  }

  if (/optimi[sz]e|improve|budget|cpa|roas|why/.test(t)) {
    const rec = state.recommendations.find((r) => r.campaignId === (campaign?.id ?? "cmp_2") && r.status === "pending");
    return [
      { type: "text", text: `I analyzed **${campaign?.name ?? "your campaigns"}** over the last 7 days.` },
      {
        type: "metric",
        metrics: [
          { label: "CPA", value: campaign?.metrics?.cpa ?? 0, unit: campaign?.currency, format: "currency", delta: 0.12 },
          { label: "CTR", value: campaign?.metrics?.ctr ?? 0, format: "percent", delta: -0.08 },
          { label: "ROAS", value: campaign?.metrics?.roas ?? 0, format: "multiplier", delta: 0.05 },
        ],
      },
      ...(rec ? [{ type: "recommendation" as const, recommendation: clone(rec) }] : []),
      {
        type: "action_card",
        title: "Actions",
        actions: [
          { type: "OPTIMIZE_CAMPAIGN", label: "Run optimizer", payload: { campaignId: campaign?.id ?? "cmp_2" } },
          { type: "ANALYZE_CAMPAIGN", label: "Full analysis", payload: { campaignId: campaign?.id ?? "cmp_2" } },
        ],
      },
    ];
  }

  if (/error|fail|break/.test(t)) {
    return [{ type: "error", message: "The analysis agent timed out while fetching Meta data.", retryable: true }];
  }

  if (/campaign|launch|create/.test(t)) {
    const task = createTask("CREATE_CAMPAIGN", "Drafting campaign plan");
    return [
      { type: "text", text: "On it. I'm drafting a campaign plan based on your brand profile and past learnings." },
      { type: "task_progress", taskId: task.id, task: clone(task) },
      {
        type: "action_card",
        title: "Or start manually",
        actions: [{ type: "CREATE_CAMPAIGN", label: "Open campaign builder", payload: {} }],
      },
    ];
  }

  return [
    {
      type: "text",
      text:
        "I can help with research, creative generation, campaign analysis and optimization. Try asking: *\"Why is my CPA high?\"*, *\"Who are my competitors?\"* or *\"Create a video ad for cold brew\"*.",
    },
    {
      type: "action_card",
      title: "Quick actions",
      actions: [
        { type: "RESEARCH_COMPETITORS", label: "Research competitors", payload: {} },
        { type: "CREATE_CREATIVE", label: "Create a creative", payload: { kind: "image" } },
        { type: "ANALYZE_CAMPAIGN", label: "Analyze a campaign", payload: { campaignId: "cmp_1" } },
      ],
    },
  ];
}

function upsertConversation(input: SendMessageInput): Conversation {
  if (input.conversationId) {
    const c = state.conversations.find((x) => x.id === input.conversationId);
    if (c) return c;
  }
  const conv: Conversation = {
    id: uid("conv"),
    title: input.text.slice(0, 48),
    lastMessagePreview: input.text.slice(0, 80),
    messageCount: 0,
    createdAt: now(),
    updatedAt: now(),
  };
  state.conversations.unshift(conv);
  state.messages[conv.id] = [];
  return conv;
}

/* ------------------------------------------------------------------ */
/* MockApi                                                             */
/* ------------------------------------------------------------------ */

export class MockApi implements MarketingApi {
  private llmSettings: LlmSettings = {
    businessId: state.connectors.businessId,
    fast: { provider: "mock", model: "mock-fast-1", baseUrl: null, keyConfigured: false, keySource: "missing", extraHeadersConfigured: false, extraHeadersSource: "missing" },
    strong: { provider: "mock", model: "mock-strong-1", baseUrl: null, keyConfigured: false, keySource: "missing", extraHeadersConfigured: false, extraHeadersSource: "missing" },
    hasWorkspaceOverride: false,
    encryptionKeyConfigured: true,
  };

  async getBusiness() {
    await simulate({ safe: true });
    return clone(fx.business);
  }
  async getBrandProfile() {
    await simulate({ safe: true });
    return clone(fx.brandProfile);
  }

  /* Campaigns */
  async listCampaigns(input?: { status?: Campaign["status"]; search?: string }) {
    await simulate();
    let list = state.campaigns;
    if (input?.status) list = list.filter((c) => c.status === input.status);
    if (input?.search) list = list.filter((c) => c.name.toLowerCase().includes(input.search!.toLowerCase()));
    return clone(list);
  }
  async getCampaign(id: string) {
    await simulate();
    return clone(findOr404(state.campaigns, id, "Campaign"));
  }
  async createCampaign(raw: CampaignDraft) {
    const draft = CampaignDraftSchema.parse(raw);
    await simulate();
    const audienceId = draft.audience.id ?? uid("aud");
    const campaign: Campaign = {
      id: uid("cmp"),
      businessId: fx.business.id,
      name: draft.name,
      objective: draft.objective,
      status: draft.launchNow ? "active" : "draft",
      dailyBudget: draft.dailyBudget,
      currency: draft.currency,
      startDate: draft.startDate,
      endDate: draft.endDate,
      audienceId,
      strategy: draft.strategy,
      creativeIds: draft.creativeIds,
      metaCampaignId: draft.launchNow ? `2385${Date.now()}` : null,
      metrics: null,
      healthScore: null,
      createdAt: now(),
      updatedAt: now(),
    };
    state.campaigns.unshift(campaign);
    return clone(campaign);
  }
  async updateCampaign(raw: { id: string; patch: Partial<Campaign> }) {
    const input = UpdateCampaignInputSchema.parse(raw);
    await simulate();
    const c = findOr404(state.campaigns, input.id, "Campaign");
    Object.assign(c, input.patch, { updatedAt: now() });
    return clone(c);
  }
  async generateStrategy(raw: unknown) {
    const input = GenerateStrategyInputSchema.parse(raw);
    await sleep(1200);
    await simulate();
    return {
      ...clone(fx.strategy),
      summary: `For a ${input.objective} objective at ${input.dailyBudget}/day: ${fx.strategy.summary}`,
    };
  }
  async getCampaignPerformance(id: string) {
    await simulate();
    findOr404(state.campaigns, id, "Campaign");
    return fx.performance(id.length);
  }
  async getCampaignRecommendations(id: string) {
    await simulate();
    return clone(state.recommendations.filter((r) => r.campaignId === id));
  }
  async getCampaignLearnings(id: string) {
    await simulate();
    return clone(state.learnings.filter((l) => l.campaignId === id));
  }

  async getAudience(id: string) {
    await simulate();
    return clone(findOr404(fx.audiences, id, "Audience"));
  }

  /* Creatives */
  async listCreatives(campaignId?: string) {
    await simulate();
    return clone(campaignId ? state.creatives.filter((c) => c.campaignId === campaignId) : state.creatives);
  }
  async getCreative(id: string) {
    await simulate();
    return clone(findOr404(state.creatives, id, "Creative"));
  }
  async generateCreative(raw: unknown) {
    const input = GenerateCreativeInputSchema.parse(raw);
    await sleep(1000);
    await simulate();
    const out: Creative[] = Array.from({ length: input.count }, (_, i) => {
      const id = uid("cr");
      const base: Creative = {
        id,
        campaignId: input.campaignId,
        kind: input.kind,
        title: `${input.brief.slice(0, 32)}${input.count > 1 ? ` – v${i + 1}` : ""}`,
        status: "ready",
        headline: input.brief.split(" ").slice(0, 5).join(" "),
        primaryText: `${input.brief}. Roasted on the Nile, brewed for you.`,
        cta: "Shop now",
        tags: input.referenceAnalysisId ? ["inspired"] : ["generated"],
        score: 55 + Math.round(Math.random() * 35),
        aspectRatio: input.aspectRatio ?? (input.kind === "video" ? "9:16" : "1:1"),
        createdAt: now(),
        updatedAt: now(),
      };
      if (input.kind !== "copy") {
        base.assetUrl = input.kind === "video" ? `https://example.com/videos/${id}.mp4` : img(id);
        base.thumbnailUrl = img(id, 600, input.kind === "video" ? 1067 : 600);
        if (input.kind === "video") base.durationSec = 15;
      }
      return base;
    });
    state.creatives.unshift(...out);
    return clone(out);
  }
  async generateVariations(raw: unknown) {
    const input = GenerateVariationsInputSchema.parse(raw);
    const src = findOr404(state.creatives, input.creativeId, "Creative");
    await sleep(800);
    await simulate();
    const out: Creative[] = Array.from({ length: input.count }, (_, i) => {
      const id = uid("cr");
      return {
        ...clone(src),
        id,
        title: `${src.title} – var ${i + 1}`,
        status: "ready",
        thumbnailUrl: src.kind === "copy" ? undefined : img(id, 600, 600),
        assetUrl: src.kind === "copy" ? undefined : img(id),
        tags: [...src.tags, "variation"],
        score: 50 + Math.round(Math.random() * 40),
        createdAt: now(),
        updatedAt: now(),
      };
    });
    state.creatives.unshift(...out);
    return clone(out);
  }
  async analyzeReference(raw: unknown) {
    const input = AnalyzeReferenceInputSchema.parse(raw);
    await sleep(1200);
    await simulate();
    const analysis: ReferenceAnalysis = {
      id: uid("ref"),
      sourceName: input.fileName ?? "reference",
      kind: input.kind,
      hook: "Opens on a close-up pour with on-screen text 'still cold at 3pm'.",
      structure: ["Hook (0–2s)", "Problem: warm coffee", "Product reveal", "Social proof", "Offer + CTA"],
      visualStyle: ["Natural light", "Warm palette", "Handheld", "Large kinetic type"],
      tone: ["casual", "confident"],
      cta: "Order today",
      strengths: ["Strong 2s hook", "Clear single offer", "Subtitles for sound-off"],
      weaknesses: ["No brand mention until 9s", "CTA appears once"],
      estimatedPerformance: "high",
      inspiredBrief:
        "15s vertical video: open on a slow cold-brew pour over ice with kinetic text 'Still cold at 3pm'. Cut to a Cairo office desk, show the bottle with logo by 3s. End card: bundle offer + 'Order today'.",
      createdAt: now(),
    };
    state.analyses[analysis.id] = analysis;
    return clone(analysis);
  }
  async addToCampaign(raw: unknown) {
    const input = AddToCampaignInputSchema.parse(raw);
    await simulate();
    const c = findOr404(state.campaigns, input.campaignId, "Campaign");
    const cr = findOr404(state.creatives, input.creativeId, "Creative");
    if (!c.creativeIds.includes(cr.id)) c.creativeIds.push(cr.id);
    cr.campaignId = c.id;
    c.updatedAt = now();
    return clone(c);
  }

  /* Insights */
  async getInsights(input?: { campaignId?: string; severity?: Insight["severity"] }) {
    await simulate();
    let list = state.insights;
    if (input?.campaignId) list = list.filter((i) => i.campaignId === input.campaignId);
    if (input?.severity) list = list.filter((i) => i.severity === input.severity);
    return clone(list);
  }
  async getRecommendation(id: string) {
    await simulate();
    return clone(findOr404(state.recommendations, id, "Recommendation"));
  }
  async applyRecommendation(raw: unknown) {
    const input = ApplyRecommendationInputSchema.parse(raw);
    await simulate();
    const rec = findOr404(state.recommendations, input.recommendationId, "Recommendation");
    rec.status = "applied";
    // Reflect the change in the campaign where we can.
    const c = state.campaigns.find((x) => x.id === rec.campaignId);
    for (const ch of rec.changes) {
      if (c && ch.field === "dailyBudget" && typeof ch.after === "number") c.dailyBudget = ch.after;
    }
    state.insights = state.insights.filter(
      (i) => !(i.action?.type === "APPLY_RECOMMENDATION" && i.action.payload.recommendationId === rec.id),
    );
    return clone(rec);
  }
  async dismissRecommendation(raw: unknown) {
    const input = ApplyRecommendationInputSchema.parse(raw);
    await simulate();
    const rec = findOr404(state.recommendations, input.recommendationId, "Recommendation");
    rec.status = "dismissed";
    return clone(rec);
  }

  /* Assistant */
  async listConversations() {
    await simulate();
    return clone(state.conversations);
  }
  async getConversation(id: string) {
    await simulate();
    const conversation = findOr404(state.conversations, id, "Conversation");
    return { conversation: clone(conversation), messages: clone(state.messages[id] ?? []) };
  }
  async sendMessage(raw: unknown) {
    const input = SendMessageInputSchema.parse(raw);
    await simulate();
    let last: SendMessageOutput | null = null;
    for await (const chunk of this.streamMessage(input)) last = chunk;
    if (!last) throw new ApiError("EMPTY_STREAM", "No response produced");
    return last;
  }
  async *streamMessage(raw: unknown): AsyncIterable<SendMessageOutput> {
    const input = SendMessageInputSchema.parse(raw);
    await sleep(250);
    if (Math.random() < ERROR_RATE) {
      throw new ApiError("MOCK_RANDOM_FAILURE", "The assistant is temporarily unavailable.", 503);
    }
    const conversation = upsertConversation(input);
    const userMessage: Message = {
      id: uid("msg"),
      conversationId: conversation.id,
      role: "user",
      blocks: [{ type: "text", text: input.text }],
      context: input.context,
      createdAt: now(),
    };
    state.messages[conversation.id].push(userMessage);

    // Mark the answered question, if any.
    if (input.answer) {
      const q = state.messages[conversation.id].find((m) => m.id === input.answer!.messageId);
      q?.blocks.forEach((b) => {
        if (b.type === "question_with_options") (b as { answeredOptionIds?: string[] }).answeredOptionIds = input.answer!.optionIds;
      });
    }

    const finalBlocks = synthesizeAssistantBlocks(input);
    const assistantMessage: Message = {
      id: uid("msg"),
      conversationId: conversation.id,
      role: "assistant",
      blocks: [],
      context: [],
      createdAt: now(),
    };
    state.messages[conversation.id].push(assistantMessage);
    conversation.messageCount = state.messages[conversation.id].length;
    conversation.updatedAt = now();

    const emit = (): SendMessageOutput => ({
      conversation: clone(conversation),
      userMessage: clone(userMessage),
      assistantMessage: clone(assistantMessage),
    });

    // Stream: text blocks are chunked word by word; other blocks arrive whole.
    for (const block of finalBlocks) {
      if (block.type === "text") {
        const words = (block as { text: string }).text.split(" ");
        const partial = { type: "text" as const, text: "", streaming: true };
        assistantMessage.blocks.push(partial);
        for (let i = 0; i < words.length; i++) {
          partial.text = words.slice(0, i + 1).join(" ");
          await sleep(25 + Math.random() * 40);
          yield emit();
        }
        partial.streaming = false;
        yield emit();
      } else {
        await sleep(300);
        assistantMessage.blocks.push(block);
        yield emit();
      }
    }
    const lastText = finalBlocks.find((b) => b.type === "text") as { text: string } | undefined;
    conversation.lastMessagePreview = (lastText?.text ?? "…").replace(/[*`_]/g, "").slice(0, 80);
    yield emit();
  }

  /* Tasks */
  async startTask(raw: unknown) {
    const input = StartTaskInputSchema.parse(raw);
    await simulate();
    const label = input.type.replace(/_/g, " ").toLowerCase();
    if (!AGENT_TASK_TYPES.includes(input.type)) return clone(createTask(input.type, label));

    // Agent tasks live inside a conversation so the user can watch progress and get results in chat.
    const campaignId = typeof input.payload.campaignId === "string" ? input.payload.campaignId : undefined;
    const campaign = campaignId ? state.campaigns.find((c) => c.id === campaignId) : undefined;
    const subject = campaign?.name ?? [payload_str(input.payload.url), payload_str(input.payload.handle), payload_str(input.payload.seed), payload_str(input.payload.competitor), payload_str(input.payload.query)].find(Boolean);
    const title = `${label.charAt(0).toUpperCase()}${label.slice(1)}${subject ? `: ${subject}` : ""}`;
    const conv = upsertConversation({ conversationId: null, text: title, context: [] });
    conv.title = title;
    const userMessage: Message = {
      id: uid("msg"),
      conversationId: conv.id,
      role: "user",
      blocks: [{ type: "text", text: title }],
      context: campaign ? [{ kind: "campaign", id: campaign.id, label: campaign.name }] : [],
      createdAt: now(),
    };
    const assistantMessage: Message = {
      id: uid("msg"),
      conversationId: conv.id,
      role: "assistant",
      blocks: [{ type: "text", text: "Working on it – I'll post results here as soon as the agent finishes." }],
      context: [],
      createdAt: now(),
    };
    const task = createTask(input.type, title, { entity: "conversation", id: conv.id }, (done) => {
      assistantMessage.blocks.push(...taskResultBlocks(done.type, input.payload));
      conv.lastMessagePreview = "Results ready";
      conv.updatedAt = now();
    });
    assistantMessage.blocks.push({ type: "task_progress", taskId: task.id, task: clone(task) });
    state.messages[conv.id].push(userMessage, assistantMessage);
    conv.messageCount = 2;
    return clone(task);
  }
  async getTask(id: string) {
    await sleep(150);
    const task = state.tasks[id];
    if (!task) throw new ApiError("NOT_FOUND", `Task ${id} not found`, 404);
    return clone(task);
  }

  /* Meta */
  async getMetaConnection() {
    await simulate({ safe: true });
    return clone(state.meta);
  }
  async connectMeta() {
    state.meta = { ...state.meta, status: "connecting", errorMessage: null };
    await sleep(1800);
    const r = Math.random();
    if (r < 0.15) {
      state.meta = { ...state.meta, status: "error", errorMessage: "OAuth window was closed before permissions were granted." };
    } else if (r < 0.25) {
      state.meta = {
        ...state.meta,
        status: "needs_reauth",
        accountId: "act_9182736450",
        accountName: "Nile Roasters Ads",
        pageName: "Nile Roasters",
        permissions: ["ads_read"],
        connectedAt: now(),
        expiresAt: now(),
        errorMessage: "Missing ads_management permission.",
      };
    } else {
      state.meta = {
        status: "connected",
        accountId: "act_9182736450",
        accountName: "Nile Roasters Ads",
        pageName: "Nile Roasters",
        permissions: ["ads_read", "ads_management", "pages_read_engagement"],
        connectedAt: now(),
        expiresAt: new Date(Date.now() + 60 * 86_400_000).toISOString(),
        errorMessage: null,
      };
    }
    return clone(state.meta);
  }
  async reauthMeta() {
    return this.connectMeta();
  }
  async disconnectMeta() {
    await simulate({ safe: true });
    state.meta = clone(fx.metaConnection);
    return clone(state.meta);
  }

  /* Content calendar */
  async listContentItems(raw: unknown) {
    const input = ListContentInputSchema.parse(raw);
    await simulate();
    const list = state.content[input.month] ?? [];
    return clone(input.campaignId ? list.filter((i) => i.campaignId === input.campaignId) : list);
  }
  async generateContentCalendar(raw: unknown) {
    const input = GenerateContentCalendarInputSchema.parse(raw);
    await sleep(1400);
    await simulate();
    const items = fxx.buildMonth(input.month, { postsPerWeek: input.postsPerWeek, channels: input.channels, campaignId: input.campaignId });
    state.content[input.month] = items;
    return clone(items);
  }
  async updateContentItem(raw: unknown) {
    const input = UpdateContentItemInputSchema.parse(raw);
    await simulate();
    for (const month of Object.keys(state.content)) {
      const item = state.content[month].find((i) => i.id === input.id);
      if (item) {
        Object.assign(item, input.patch, { updatedAt: now() });
        // Move between months if the date changed.
        const newMonth = item.date.slice(0, 7);
        if (newMonth !== month) {
          state.content[month] = state.content[month].filter((i) => i.id !== item.id);
          (state.content[newMonth] ??= []).push(item);
        }
        return clone(item);
      }
    }
    throw new ApiError("NOT_FOUND", `Content item ${input.id} not found`, 404);
  }
  async deleteContentItem(id: string) {
    await simulate();
    for (const month of Object.keys(state.content)) state.content[month] = state.content[month].filter((i) => i.id !== id);
    return { id };
  }

  /* Text generation */
  async generateText(raw: unknown) {
    const input = GenerateTextInputSchema.parse(raw);
    await sleep(1100);
    await simulate();
    const b = input.brief.trim();
    const byTool: Record<typeof input.tool, { title: string; sections: { heading: string; body: string }[] }> = {
      generate_creative_brief: {
        title: `Creative brief – ${b.slice(0, 40)}`,
        sections: [
          { heading: "Objective", body: `Drive first purchase of cold brew among Cairo coffee enthusiasts. Brief: ${b}.` },
          { heading: "Single-minded proposition", body: "Cold brew that's still cold – and still fresh – at 3pm." },
          { heading: "Audience insight", body: "They buy coffee for the ritual, but in summer the ritual melts. Convenience without compromise wins." },
          { heading: "Tone", body: "Warm, confident, playful. Never 'cheap' or 'discount'." },
          { heading: "Mandatories", body: "Logo by 3s · roast date visible · CTA 'Order today' · 9:16 and 1:1 cuts." },
          { heading: "Deliverables", body: "1 × 15s reel, 3 × static 1:1, 3 × headline/primary-text pairs." },
        ],
      },
      generate_commercial_script: {
        title: `15s script – ${b.slice(0, 40)}`,
        sections: [
          { heading: "0–2s · Hook", body: "Extreme close-up: cold brew poured over ice, condensation. On-screen text: 'Still cold at 3pm.'" },
          { heading: "2–6s · Problem", body: "Cut: office desk, a sad lukewarm mug. VO: 'Cairo summer. Your coffee gave up hours ago.'" },
          { heading: "6–11s · Product", body: "Bottle reveal with roast date label. VO: 'Ours didn't. Slow-steeped 18 hours, roasted this week.' Logo by 3s of this beat." },
          { heading: "11–15s · CTA", body: "Bundle of three on ice. Text: 'Free delivery over 500 EGP.' VO: 'Nile Roasters. Order today.'" },
          { heading: "Notes", body: `Handheld, natural light, warm palette. Subtitles burned in. Brief context: ${b}.` },
        ],
      },
      generate_image_prompt: {
        title: `Image prompt – ${b.slice(0, 40)}`,
        sections: [
          { heading: "Prompt", body: `${b}. Editorial product photography, glass bottle of cold brew with visible roast-date label, condensation droplets, ice, warm golden-hour side light, Cairo rooftop softly blurred in background, shallow depth of field, 85mm, warm earthy palette (#5B4636, #E9C46A), clean negative space top-left for headline.` },
          { heading: "Negative prompt", body: "text, watermark, extra hands, plastic cup, cluttered background, oversaturated, cartoon." },
          { heading: "Variants", body: "1:1 hero · 4:5 feed · 9:16 story with product lower third." },
        ],
      },
      generate_video_prompt: {
        title: `Video prompt – ${b.slice(0, 40)}`,
        sections: [
          { heading: "Prompt", body: `${b}. 15-second vertical 9:16 video. Shot 1 (0–2s): macro slow-motion pour of cold brew over ice, condensation, warm light. Shot 2 (2–6s): handheld push-in on a bottle with roast-date label on a Cairo office desk. Shot 3 (6–11s): first-sip reaction, natural smile, subtle steam-free coolness cue. Shot 4 (11–15s): three bottles on ice, end card space bottom third. Natural lighting, filmic grain, warm palette, 24fps.` },
          { heading: "Motion & camera", body: "Slow dolly-in, no whip pans, cut on the beat every ~3s." },
          { heading: "Audio", body: "Ice clink foley, soft lo-fi, VO track separate." },
        ],
      },
      generate_ad_copy: {
        title: `Ad copy – ${b.slice(0, 40)}`,
        sections: [
          { heading: "Headline A", body: "Still cold at 3pm." },
          { heading: "Headline B", body: "Roasted this week. Not this year." },
          { heading: "Primary text", body: `${b}. Slow-steeped 18 hours from beans roasted days – not months – ago. Free delivery over 500 EGP.` },
          { heading: "CTA", body: "Order today" },
        ],
      },
    };
    const def = byTool[input.tool];
    const out: GeneratedText = {
      id: uid("gen"),
      tool: input.tool,
      title: def.title,
      sections: def.sections,
      plainText: def.sections.map((s) => `${s.heading}\n${s.body}`).join("\n\n"),
      createdAt: now(),
    };
    return out;
  }

  /* Agents */
  async listAgents() {
    await simulate({ safe: true });
    return clone(state.agents);
  }
  async updateAgent(raw: unknown) {
    const input = UpdateAgentInputSchema.parse(raw);
    await simulate();
    const a = findOr404(state.agents, input.id, "Agent");
    Object.assign(a, input.patch, { persona: { ...a.persona, ...(input.patch.persona ?? {}) }, updatedAt: now() });
    return clone(a);
  }

  /* Settings */
  async getSettings() {
    await simulate({ safe: true });
    return clone(state.settings);
  }
  async updateSettings(patch: Partial<Settings>) {
    await simulate();
    state.settings = { ...state.settings, ...patch, notifications: { ...state.settings.notifications, ...patch.notifications } };
    return clone(state.settings);
  }

  /* ------------------------------------------------------------------- auth */

  /**
   * Mirrors the real contract closely enough that the UI cannot tell the
   * difference: a wrong password produces the *same* message as an unknown
   * email, so the login screen is written against the generic path.
   */
  private mockSession(overrides?: Partial<AuthSession>): AuthSession {
    const base = clone(fxa.mockAuthSession);
    const session: AuthSession = { ...base, ...overrides };
    useAuthStore.getState().applySession(session);
    return clone(session);
  }

  async register(input: RegisterInput): Promise<AuthSession> {
    await simulate({ safe: true });
    const email = input.email.trim().toLowerCase();
    if (email === fxa.mockAuthSession.user.email) {
      throw new ApiError("email_taken", "an account already exists for this email address", 409, {
        field: "email",
      });
    }
    return this.mockSession({
      accessToken: uid("mock_token"),
      user: {
        id: uid("usr"),
        email,
        fullName: input.fullName?.trim() || null,
        isActive: true,
        lastLoginAt: now(),
        createdAt: now(),
      },
      workspaces: [
        {
          workspaceId: uid("ws"),
          businessId: uid("biz"),
          businessName: input.workspaceName?.trim() || "My Business",
          role: "owner",
          isPrimary: true,
        },
      ],
      activeWorkspaceId: null,
    });
  }

  async login(input: LoginInput): Promise<AuthSession> {
    await simulate({ safe: true });
    // One message for both failure modes, exactly like the backend.
    if (input.email.trim().toLowerCase() !== fxa.mockAuthSession.user.email || input.password.length < 8) {
      throw new ApiError("unauthorized", "email or password is incorrect", 401, { reason: "invalid_credentials" });
    }
    return this.mockSession({ accessToken: uid("mock_token") });
  }

  async refreshSession(): Promise<AuthSession> {
    await simulate({ safe: true });
    return this.mockSession({ accessToken: uid("mock_token") });
  }

  async logout(): Promise<LogoutResult> {
    await simulate({ safe: true });
    useAuthStore.getState().clear();
    return { revoked: true };
  }

  async getSession(): Promise<SessionInfo> {
    await simulate({ safe: true });
    const info = clone(fxa.mockSessionInfo);
    useAuthStore.getState().applySessionInfo(info);
    return info;
  }

  /* -------------------------------------------------------- business profile */

  async getBusinessProfileForm(): Promise<BusinessProfileForm> {
    await simulate({ safe: true });
    return clone(state.businessProfile);
  }

  /** Exclude-unset, like the backend: an absent key leaves the stored value alone. */
  async updateBusinessProfile(input: BusinessProfileUpdateInput): Promise<BusinessProfileForm> {
    await simulate();
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (value === undefined) continue;
      (state.businessProfile as unknown as Record<string, unknown>)[key] = value;
    }
    state.businessProfile.updatedAt = now();
    return clone(state.businessProfile);
  }

  /* ------------------------------------------------------------------ memory */

  async listMemoryItems(input?: ListMemoryItemsInput): Promise<MemoryItemList> {
    await simulate({ safe: true });
    const q = input?.q?.trim().toLowerCase();
    let items = [...state.memory];
    if (input?.kind) items = items.filter((i) => i.kind === input.kind);

    if (q) {
      // Deterministic stand-in for embedding similarity: token overlap, so the
      // UI still has to render a `score` and cannot assume substring matching.
      items = items
        .map((item) => {
          const words = new Set(item.text.toLowerCase().split(/\W+/).filter(Boolean));
          const hits = q.split(/\W+/).filter(Boolean).filter((w) => words.has(w)).length;
          return { item, score: hits === 0 ? 0.05 : Math.min(0.99, 0.2 + hits * 0.22) };
        })
        .sort((a, b) => b.score - a.score)
        .map(({ item, score }) => ({ ...item, score }));
      items = items.filter((i) => (i.score ?? 0) > 0);
    } else {
      items.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
      items = items.map((i) => ({ ...i, score: null }));
    }

    const limit = input?.limit ?? 50;
    return {
      items: clone(items.slice(0, limit)),
      total: items.length,
      limit,
      kind: input?.kind ?? null,
      query: q || null,
      mode: q ? "similar" : "recent",
    };
  }

  async createMemoryItem(input: CreateMemoryItemInput): Promise<MemoryItem> {
    await simulate();
    const item: MemoryItem = {
      id: uid("mem"),
      businessId: state.businessProfile.businessId,
      kind: input.kind,
      text: input.text,
      metadata: input.metadata ?? {},
      campaignId: input.campaignId ?? null,
      createdAt: now(),
      score: null,
    };
    state.memory.unshift(item);
    return clone(item);
  }

  async updateMemoryItem(input: UpdateMemoryItemInput): Promise<MemoryItem> {
    await simulate();
    const item = findOr404(state.memory, input.id, "Memory item");
    if (input.text !== undefined) item.text = input.text;
    if (input.metadata !== undefined) item.metadata = input.metadata ?? {};
    return clone(item);
  }

  async deleteMemoryItem(id: string): Promise<{ id: string }> {
    await simulate();
    state.memory = state.memory.filter((m) => m.id !== id);
    return { id };
  }

  async reindexMemory(kind?: string): Promise<MemoryReindexResult> {
    await simulate();
    const targets = kind ? state.memory.filter((m) => m.kind === kind) : state.memory;
    return { reindexed: targets.length, kind: kind ?? null, itemIds: targets.map((m) => m.id) };
  }

  /* -------------------------------------------------------------- connectors */

  async getConnectorSettings(): Promise<ConnectorSettings> {
    await simulate({ safe: true });
    return clone(state.connectors);
  }

  private connectorOr404(name: string): Connector {
    const found = state.connectors.connectors.find((c) => c.connector === name);
    if (!found) {
      throw new ApiError("not_found", `connector '${name}' does not exist`, 404, {
        known: state.connectors.connectors.map((c) => c.connector),
      });
    }
    return found;
  }

  async updateConnector(name: string, patch: ConnectorUpdateInput): Promise<Connector> {
    await simulate();
    const connector = this.connectorOr404(name);
    const known = new Set(connector.fields.map((f) => f.key));
    for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
      if (value === undefined) continue;
      if (!known.has(key)) {
        throw new ApiError("validation_failed", `field '${key}' does not belong to connector '${name}'`, 422, {
          accepted: Array.from(known),
        });
      }
      const target = connector.fields.find((f) => f.key === key)!;
      const cleared = value === null || value === "";
      target.value = cleared || target.secret ? null : String(value);
      target.hasValue = !cleared;
      target.masked = !cleared && target.secret ? "••••••••" : null;
      target.source = cleared ? "unset" : "workspace";
    }
    connector.hasOverride = connector.fields.some((f) => f.source === "workspace");
    connector.source = connector.hasOverride ? "workspace" : connector.source;
    connector.configured = connector.fields.filter((f) => f.required).every((f) => f.hasValue || f.value !== null);
    state.connectors.overrideCount = state.connectors.connectors.filter((c) => c.hasOverride).length;
    return clone(connector);
  }

  async deleteConnector(name: string): Promise<ConnectorDeleteResult> {
    await simulate();
    const connector = this.connectorOr404(name);
    for (const f of connector.fields) {
      f.value = null;
      f.hasValue = false;
      f.masked = null;
      f.source = "env";
    }
    connector.hasOverride = false;
    connector.source = "env";
    connector.configured = false;
    state.connectors.overrideCount = state.connectors.connectors.filter((c) => c.hasOverride).length;
    return { connector: name, removed: true, source: "env", configured: false };
  }

  async getLlmSettings(): Promise<LlmSettings> {
    await simulate({ safe: true });
    return clone(this.llmSettings);
  }

  async updateLlmSettings(input: LlmSettingsUpdateInput): Promise<LlmSettings> {
    await simulate();
    for (const tier of ["fast", "strong"] as const) {
      const patch = input[tier];
      if (!patch) continue;
      const current = this.llmSettings[tier];
      this.llmSettings[tier] = {
        ...current,
        provider: patch.provider ?? current.provider,
        model: patch.model ?? current.model,
        baseUrl: patch.baseUrl ?? current.baseUrl,
        keyConfigured: patch.apiKey === null ? false : patch.apiKey ? true : current.keyConfigured,
        keySource: patch.apiKey === null ? "missing" : patch.apiKey ? "workspace" : current.keySource,
        extraHeadersConfigured: patch.extraHeaders === null ? false : patch.extraHeaders ? Object.keys(patch.extraHeaders).length > 0 : current.extraHeadersConfigured,
        extraHeadersSource: patch.extraHeaders === null ? "missing" : patch.extraHeaders ? Object.keys(patch.extraHeaders).length > 0 ? "workspace" : "missing" : current.extraHeadersSource,
      };
    }
    this.llmSettings.hasWorkspaceOverride = true;
    return clone(this.llmSettings);
  }

  /* ----------------------------------------------------------- usage & audit */

  async getUsage(period: UsagePeriod = "today"): Promise<Usage> {
    await simulate({ safe: true });
    return clone(fxa.mockUsage[period] ?? fxa.mockUsage.today);
  }

  async getAudit(filters?: AuditFilters): Promise<AuditList> {
    await simulate({ safe: true });
    const entries = state.audit.entries.filter((e) => {
      if (filters?.entityType && e.entityType !== filters.entityType) return false;
      if (filters?.entityId && e.entityId !== filters.entityId) return false;
      if (filters?.actor && e.actor !== filters.actor) return false;
      if (filters?.action && e.action !== filters.action) return false;
      return true;
    });
    const limit = filters?.limit ?? 50;
    return {
      entries: clone(entries.slice(0, limit)),
      limit,
      total: state.audit.total,
      entityType: filters?.entityType ?? null,
      entityId: filters?.entityId ?? null,
      actor: filters?.actor ?? null,
    };
  }
}
