/**
 * Fixtures for the admin surfaces (P1 auth, P3 admin panel).
 *
 * Kept separate from `fixtures.ts` / `fixtures-extra.ts` so the domain data the
 * prototype screens render is not tangled with the data the *new* admin screens
 * need. Everything here is deliberately shaped like a real backend response —
 * secrets masked, `source` provenance present, `percentUsed` sometimes above 100
 * — so the mock exercises the same edge cases the UI has to render.
 */

import type {
  AuditEntry,
  AuditList,
  AuthSession,
  Connector,
  ConnectorSettings,
  MemoryItem,
  MemoryKind,
  SessionInfo,
  Usage,
} from "@/types";

export const MOCK_USER_ID = "usr_2f8a41c7";

export const mockAuthSession: AuthSession = {
  accessToken: "mock_token_dev_only",
  tokenType: "Bearer",
  expiresIn: 7 * 24 * 3600,
  user: {
    id: MOCK_USER_ID,
    email: "salma@sahm.app",
    fullName: "Salma Fouad",
    isActive: true,
    lastLoginAt: "2026-02-18T09:14:00.000Z",
    createdAt: "2025-11-02T12:00:00.000Z",
  },
  workspaces: [
    {
      workspaceId: "ws_nile",
      businessId: "biz_nile",
      businessName: "Nile Coffee Roasters",
      role: "owner",
      isPrimary: true,
    },
    {
      workspaceId: "ws_dawn",
      businessId: "biz_dawn",
      businessName: "Dawn Wellness Studio",
      role: "member",
      isPrimary: false,
    },
  ],
  activeWorkspaceId: "ws_nile",
};

export const mockSessionInfo: SessionInfo = {
  user: mockAuthSession.user,
  workspaces: mockAuthSession.workspaces,
  activeWorkspaceId: "ws_nile",
  activeRole: "owner",
};

export const mockBusinessProfile = {
  businessId: "biz_nile",
  name: "Nile Coffee Roasters",
  industry: "Speciality coffee & retail",
  websiteUrl: "https://nilecoffee.example",
  country: "EG",
  language: "en",
  currency: "EGP",
  monthlyBudget: 120000,
  dailyTokenBudget: null,
  goals: ["Grow direct-to-consumer subscriptions", "Win the Cairo office segment"],
  brandVoice: "Warm, precise, never snobbish. We talk about coffee the way a barista does.",
  visualStyle: "Warm neutrals, matte kraft paper, generous negative space, #3B2416 accents",
  targetAudience: "Urban professionals 25-40 in Cairo and Alexandria who care about origin and brew method",
  keyOffers: ["Subscription: 250g/month, 15% off", "Free shipping over EGP 600"],
  competitors: ["Bean Station", "Roastery 22", "Cairo Coffee Club"],
  updatedAt: "2026-02-18T08:00:00.000Z",
};

const iso = (daysAgo: number, hour = 10) => {
  const d = new Date(Date.UTC(2026, 1, 18, hour, 0, 0));
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString();
};

