import type { MarketingApi } from "./types";
import { ApiError } from "./types";
import { getMockMetaTargetingResults } from "./mock-targeting";
import * as fx from "@/lib/mock/fixtures";
import * as fxx from "@/lib/mock/fixtures-extra";
import * as fxa from "@/lib/mock/fixtures-admin";
import { useAuthStore } from "@/store/auth-store";
import type {
  AgentTask,
  Audience,
  SavedAudience,
  SavedAudienceInput,
  AudienceSuggestionInput,
  AudienceSuggestionResponse,
  AuditFilters,
  AuditList,
  AuthSession,
  BrandIdentityResponse,
  BrandIdentityUpdateRequest,
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
  CreativeReference,
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
  MetaAccountCampaign,
  MetaAccountCampaignPage,
  ListMetaAccountCampaignsInput,
  TargetingCategory,
  MetaAdPlanSettings,
  MetaAdPlanAssistInput,
  MetaAdPlanAssistResponse,
  MetaAdPlanCreated,
  MetaAdPlanActivationResponse,
  MetaAdPlanApprovalResponse,
  MetaAdInsightsResponse,
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
  GeneratedCampaignStrategy,
  GeneratedText,
  GenerateTextInput,
  ObservabilityStatus,
  PlanId,
  SubscriptionPlan,
  SwitchPlanResponse,
  UpdateMemoryItemInput,
  Usage,
  UsagePeriod,
  WorkspaceSubscription,
} from "@/types";
import {
  AddToCampaignInputSchema,
  AnalyzeReferenceInputSchema,
  ApplyRecommendationInputSchema,
  SavedAudienceInputSchema,
  AudienceSuggestionInputSchema,
  CampaignDraftSchema,
  GenerateCreativeInputSchema,
  GenerateStrategyInputSchema,
  GeneratedCampaignStrategySchema,
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
  audiences: SavedAudience[];
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
  references: CreativeReference[];
  meta: MetaConnection;
  settings: Settings;
  content: Record<string, ContentItem[]>;
  agents: Agent[];
};

const state: State = {
  campaigns: clone(fx.campaigns),
  audiences: clone(fx.audiences.map((audience) => ({
    id: audience.id,
    businessId: fx.business.id,
    name: audience.name,
    description: null,
    targeting: {
      ageMin: audience.ageMin,
      ageMax: audience.ageMax,
      genders: audience.genders,
      locations: audience.locations,
      countries: ["EG"],
      interests: audience.interests,
      interestTargets: [],
      targetingTargets: [],
      behaviors: audience.behaviors,
    },
    source: "manual" as const,
    isArchived: false,
    createdAt: now(),
    updatedAt: now(),
  }))),
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
  references: [],
  meta: clone(fx.metaConnection),
  settings: clone(fx.settings),
  content: {},
  agents: clone(fxx.agents),
};

const mockMetaPlans = new Map<string, { campaignId: string; title: string; plan: MetaAdPlanSettings; approved: boolean }>();

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
  UPDATE_BRAND_PROFILE: ["Load profile", "Apply changes", "Sync memory"],
  VIEW_USAGE: ["Fetch usage ledger", "Calculate burn rate", "Project tokens"],
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