export const mockMemoryItems: MemoryItem[] = [
  {
    id: "mem_001",
    businessId: "biz_nile",
    kind: "voice_example",
    text: "We roast small batches in Nasr City and ship the same week — no warehouse, no waiting.",
    metadata: { channel: "instagram" },
    campaignId: null,
    createdAt: iso(2),
    score: null,
  },
  {
    id: "mem_002",
    businessId: "biz_nile",
    kind: "voice_example",
    text: "Ask us which grinder you own before you buy a filter. We will happily talk you out of it.",
    metadata: { channel: "email" },
    campaignId: null,
    createdAt: iso(6),
    score: null,
  },
  {
    id: "mem_003",
    businessId: "biz_nile",
    kind: "visual_style",
    text: "Kraft-paper bags, unbleached, single-colour stamp. Product on a warm stone surface, side light.",
    metadata: {},
    campaignId: null,
    createdAt: iso(9),
    score: null,
  },
  {
    id: "mem_004",
    businessId: "biz_nile",
    kind: "offer",
    text: "Subscription: 250g/month at 15% off, pause or cancel any time, shipping included.",
    metadata: { priority: "high" },
    campaignId: null,
    createdAt: iso(14),
    score: null,
  },
  {
    id: "mem_005",
    businessId: "biz_nile",
    kind: "audience",
    text: "Home brewers who already own a grinder and are curious about single-origin Ethiopian washed lots.",
    metadata: {},
    campaignId: null,
    createdAt: iso(21),
    score: null,
  },
  {
    id: "mem_006",
    businessId: "biz_nile",
    kind: "competitor_note",
    text: "Bean Station leads on convenience (same-day delivery) and loses on price transparency.",
    metadata: {},
    campaignId: null,
    createdAt: iso(30),
    score: null,
  },
  {
    id: "mem_007",
    businessId: "biz_nile",
    kind: "learning",
    text: "Carousel posts with a brew-ratio card outperform single images by 2.4x on saves.",
    metadata: { source: "campaign:cmp_roastery" },
    campaignId: "cmp_roastery",
    createdAt: iso(4),
    score: null,
  },
];

/* -------------------------------------------------------------------------- */
/* Connectors                                                                  */
/* -------------------------------------------------------------------------- */

const field = (
  key: string,
  label: string,
  opts: Partial<Omit<Connector["fields"][number], "key" | "label">> = {},
): Connector["fields"][number] => ({
  key,
  label,
  secret: false,
  required: false,
  maxLength: 500,
  description: "",
  value: null,
  hasValue: false,
  masked: null,
  source: "unset",
  ...opts,
});

export const mockConnectors: Connector[] = [
  {
    connector: "meta",
    label: "Meta Ads",
    source: "env",
    hasOverride: false,
    configured: true,
    provider: "meta_ads",
    providers: [],
    missingRequired: [],
    placeholder: false,
    notes: "Demo-only settings. In production, an admin configures Meta; campaign creation still requires a separate review and approval.",
    fields: [
      field("appId", "App ID", { required: true, value: "102938475610293", source: "env", maxLength: 120 }),
      field("appSecret", "App secret", { secret: true, required: true, hasValue: true, masked: "••••••••", source: "env" }),
      field("adAccountId", "Ad account ID", { required: true, value: "act_204811223344", source: "env", maxLength: 120 }),
      field("pageId", "Facebook Page ID", { required: true, value: "fb_page_demo", source: "env", maxLength: 120 }),
      field("accessToken", "Access token", {
        secret: true,
        required: true,
        hasValue: true,
        masked: "••••••••",
        source: "env",
        maxLength: 4000,
      }),
    ],
  },
  {
    connector: "google_places",
    label: "Google Places",
    source: "workspace",
    hasOverride: true,
    configured: true,
    provider: "google_places",
    providers: [],
    missingRequired: [],
    placeholder: false,
    notes: "Powers local competitor research and store discovery.",
    fields: [
      field("apiKey", "API key", { secret: true, required: true, hasValue: true, masked: "••••••••", source: "workspace" }),
      field("baseUrl", "Base URL override", { value: null, source: "unset", maxLength: 500 }),
    ],
  },
  {
    connector: "dataforseo",
    label: "DataForSEO",
    source: "default",
    hasOverride: false,
    configured: false,
    provider: "dataforseo",
    providers: ["mock", "dataforseo"],
    missingRequired: ["login", "password"],
    placeholder: true,
    notes: "Keyword volumes and SERP data. Unconfigured tools return placeholder numbers.",
    fields: [
      field("login", "Login", { source: "unset", maxLength: 200 }),
      field("password", "Password", { secret: true, source: "unset" }),
    ],
  },
  {
    connector: "image",
    label: "Image generation",
    source: "env",
    hasOverride: false,
    configured: true,
    provider: "mock",
    providers: ["mock", "openai", "stability"],
    missingRequired: [],
    placeholder: true,
    notes: "Creative generation. `mock` returns deterministic placeholder images.",
    fields: [
      field("provider", "Provider", { value: "mock", source: "default", maxLength: 30 }),
      field("apiKey", "API key", { secret: true, source: "unset" }),
      field("model", "Model", { value: "sahm-imagen-v1", source: "default", maxLength: 80 }),
    ],
  },
  {
    connector: "search",
    label: "Web search",
    source: "default",
    hasOverride: false,
    configured: true,
    provider: "none",
    providers: ["mock", "tavily", "serper", "brave"],
    missingRequired: [],
    placeholder: true,
    notes: "Market and competitor research. `none` disables the tool.",
    fields: [field("provider", "Provider", { value: "none", source: "default", maxLength: 30 })],
  },
];

export const mockConnectorSettings: ConnectorSettings = {
  businessId: "biz_nile",
  environment: "development",
  overrideCount: 1,
  connectors: mockConnectors,
  encryptionKeyConfigured: false,
};

/* -------------------------------------------------------------------------- */
/* Usage                                                                       */
/* -------------------------------------------------------------------------- */

const usageBase = {
  workspaceId: "ws_nile",
  businessId: "biz_nile",
  calls: 1_284,
  budgetSource: "default",
  estimatedCalls: 0,
  // Demo data is unpriced on purpose: the real endpoint returns null until the
  // workspace configures a token price, and the UI must handle exactly that.
  estimatedCostUsd: null,
  costPerMillionInUsd: 0,
  costPerMillionOutUsd: 0,
};

export const mockUsage: Record<string, Usage> = {
  today: {
    ...usageBase,
    period: "today",
    tokensIn: 412_880,
    tokensOut: 158_120,
    totalTokens: 571_000,
    budgetTokens: 2_000_000,
    remainingTokens: 1_429_000,
    percentUsed: 28.55,
    exceeded: false,
    resetAt: "2026-02-19T00:00:00.000Z",
    periodStart: "2026-02-18T00:00:00.000Z",
    burnRatePerHour: 71_375,
    projectedTotalTokens: 1_713_000,
    byModel: [
      { key: "gpt-4o-mini", tokens: 288_000, share: 0.5044 },
      { key: "gpt-4o", tokens: 196_000, share: 0.3433 },
      { key: "text-embedding-3-small", tokens: 87_000, share: 0.1524 },
    ],
    byPersona: [
      { key: "layla", tokens: 241_000, share: 0.4219 },
      { key: "omar", tokens: 173_000, share: 0.3029 },
      { key: "salma", tokens: 98_000, share: 0.1716 },
      { key: "karim", tokens: 59_000, share: 0.1033 },
    ],
    byAction: [
      { key: "chat.turn", tokens: 262_000, share: 0.4588 },
      { key: "research.analyze_competitor", tokens: 171_000, share: 0.2995 },
      { key: "creative.reference", tokens: 92_000, share: 0.1611 },
      { key: "content.calendar", tokens: 46_000, share: 0.0806 },
    ],
  },
  // Deliberately over budget: the UI has to render a 100%+ meter without clamping.
  month: {
    ...usageBase,
    period: "month",
    tokensIn: 6_118_400,
    tokensOut: 2_406_900,
    totalTokens: 8_525_300,
    budgetTokens: 60_000_000,
    remainingTokens: 51_474_700,
    percentUsed: 14.21,
    exceeded: false,
    resetAt: "2026-03-01T00:00:00.000Z",
    periodStart: "2026-02-01T00:00:00.000Z",
    burnRatePerHour: 18_963,
    projectedTotalTokens: 13_672_400,
    byModel: [
      { key: "gpt-4o-mini", tokens: 4_262_650, share: 0.5 },
      { key: "gpt-4o", tokens: 2_982_855, share: 0.35 },
      { key: "text-embedding-3-small", tokens: 1_279_795, share: 0.15 },
    ],
    byPersona: [
      { key: "layla", tokens: 3_410_120, share: 0.4 },
      { key: "omar", tokens: 2_557_590, share: 0.3 },
      { key: "salma", tokens: 1_705_060, share: 0.2 },
      { key: "karim", tokens: 852_530, share: 0.1 },
    ],
    byAction: [
      { key: "chat.turn", tokens: 3_903_000, share: 0.4579 },
      { key: "research.analyze_competitor", tokens: 2_561_000, share: 0.3004 },
      { key: "creative.image", tokens: 1_378_000, share: 0.1617 },
      { key: "campaign.strategy", tokens: 683_300, share: 0.0802 },
    ],
  },
};