function synthesizeAssistantBlocks(input: SendMessageInput, firstTurn = false, conversationId?: string): AnyBlock[] {
  const t = input.text.toLowerCase();
  const ctxCampaign = input.context.find((c) => c.kind === "campaign");
  const campaign = ctxCampaign ? state.campaigns.find((c) => c.id === ctxCampaign.id) : state.campaigns[0];

  if (input.workflow === "creative_prompt") {
    const arabic = /[\u0600-\u06ff]/.test(input.text);
    const kind = input.promptType === "video" ? "video" : "image";
    const reference = input.referenceAnalysisId || input.context.find((chip) => chip.kind === "reference")?.id;
    const history = conversationId ? state.messages[conversationId] ?? [] : [];
    const previousAssistant = [...history].reverse().find((message) => message.role === "assistant");
    const approvalBlock = previousAssistant?.blocks.find((block) => {
      if (block.type !== "question_with_options") return false;
      const options = (block as { options?: Array<{ id: string }> }).options;
      return Boolean(options?.some((option) => option.id === "approve_prompt_plan"));
    });
    const hasPendingPlan = Boolean(approvalBlock);
    const answerTargetsLatestPlan = input.answer?.messageId === previousAssistant?.id;
    const isApprovalText = /^(approve(?: and write(?: the)? prompt)?|approved|yes|ok|okay|go ahead|looks good|موافق(?:ة)?|اعتمد(?:ها)?|نعم|اه|آه|أه|ايوه|أيوه|أيوة|ايوا|ماشي|تمام(?: كده)?)[.!؟?\s]*$/i.test(input.text.trim());
    const noMoreDetailsPattern = /^(?:بعت\s*لك\s*كل\s*(?:ده|حاجة|التفاصيل|المعلومات)|بعتلك\s*كل\s*(?:ده|حاجة|التفاصيل|المعلومات)|ده\s*كل\s*اللي\s*عندي|دي\s*كل\s*التفاصيل|مفيش\s*تفاصيل\s*تانية|مافيش\s*تفاصيل\s*تانية|that's\s*all(?:\s*i\s*have)?|i\s*(?:already\s*)?sent\s*everything|no\s*more\s*details)[.!؟?\s]*$/i;
    const noMoreDetails = noMoreDetailsPattern.test(input.text.trim());
    const approvalSelected = hasPendingPlan && (
      (answerTargetsLatestPlan && input.answer?.optionIds.includes("approve_prompt_plan")) ||
      (!input.answer && isApprovalText)
    );
    const editSelected = hasPendingPlan && answerTargetsLatestPlan && input.answer?.optionIds.includes("edit_prompt_plan");
    const userMessages = history.filter((message) => message.role === "user");
    const briefMessages = (approvalSelected ? userMessages.slice(0, -1) : userMessages).filter((message) => {
      const text = message.blocks
        .filter((block) => block.type === "text")
        .map((block) => (block as { text: string }).text)
        .join(" ");
      return !noMoreDetailsPattern.test(text.trim());
    });
    const userDetails = briefMessages
      .flatMap((message) => message.blocks.filter((block) => block.type === "text").map((block) => (block as { text: string }).text))
      .join("\n");
    const demoNote = arabic
      ? "وضع العرض مفعّل: لم يُرسل طلب إلى نموذج ذكاء اصطناعي، ولا يستطيع هذا المسار تحليل بكسلات المرجع."
      : "Demo mode is active: no AI model was called, and this workflow cannot inspect reference-image pixels.";

    if (editSelected) {
      return [{
        type: "text",
        text: arabic
          ? "ما التغييرات التي تريدها في الخطة؟ سأحدّثها وأعرضها للموافقة من جديد."
          : "What would you like to change in the plan? I’ll revise it and ask for approval again.",
      }];
    }

    if (approvalSelected) {
      const prompt = kind === "video"
        ? `Create a video using only the user-confirmed brief below. Follow the specified subject, objective, audience, platform, duration, scenes, movement, audio, and exact on-screen copy only where the brief provides them; leave unspecified details open rather than guessing. Do not add prices, offers, product benefits, guarantees, or calls to action unless explicitly confirmed. Do not infer visual details from a reference: demo mode did not inspect its pixels.\n\nUser-provided brief:\n${userDetails || "[No brief details supplied]"}`
        : `Create an image using only the user-confirmed brief below. Follow the specified subject, objective, audience, platform, aspect ratio, visual direction, and exact copy only where the brief provides them; leave unspecified details open rather than guessing. Do not add prices, offers, product benefits, guarantees, logos, or calls to action unless explicitly confirmed. Do not infer visual details from a reference: demo mode did not inspect its pixels.\n\nUser-provided brief:\n${userDetails || "[No brief details supplied]"}`;
      return [{
        type: "text",
        text: `## Demo ${kind} prompt template\n\n${prompt}\n\nThis is prompt text only; no image or video was generated. The demo workflow does not produce an AI-validated final prompt.`,
      }];
    }

    const hasCoreSubject = /\b(?:mg\s*zs|gearbox|transmission|engine|car|vehicle|product|service)\b|فتيس|جيربوكس|ناقل\s*الحركة|محرك|سيارة|عربية|المنتج|الخدمة/i.test(userDetails);
    const hasCoreObjective = /\b(?:advertising|advertisement|ad campaign|ad|promot(?:e|ion)|sales?|awareness)\b|إعلان|اعلان|إعلانات|اعلانات|تسويق|استخدامها في الإعلانات|هستخدمها في الاعلانات/i.test(userDetails);
    const coreChecklist = [
      ...(!hasCoreSubject ? [arabic ? "ما المنتج أو الموضوع المحدد للصورة/الفيديو؟" : "What specific product or subject should the image/video feature?"] : []),
      ...(!hasCoreObjective ? [arabic ? "ما الهدف الأساسي من الصورة/الفيديو؟" : "What is the primary objective of the image/video?"] : []),
    ];
    const checklist = arabic
      ? "## التفاصيل التي أحتاجها\n1. المنتج أو الموضوع والهدف الإعلاني.\n2. الجمهور والمنصة أو موضع العرض.\n3. نسبة الأبعاد واللغة والنصوص الدقيقة التي يجب أن تظهر.\n4. العرض وCTA المعتمدان — أو أكّد عدم وجودهما.\n5. ما تريد الحفاظ عليه أو تغييره في المرجع، إن وُجد.\n6. للفيديو: المدة واللقطات والحركة والصوت والنهاية.\n\nأرسل التفاصيل مجمّعة قدر الإمكان؛ سأعرض خطة واحدة ثم أنتظر موافقتك قبل كتابة البرومبت."
      : "## Details to confirm\n1. Product/subject and advertising objective.\n2. Audience and platform/placement.\n3. Aspect ratio, language, and exact on-screen copy.\n4. Approved offer and CTA—or confirm there are none.\n5. What to preserve or change in the reference, if attached.\n6. For video: duration, shots, movement, audio, and ending.\n\nSend the details together if convenient. I’ll show one plan and wait for your approval before writing the prompt.";

    if (firstTurn || (!hasPendingPlan && (isApprovalText || coreChecklist.length > 0))) {
      const questions = coreChecklist.length
        ? `${arabic ? "## التفاصيل الأساسية الناقصة" : "## Essential details still needed"}\n${coreChecklist.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n\n${arabic ? "لن أطلب اعتماد خطة قبل حسم هذه النقاط." : "I will not request plan approval until these points are clear."}`
        : checklist;
      return [{
        type: "text",
        text: `${demoNote}\n\n${reference ? (arabic ? "لم يُحلّل المرجع في وضع العرض؛ لا توجد ملاحظات بصرية فعلية لاستخدامها.\n\n" : "The reference was not analyzed in demo mode; there are no actual visual observations to use.\n\n") : ""}${questions}`,
      }];
    }

    const plan = arabic
      ? `## خطة مبدئية لبرومبت ${kind === "image" ? "الصورة" : "الفيديو"}\n- الاعتماد على التفاصيل التي كتبتها أنت فقط: ${userDetails || "لم تُذكر تفاصيل كافية بعد."}\n- المرجع${reference ? " مرفق، لكن وضع العرض لم يحلل بكسلاته؛ لن أصف أو أخمّن محتواه." : " غير مرفق."}\n- إبقاء أي معلومة أو ادعاء أو نص غير مذكور دون افتراض. ${noMoreDetails ? "وصلتني ملاحظتك بأنك أرسلت التفاصيل؛ أي مقاس أو أسلوب غير مذكور سيظل اقتراحًا لا حقيقة مؤكدة." : "أي مقاس أو أسلوب غير مذكور سيظل غير محسوم."} هذه معاينة تجريبية وليست خطة تحقّق منها نموذج AI.\n\n${demoNote}`
      : `## Draft ${kind} prompt plan\n- Use only the details you provided: ${userDetails || "No substantive details have been provided yet."}\n- ${reference ? "A reference is attached, but demo mode did not inspect its pixels; I will not describe or guess its contents." : "No reference is attached."}\n- Leave every unstated fact, claim, and copy element unspecified. ${noMoreDetails ? "I understand you have already sent the details; any unspecified size or style remains a suggestion, not a confirmed fact." : "Any unspecified size or style remains unresolved."} This is a demo preview, not an AI-validated plan.\n\n${demoNote}`;
    return [
      { type: "text", text: plan },
      {
        type: "question_with_options",
        question: arabic ? "هل تعتمد هذه الخطة لكتابة البرومبت النهائي؟" : "Do you approve this plan for the final prompt?",
        options: [
          { id: "approve_prompt_plan", label: arabic ? "موافق، اكتب البرومبت" : "Approve and write the prompt" },
          { id: "edit_prompt_plan", label: arabic ? "أريد تعديل الخطة" : "Edit the plan" },
        ],
      },
    ];
  }

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
  const referenceChip = input.context.find((chip) => chip.kind === "reference");
  const conv: Conversation = {
    id: uid("conv"),
    title: input.text.slice(0, 48),
    lastMessagePreview: input.text.slice(0, 80),
    messageCount: 0,
    createdAt: now(),
    updatedAt: now(),
    context: {
      workflow: input.workflow,
      promptType: input.promptType,
      personaId: input.personaId,
      referenceAnalysisId: input.referenceAnalysisId ?? referenceChip?.id,
    },
  };
  state.conversations.unshift(conv);
  state.messages[conv.id] = [];
  return conv;
}

/* ------------------------------------------------------------------ */
/* MockApi                                                             */
/* ------------------------------------------------------------------ */

export class MockApi implements MarketingApi {
  /** Which plan the mock workspace is "on"; `switchPlan` moves it. */
  private subscriptionPlanId: PlanId = "pro";

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

  private brandIdentityState: BrandIdentityResponse = {
    businessId: fx.business.id,
    brandName: fx.business.name || "Nile Roastery & Co.",
    industry: fx.business.industry || "Specialty Coffee & Beverages",
    palette: {
      primary: "#2563EB",
      secondary: "#0F172A",
      accent: "#F59E0B",
      background: "#F8FAFC",
      text: "#0F172A",
      palette: ["#2563EB", "#1D4ED8", "#0F172A", "#334155", "#F59E0B"],
    },
    essence: {
      tagline: "Roasted This Week · Crafted for Peak Freshness",
      mission: "To deliver artisanal, transparently sourced specialty beans and bottled cold brew within 24 hours of roasting.",
      vision: "To become the premier direct-to-consumer specialty beverage brand in Egypt and the MENA region.",
      brandVoice: "Authentic, energetic, friendly, and expert without being snobbish.",
      toneKeywords: ["Fresh", "Artisanal", "Direct", "Passionate", "Reliable"],
      archetype: "The Craftsman & Explorer",
    },
    targetAudience: {
      summary: "Urban professionals, remote creatives, and coffee enthusiasts seeking fresher alternatives to supermarket mass coffee.",
      demographics: "Ages 22–45, urban Cairo / Giza / Alexandria, middle to upper-middle disposable income.",
      painPoints: ["Stale supermarket coffee with no roast dates", "Complicated home brewing gear", "Slow 3-5 day delivery times"],
      goals: ["Guaranteed freshness delivered within 24h", "Ready-to-drink options for offices and on-the-go", "Transparent origin stories"],
    },
    swot: {
      strengths: [
        "Roast-on-demand freshness guarantee with visible roast dates",
        "Proprietary 18-hour cold brew extraction technique",
        "Passionate community and fast Cairo fulfillment",
      ],
      weaknesses: [
        "Limited physical retail footprint compared to legacy international chains",
        "Higher cost of imported Ethiopian & Colombian green beans",
      ],
      opportunities: [
        "Corporate office RTD subscription packages",
        "Arabic-first lifestyle video content on Instagram Reels & TikTok",
        "Collaborative drops with local bakeries and co-working spaces",
      ],
      threats: [
        "Currency exchange volatility impacting bean import costs",
        "Aggressive discount promos by mass commercial brands",
      ],
    },
    keyOffers: [
      "Signature Nile Reserve Beans (250g / 1kg)",
      "Single-Origin Ethiopian Cold Brew (6-Pack Bottles)",
      "Office Weekly Refill Subscription (20% Savings)",
    ],
    competitors: [
      "Brew & Co",
      "Frost Coffee",
      "Cairo Commercial Brands",
    ],
    marketGaps: [
      "Same-day Cairo delivery with roast date printed on every batch",
      "Arabic-first educational and entertainment short-form content",
    ],
    syncedAt: new Date().toISOString(),
  };

  async getBrandIdentity(): Promise<BrandIdentityResponse> {
    await simulate({ safe: true });
    return clone(this.brandIdentityState);
  }

  async syncBrandIdentity(): Promise<BrandIdentityResponse> {
    await sleep(1200);
    await simulate();
    this.brandIdentityState.syncedAt = new Date().toISOString();
    return clone(this.brandIdentityState);
  }

  async updateBrandIdentity(patch: BrandIdentityUpdateRequest): Promise<BrandIdentityResponse> {
    await simulate();
    if (patch.brandName) this.brandIdentityState.brandName = patch.brandName;
    if (patch.industry) this.brandIdentityState.industry = patch.industry;
    if (patch.palette) Object.assign(this.brandIdentityState.palette, patch.palette);
    if (patch.essence) Object.assign(this.brandIdentityState.essence, patch.essence);
    if (patch.targetAudience) Object.assign(this.brandIdentityState.targetAudience, patch.targetAudience);
    if (patch.swot) Object.assign(this.brandIdentityState.swot, patch.swot);
    if (patch.keyOffers) this.brandIdentityState.keyOffers = patch.keyOffers;
    if (patch.competitors) this.brandIdentityState.competitors = patch.competitors;
    if (patch.marketGaps) this.brandIdentityState.marketGaps = patch.marketGaps;
    this.brandIdentityState.syncedAt = new Date().toISOString();
    return clone(this.brandIdentityState);
  }

  /* Campaigns */
  async listCampaigns(input?: { status?: Campaign["status"]; search?: string }) {
    await simulate();
    let list = state.campaigns;
    if (input?.status) list = list.filter((c) => c.status === input.status);
    if (input?.search) list = list.filter((c) => c.name.toLowerCase().includes(input.search!.toLowerCase()));
    return clone(list);
  }
  async listMetaAccountCampaigns(input?: ListMetaAccountCampaignsInput): Promise<MetaAccountCampaignPage> {
    await simulate({ safe: true });
    const mockCampaigns: MetaAccountCampaign[] = [
      {
        metaCampaignId: "23851234567890",
        name: "Summer Cold Brew Launch",
        objective: "OUTCOME_SALES",
        status: "ACTIVE",
        effectiveStatus: "ACTIVE",
        createdTime: "2026-09-18T10:00:00+0000",
        startTime: "2026-09-20T00:00:00+0000",
        stopTime: null,
      },
      {
        metaCampaignId: "mock-meta-90001",
        name: "Imported · Cairo Retargeting Preview",
        objective: "OUTCOME_ENGAGEMENT",
        status: "ACTIVE",
        effectiveStatus: "ACTIVE",
        createdTime: "2026-09-12T10:00:00+0000",
        startTime: "2026-09-14T00:00:00+0000",
        stopTime: null,
      },
      {
        metaCampaignId: "mock-meta-90002",
        name: "Imported · Winter Menu Awareness Preview",
        objective: "OUTCOME_AWARENESS",
        status: "PAUSED",
        effectiveStatus: "CAMPAIGN_PAUSED",
        createdTime: "2026-08-30T10:00:00+0000",
        startTime: "2026-09-01T00:00:00+0000",
        stopTime: null,
      },
    ];
    const search = input?.search?.trim().toLowerCase();
    const filtered = search
      ? mockCampaigns.filter((campaign) =>
          `${campaign.name} ${campaign.metaCampaignId}`.toLowerCase().includes(search),
        )
      : mockCampaigns;
    const offset = Math.max(0, Number.parseInt(input?.after ?? "0", 10) || 0);
    const limit = Math.max(1, Math.min(input?.limit ?? 50, 100));
    const campaigns = filtered.slice(offset, offset + limit);
    const nextOffset = offset + campaigns.length;
    const hasMore = nextOffset < filtered.length;
    return {
      status: "ok",
      source: "mock_meta_marketing_api",
      unavailableReason: null,
      accountId: "mock-ad-account",
      campaigns: clone(campaigns),
      hasMore,
      nextCursor: hasMore ? String(nextOffset) : null,
      retrievedAt: now(),
    };
  }

  async getCampaign(id: string) {
    await simulate();
    return clone(findOr404(state.campaigns, id, "Campaign"));
  }
  async createCampaign(raw: CampaignDraft) {
    const draft = CampaignDraftSchema.parse(raw);
    await simulate();
    const audienceId = draft.audience.id ?? null;
    const savedAudience = audienceId
      ? state.audiences.find((audience) => audience.id === audienceId && !audience.isArchived)
      : null;
    const campaign: Campaign = {
      id: uid("cmp"),
      businessId: fx.business.id,
      name: draft.name,
      objective: draft.objective,
      status: "draft",
      dailyBudget: draft.dailyBudget,
      currency: draft.currency,
      startDate: draft.startDate,
      endDate: draft.endDate,
      audienceId: savedAudience?.id ?? null,
      audienceSnapshot: savedAudience
        ? {
            id: savedAudience.id,
            name: savedAudience.name,
            description: savedAudience.description,
            targeting: clone(savedAudience.targeting),
          }
        : null,
      strategy: draft.strategy,
      creativeIds: draft.creativeIds,
      metaCampaignId: null,
      metrics: null,
      healthScore: null,
      createdAt: now(),
      updatedAt: now(),
    };
    state.campaigns.unshift(campaign);
    return clone(campaign);
  }
  async prepareMetaAdPlan(raw: CampaignDraft, plan: MetaAdPlanSettings): Promise<MetaAdPlanCreated> {
    const campaign = await this.createCampaign({ ...raw, launchNow: false });
    const recommendationId = uid("rec");
    const title = `Prepare paused Meta ads: ${campaign.name}`;
    mockMetaPlans.set(recommendationId, {
      campaignId: campaign.id,
      title,
      plan: clone(plan),
      approved: false,
    });
    return {
      campaignId: campaign.id,
      recommendationId,
      title,
      status: "pending",
      message: "Mock mode: plan saved locally; no Meta request was made.",
    };
  }
  async assistMetaAdPlan(input: MetaAdPlanAssistInput): Promise<MetaAdPlanAssistResponse> {
    await simulate({ safe: true });
    return {
      primaryText: input.primaryText?.trim()
        ? null
        : input.strategy.keyMessages[0] ?? input.strategy.summary ?? null,
      headline: input.headline?.trim()
        ? null
        : input.strategy.ctaDirection ?? input.strategy.keyMessages[0] ?? null,
      callToActionType: null,
      billingEvent: null,
      optimizationGoal: null,
      destinationType: null,
      specialAdCategories: null,
      bidStrategy: "LOWEST_COST_WITHOUT_CAP",
      allowedValues: {},
      fieldValidation: {
        billingEvent: "unchecked",
        optimizationGoal: "unchecked",
        destinationType: "unchecked",
        callToActionType: "unchecked",
        specialAdCategories: "unchecked",
        bidStrategy: "unchecked",
      },
      assumptions: ["Mock mode does not call Meta Ads MCP; review all values manually."],
      missingInputs: [],
      mcpContextAvailable: false,
      reviewRequired: true,
      writesToMeta: false,
    };
  }
  async previewMetaAdPlan(recommendationId: string): Promise<MetaAdPlanApprovalResponse> {
    await simulate({ safe: true });
    const saved = mockMetaPlans.get(recommendationId);
    if (!saved) throw new ApiError("NOT_FOUND", "Meta plan not found", 404);
    saved.approved = true;
    return {
      recommendation: {
        id: recommendationId,
        actionType: "create_meta_ad_plan",
        title: saved.title,
        status: "approved",
        payload: { kind: "meta_ad_plan_v1", plan: clone(saved.plan) },
        executionResult: null,
      },
      diff: [{
        field: "meta_creation_plan",
        before: null,
        after: {
          campaign: saved.title,
          objective: saved.plan.objective,
          creative_ids: saved.plan.creativeIds,
          hierarchy: "Campaign → Ad Set → Creative(s) → Ad(s)",
          meta_status: "PAUSED",
        },
      }],
      executed: false,
      requiresConfirmation: true,
      message: "Mock mode: phase 1 recorded; no Meta request was made.",
      auditLogId: null,
    };
  }
  async confirmMetaAdPlan(recommendationId: string): Promise<MetaAdPlanApprovalResponse> {
    await simulate({ safe: true });
    const saved = mockMetaPlans.get(recommendationId);
    if (!saved) throw new ApiError("NOT_FOUND", "Meta plan not found", 404);
    if (!saved.approved) throw new ApiError("APPROVAL_REQUIRED", "Review the plan first", 409);
    return {
      recommendation: {
        id: recommendationId,
        actionType: "create_meta_ad_plan",
        title: saved.title,
        status: "failed",
        payload: { kind: "meta_ad_plan_v1", plan: clone(saved.plan) },
        executionResult: { status: "unavailable", detail: "Mock mode does not write to Meta." },
      },
      diff: [],
      executed: false,
      requiresConfirmation: false,
      message: "Mock mode does not call Meta. Connect the real backend to execute after approval.",
      auditLogId: null,
    };
  }
  async activateMetaAdPlan(
    recommendationId: string,
    confirm: boolean,
  ): Promise<MetaAdPlanActivationResponse> {
    await simulate({ safe: true });
    const saved = mockMetaPlans.get(recommendationId);
    if (!saved) throw new ApiError("NOT_FOUND", "Meta plan not found", 404);
    const targets = ["campaign", "ad_set"];
    return {
      recommendation: {
        id: recommendationId,
        actionType: "create_meta_ad_plan",
        title: saved.title,
        status: "executed",
        payload: { kind: "meta_ad_plan_v1", plan: clone(saved.plan) },
        executionResult: { status: "unavailable", detail: "Mock mode does not write to Meta." },
      },
      executed: false,
      requiresConfirmation: !confirm,
      targets,
      activated: [],
      message: "Mock mode does not call Meta, so delivery cannot start here.",
      unavailableReason: "Connect the real backend to activate a Meta campaign.",
    };
  }
  async updateCampaign(raw: { id: string; patch: Partial<Campaign> }) {
    const input = UpdateCampaignInputSchema.parse(raw);
    await simulate();
    const c = findOr404(state.campaigns, input.id, "Campaign");
    Object.assign(c, input.patch, { updatedAt: now() });
    return clone(c);
  }
  async generateStrategy(raw: unknown): Promise<GeneratedCampaignStrategy> {
    const input = GenerateStrategyInputSchema.parse(raw);
    await sleep(1200);
    await simulate();
    return GeneratedCampaignStrategySchema.parse({
      summary: `Example strategy for a ${input.objective} campaign at ${input.dailyBudget} ${input.currency ?? "currency units"}/day.`,
      objective: input.objective,
      audience: input.audience.name || null,
      positioning: null,
      keyMessages: clone(fx.strategy.keyMessages),
      channels: fx.strategy.channels.map((channel) => ({
        channel,
        role: "Example placement for mock mode",
        budgetSharePct: null,
        placements: clone(fx.strategy.placements),
        rationale: "Illustrative fixture only; not evidence of channel performance.",
      })),
      placements: clone(fx.strategy.placements),
      creativeDirection: null,
      ctaDirection: null,
      creativesNeeded: [],
      successMetrics: fx.strategy.kpis.map((item) => item.metric),
      evidence: ["Mock mode sample only; no business research was run."],
      assumptions: ["Replace this sample with a generated strategy from the connected backend."],
      missingInputs: ["Confirm audience details and numeric KPI targets before launch."],
    });
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

  async getAudience(id: string): Promise<Audience> {
    await simulate();
    const saved = findOr404(state.audiences, id, "Audience");
    return clone({
      id: saved.id,
      name: saved.name,
      description: saved.description,
      ...saved.targeting,
      source: saved.source,
      isArchived: saved.isArchived,
    });
  }

  async listAudiences(): Promise<SavedAudience[]> {
    await simulate();
    return clone(state.audiences.filter((audience) => !audience.isArchived));
  }

  async createAudience(raw: SavedAudienceInput): Promise<SavedAudience> {
    const input = SavedAudienceInputSchema.parse(raw);
    await simulate();
    const audience: SavedAudience = {
      id: uid("aud"),
      businessId: fx.business.id,
      name: input.name,
      description: input.description ?? null,
      targeting: input.targeting,
      source: input.source,
      isArchived: false,
      createdAt: now(),
      updatedAt: now(),
    };
    state.audiences.unshift(audience);
    return clone(audience);
  }

  async updateAudience(input: { id: string; patch: Partial<SavedAudienceInput> }): Promise<SavedAudience> {
    await simulate();
    const audience = findOr404(state.audiences, input.id, "Audience");
    Object.assign(audience, input.patch, { updatedAt: now() });
    return clone(audience);
  }

  async archiveAudience(id: string): Promise<SavedAudience> {
    await simulate();
    const audience = findOr404(state.audiences, id, "Audience");
    audience.isArchived = true;
    audience.updatedAt = now();
    return clone(audience);
  }

  async suggestAudiences(raw: AudienceSuggestionInput): Promise<AudienceSuggestionResponse> {
    const input = AudienceSuggestionInputSchema.parse(raw);
    await simulate({ safe: true });
    return {
      suggestions: [
        {
          name: "Broad local audience",
          summary: `Reach broadly within the selected market for “${input.campaignName}”.`,
          approach: "broad",
          interestSearchTerms: [],
          targetingSearchTerms: [],
          rationale: "A broad option avoids guessing interests; compare it with a validated targeting test.",
        },
        {
          name: "Interest-led test",
          summary: `Test a small set of relevant interests for “${input.campaignName}”.`,
          approach: "targeting_hypothesis",
          interestSearchTerms: [],
          targetingSearchTerms: input.brief?.toLowerCase().includes("car")
            ? [
                { category: "interests", term: "Cars" },
                { category: "behaviors", term: "Frequent travelers" },
              ]
            : [
                { category: "interests", term: "Shopping" },
                { category: "job_titles", term: "Business owner" },
              ],
          rationale: "These are category-specific search phrases only; select a real Meta result before applying them.",
        },
      ],
      missingInputs: [],
    };
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
  async uploadCreative(input: { file: File; campaignId?: string; note?: string }) {
    await sleep(600);
    await simulate();
    const now = new Date().toISOString();
    const preview =
      typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
        ? URL.createObjectURL(input.file)
        : undefined;
    const creative: Creative = {
      id: uid("cr"),
      campaignId: input.campaignId ?? null,
      kind: "image",
      title: input.note?.trim() || input.file.name.slice(0, 60) || "Upload",
      status: "ready",
      prompt: input.note?.trim() || undefined,
      assetUrl: preview,
      thumbnailUrl: preview,
      aspectRatio: "1:1",
      tags: ["upload"],
      createdAt: now,
      updatedAt: now,
    };
    return creative;
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
    await sleep(300);
    await simulate({ safe: true });
    const unavailableReason = state.settings.locale === "ar"
      ? "وضع العرض لا يحلل وحدات بكسل الصورة ولا يشغّل VLM. عطّل NEXT_PUBLIC_USE_MOCKS وشغّل الخادم لتحليل المرجع الفعلي."
      : "Demo mode does not inspect image pixels or run a VLM. Disable NEXT_PUBLIC_USE_MOCKS and use the backend to analyze the actual reference.";
    return {
      id: "ref_unknown",
      sourceName: input.fileName ?? "reference",
      kind: input.kind,
      status: "unavailable" as const,
      unavailableReason,
      hook: "",
      structure: [],
      visualStyle: [],
      tone: [],
      strengths: [],
      weaknesses: [],
      estimatedPerformance: "unknown" as const,
      inspiredBrief: "",
      style: {
        canvasRatio: "",
        background: "",
        lighting: "",
        visibleText: [],
        elements: [],
        palette: [],
        composition: "",
        typography: "",
        tone: "",
        layoutPattern: "",
        hookType: "",
        colorMood: "",
        textDensity: "",
        brandElements: [],
        notes: unavailableReason,
      },
      observedOffers: [],
      observedCta: [],
      createdAt: now(),
    } satisfies ReferenceAnalysis;
  }
  async listCreativeReferences() {
    await simulate();
    return clone([...state.references].sort((a, b) => Number(b.favorite) - Number(a.favorite)));
  }
  async updateCreativeReference(raw: { id: string; favorite: boolean }) {
    const input = raw;
    await simulate();
    const reference = findOr404(state.references, input.id, "Creative reference");
    reference.favorite = input.favorite;
    return clone(reference);
  }
  async deleteCreativeReference(id: string) {
    await simulate();
    const idx = state.references.findIndex((r) => r.id === id);
    if (idx !== -1) {
      state.references.splice(idx, 1);
    }
  }
  async uploadChatAttachment(raw: { source: string; fileName?: string; mime?: string }) {
    await sleep(150);
    await simulate({ safe: true });
    // Demo mode stores nothing on a server, but the id must still travel with
    // the next message so the chat contract is exercised end to end.
    return {
      id: `att_${Math.random().toString(36).slice(2, 12)}`,
      name: raw.fileName ?? "attachment.png",
      mime: raw.mime ?? "image/png",
      createdAt: now(),
    };
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
  async getCampaignAdInsights(id: string): Promise<MetaAdInsightsResponse> {
    await simulate({ safe: true });
    findOr404(state.campaigns, id, "Campaign");
    const dateEnd = new Date().toISOString().slice(0, 10);
    const dateStart = new Date(Date.now() - 29 * 86400_000).toISOString().slice(0, 10);
    return {
      campaignId: id,
      status: "unavailable",
      reason: "Mock mode has no real Meta Ad-level Insights; no performance is fabricated.",
      dateStart,
      dateEnd,
      ads: [],
    };
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
    await simulate({ safe: input.workflow === "creative_prompt" });
    let last: SendMessageOutput | null = null;
    for await (const chunk of this.streamMessage(input)) last = chunk;
    if (!last) throw new ApiError("EMPTY_STREAM", "No response produced");
    return last;
  }
  async *streamMessage(raw: unknown): AsyncIterable<SendMessageOutput> {
    const input = SendMessageInputSchema.parse(raw);
    await sleep(250);
    if (input.workflow !== "creative_prompt" && Math.random() < ERROR_RATE) {
      throw new ApiError("MOCK_RANDOM_FAILURE", "The assistant is temporarily unavailable.", 503);
    }
    const conversation = upsertConversation(input);
    const referenceChip = input.context.find((chip) => chip.kind === "reference");
    conversation.context = {
      ...(conversation.context ?? {}),
      ...(input.workflow ? { workflow: input.workflow } : {}),
      ...(input.promptType ? { promptType: input.promptType } : {}),
      ...(input.personaId ? { personaId: input.personaId } : {}),
      ...(input.referenceAnalysisId || referenceChip ? { referenceAnalysisId: input.referenceAnalysisId ?? referenceChip?.id } : {}),
    };
    const firstTurn = (state.messages[conversation.id] ?? []).length === 0;
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

    const finalBlocks = synthesizeAssistantBlocks(input, firstTurn, conversation.id);
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
  async searchMetaInterests(query: string, category: TargetingCategory) {
    await simulate({ safe: true });
    return {
      available: true,
      unavailableReason: null,
      results: getMockMetaTargetingResults(query, category),
      hasMore: false,
    };
  }

  async connectMeta(): Promise<MetaConnection> {
    throw new ApiError(
      "ADMIN_CONFIGURATION_REQUIRED",
      "Meta is admin-managed. Configure the access token, ad account ID, and Facebook Page ID in Settings > Admin > Connectors; no OAuth flow is available in this workspace.",
      400,
    );
  }
  async reauthMeta(): Promise<MetaConnection> {
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
    if (input.tool === "generate_image_prompt" || input.tool === "generate_video_prompt") {
      throw new ApiError("NOT_IMPLEMENTED", "Image/video prompts must be created through the Layla chat workflow.", 501);
    }
    await sleep(1100);
    // Keep writing deterministic in demo mode; a random simulated 503 here looked
    // like a broken "Write with AI" action rather than an optional demo failure.
    await simulate({ safe: true });
    const b = input.brief.trim();
    const scriptSections = input.language === "ar"
      ? [
          { heading: "0–2 ث · البداية", body: `ابدأ بصورة واضحة مرتبطة بهذا الملخص: ${b.slice(0, 180)}. استخدم التفاصيل التي زوّد بها المستخدم فقط.` },
          { heading: "2–6 ث · الاستخدام", body: "اعرض المنتج أو الخدمة في سياق استخدام واقعي، من دون إضافة ميزة غير مذكورة." },
          { heading: "6–11 ث · الرسالة", body: "ركّز على فائدة مؤكدة في الملخص أو ملف النشاط. إذا لم تُذكر فائدة، اجعل المشهد وصفيًا بلا ادعاء." },
          { heading: "11–15 ث · النهاية", body: "استخدم دعوة إجراء معتمدة إن وردت؛ وإلا اختم بإطار محايد للعلامة أو المنتج من دون عرض أو وعد." },
          { heading: "ملاحظات", body: "مسودة توضيحية من وضع العرض؛ راجع التفاصيل التجارية قبل الاستخدام." },
        ]
      : [
          { heading: "0–2s · Opening", body: `Open with a clear visual tied to this brief: ${b.slice(0, 180)}. Use only user-supplied details.` },
          { heading: "2–6s · In use", body: "Show the product or service in a realistic use context without adding an unprovided feature." },
          { heading: "6–11s · Message", body: "Focus on a benefit confirmed in the brief or business profile. If none is stated, keep the scene descriptive and claim-free." },
          { heading: "11–15s · Close", body: "Use an approved call to action if one was supplied; otherwise finish on a neutral brand/product frame with no offer or promise." },
          { heading: "Notes", body: "Illustrative demo draft; verify business facts before use." },
        ];
    const byTool: Record<
      GenerateTextInput["tool"],
      { title: string; sections: { heading: string; body: string }[] }
    > = {
      generate_creative_brief: {
        title: `Creative brief – ${b.slice(0, 40)}`,
        sections: [
          { heading: "Objective", body: `Reflect the goal stated in the user brief without adding an offer or unsupported claim. Brief: ${b}.` },
          { heading: "Core message", body: "State one verified benefit if the brief or saved profile provides one; otherwise describe the product or service neutrally." },
          { heading: "Audience insight", body: "Use an audience insight only when supported by the supplied context; otherwise flag it for confirmation." },
          { heading: "Tone", body: "Match the user's requested tone; ask for clarification if it is not specified." },
          { heading: "Mandatories", body: "Use supplied brand assets and approved copy only. Confirm any offer, price, performance claim, or CTA before use." },
          { heading: "Deliverables", body: "Illustrative brief outline; confirm formats and placements from the request." },
        ],
      },
      generate_commercial_script: {
        title: `15s script – ${b.slice(0, 40)}`,
        sections: scriptSections,
      },
      generate_image_prompt: {
        title: `Image prompt – ${b.slice(0, 40)}`,
        sections: [
          { heading: "Prompt", body: `${b}. Illustrative placeholder only: use the actual subject, setting, palette, typography, and dimensions supplied by the user. Do not add product features, offers, or brand claims.` },
          { heading: "Negative prompt", body: "Exclude visual elements the user explicitly asked to avoid; confirm other restrictions." },
          { heading: "Variants", body: "Choose aspect ratios only after confirming the intended placement." },
        ],
      },
      generate_video_prompt: {
        title: `Video prompt – ${b.slice(0, 40)}`,
        sections: [
          { heading: "Prompt", body: `${b}. Illustrative placeholder only: build shots from the confirmed subject, setting, and message in the brief; do not invent product features, offers, or business claims.` },
          { heading: "Motion & camera", body: "Confirm the required camera movement and pacing before finalizing." },
          { heading: "Audio", body: "Use only approved dialogue, voiceover, and music direction." },
        ],
      },
      generate_ad_copy: {
        title: `Ad copy – ${b.slice(0, 40)}`,
        sections: [
          { heading: "Headline", body: `${b.slice(0, 100)}${b.length > 100 ? "…" : ""}` },
          { heading: "Primary text", body: `${b}\nUse only claims and details stated in the brief or confirmed business profile; this demo does not add offers or benefits.` },
          { heading: "CTA", body: "Use the CTA supplied by the user; otherwise leave it for confirmation." },
        ],
      },
      generate_ad_variations: {
        title: `Ad variations – ${b.slice(0, 40)}`,
        sections: [
          { heading: "Variation 1 · Brief-led", body: `Draft: ${b}\nKeep product facts and offers exactly as supplied.` },
          { heading: "Variation 2 · Visual-led", body: `Use a visual angle grounded in the brief: ${b}\nConfirm any benefit before stating it.` },
          { heading: "Variation 3 · Message-led", body: `Reframe the supplied message without adding claims: ${b}\nUse only a confirmed CTA.` },
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
    // Mirror the server's resolution: the provider field decides both whether
    // this connector is a placeholder and whether it can be "configured" at all.
    const providerField = connector.fields.find((f) => f.key === "provider");
    if (providerField) {
      connector.provider = providerField.value ?? null;
      connector.placeholder =
        connector.provider === null || ["mock", "none"].includes(connector.provider);
    }
    connector.missingRequired = connector.fields
      .filter((f) => f.required && !(f.hasValue || f.value !== null))
      .map((f) => f.key);
    connector.configured =
      !connector.placeholder &&
      connector.fields.filter((f) => f.required).every((f) => f.hasValue || f.value !== null);
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

  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    await simulate({ safe: true });
    return clone(fxa.mockSubscriptionPlans);
  }

  async getSubscription(): Promise<WorkspaceSubscription> {
    await simulate({ safe: true });
    const plans = fxa.mockSubscriptionPlans;
    const plan = plans.find((p) => p.id === this.subscriptionPlanId) ?? plans[0];
    const usage = fxa.mockUsage.today;
    const budget = plan.dailyTokenBudget;
    const used = usage.totalTokens;
    return {
      workspaceId: usage.workspaceId,
      businessId: usage.businessId,
      businessName: "Sahm Demo Workspace",
      currentPlan: clone(plan),
      dailyTokenBudget: budget,
      tokensUsedToday: used,
      // Deliberately unclamped: downgrading to `free` with today's usage is
      // >400 %, and the UI must be able to say so.
      percentConsumed: budget > 0 ? Math.round((used * 10_000) / budget) / 100 : 0,
      isBudgetExceeded: used >= budget,
      observabilityActive: fxa.mockObservability.langsmith.enabled || fxa.mockObservability.langfuse.enabled,
      observabilityDetails: {},
    };
  }

  async switchPlan(planId: PlanId): Promise<SwitchPlanResponse> {
    await simulate({ safe: true });
    const plans = fxa.mockSubscriptionPlans;
    const previous = this.subscriptionPlanId;
    const next = plans.find((p) => p.id === planId);
    if (!next) throw new ApiError("not_found", `Subscription plan '${planId}' not found.`, 404);
    this.subscriptionPlanId = planId;
    return {
      success: true,
      message: `Workspace switched to ${next.name}. Daily token budget is now ${next.dailyTokenBudget.toLocaleString()} tokens.`,
      previousPlanId: previous,
      newPlan: clone(next),
      updatedDailyBudget: next.dailyTokenBudget,
    };
  }

  async getObservabilityStatus(): Promise<ObservabilityStatus> {
    await simulate({ safe: true });
    return clone(fxa.mockObservability);
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