/* -------------------------------------------------------------------------- */
/* Audit                                                                       */
/* -------------------------------------------------------------------------- */

export const mockAuditEntries: AuditEntry[] = [
  {
    id: "aud_001",
    actor: MOCK_USER_ID,
    action: "recommendation.approved",
    entityType: "recommendation",
    entityId: "rec_8821",
    businessId: "biz_nile",
    requestId: "req_8fa21c",
    before: { status: "pending", budget: 900 },
    after: { status: "approved", budget: 900 },
    result: null,
    createdAt: "2026-02-18T09:41:12.000Z",
  },
  {
    id: "aud_002",
    actor: MOCK_USER_ID,
    action: "recommendation.executed",
    entityType: "recommendation",
    entityId: "rec_8821",
    businessId: "biz_nile",
    requestId: "req_8fa21d",
    before: null,
    after: { dailyBudget: 900, metaCampaignId: "120331998771" },
    result: { ok: true },
    createdAt: "2026-02-18T09:41:40.000Z",
  },
  {
    id: "aud_003",
    actor: MOCK_USER_ID,
    action: "business_profile.updated",
    entityType: "business",
    entityId: "biz_nile",
    businessId: "biz_nile",
    requestId: "req_8f9d02",
    before: { brandVoice: null, keyOffers: [] },
    after: { brandVoice: "Warm, precise, never snobbish…", keyOffers: ["Subscription: 250g/month"] },
    result: null,
    createdAt: "2026-02-18T08:02:55.000Z",
  },
  {
    id: "aud_004",
    actor: "system",
    action: "connector.updated",
    entityType: "tool_settings",
    entityId: "google_places",
    businessId: "biz_nile",
    requestId: "req_8f8a77",
    before: { apiKey: null },
    after: { apiKey: "***SET***" },
    result: null,
    createdAt: "2026-02-17T16:20:03.000Z",
  },
  {
    id: "aud_005",
    actor: MOCK_USER_ID,
    action: "memory.item.created",
    entityType: "brand_memory",
    entityId: "mem_004",
    businessId: "biz_nile",
    requestId: "req_8f71aa",
    before: null,
    after: { kind: "offer", text: "Subscription: 250g/month at 15% off…" },
    result: null,
    createdAt: "2026-02-16T11:05:44.000Z",
  },
  {
    id: "aud_006",
    actor: MOCK_USER_ID,
    action: "recommendation.rejected",
    entityType: "recommendation",
    entityId: "rec_8790",
    businessId: "biz_nile",
    requestId: "req_8f6b21",
    before: { status: "pending" },
    after: { status: "rejected", reason: "wrong audience" },
    result: null,
    createdAt: "2026-02-15T14:33:20.000Z",
  },
];

export const mockAuditList: AuditList = {
  entries: mockAuditEntries,
  limit: 50,
  total: mockAuditEntries.length,
  entityType: null,
  entityId: null,
  actor: null,
};

/** Memory kinds used by the mock similarity search, in the order the UI lists them. */
export const mockMemoryKindOrder: readonly MemoryKind[] = [
  "voice_example",
  "visual_style",
  "offer",
  "audience",
  "competitor_note",
  "learning",
  "reference_analysis",
];
