import { z } from "zod";
import type { QueryClient } from "@tanstack/react-query";
import type { MarketingApi } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { ActionType, ChangeDiff, CreativeKind, CampaignDraft } from "@/types";
import {
  CampaignDraftSchema,
  CampaignStatusSchema,
  CreativeKindSchema,
  GenerateContentCalendarInputSchema,
  GenerateTextInputSchema,
  IdSchema,
  UpdateAgentInputSchema,
} from "@/types";

/* ------------------------------------------------------------------ */
/* Context passed to every handler                                     */
/* ------------------------------------------------------------------ */

export interface ActionContext {
  api: MarketingApi;
  queryClient: QueryClient;
  /** next/navigation router push */
  navigate: (href: string) => void;
  /** translation function scoped to the `actions` namespace */
  t: (key: string, values?: Record<string, string | number>) => string;
  /** Human-in-the-loop confirmation. Resolves false if user cancels. */
  confirm: (req: { title: string; description?: string; diff: ChangeDiff[]; confirmLabel?: string }) => Promise<boolean>;
  /** Ask the user to pick a campaign. Resolves null if cancelled. */
  pickCampaign: (title: string) => Promise<string | null>;
  /** UI store hooks used by navigation-only actions */
  ui: {
    /** Show a generated text result (brief/script/prompt) in the GeneratedTextDialog. */
    setGeneratedText: (v: import("@/types").GeneratedText | null) => void;
    setCreateCreative: (v: { kind: CreativeKind; brief?: string; campaignId?: string | null; referenceAnalysisId?: string } | null) => void;
    setCampaignPrefill: (v: Partial<CampaignDraft> | null) => void;
  };
}

export interface ActionResult {
  ok: boolean;
  /** i18n key (namespace `actions`) for a toast message */
  toastKey?: string;
  toastValues?: Record<string, string | number>;
  navigateTo?: string;
  data?: unknown;
}

export interface ActionDefinition<P> {
  type: ActionType;
  /** i18n key for the default button label (namespace `actions`) */
  labelKey: string;
  /** lucide icon name, resolved by ActionButton */
  icon: string;
  payloadSchema: z.ZodType<P>;
  /**
   * If true, the action applies a change to a live campaign and MUST show a before/after
   * confirmation dialog before `handler` runs. `getDiff` produces the dialog content.
   */
  requiresConfirmation: boolean | ((payload: P) => boolean);
  getDiff?: (payload: P, ctx: ActionContext) => Promise<{ title: string; description?: string; diff: ChangeDiff[] }>;
  /** Optional step to collect missing input from the user (e.g. pick a campaign). Return null to cancel. */
  prepare?: (payload: P, ctx: ActionContext) => Promise<P | null>;
  handler: (payload: P, ctx: ActionContext) => Promise<ActionResult>;
}

/* ------------------------------------------------------------------ */
/* Payload schemas                                                     */
/* ------------------------------------------------------------------ */

const CreateCampaignPayload = z.object({
  draft: CampaignDraftSchema.optional(),
  prefill: z.record(z.string(), z.unknown()).optional(),
  angle: z.string().optional(),
});
const CreateCreativePayload = z.object({
  kind: CreativeKindSchema.default("image"),
  brief: z.string().optional(),
  campaignId: IdSchema.nullable().optional(),
  referenceAnalysisId: IdSchema.optional(),
  aspectRatio: z.enum(["1:1", "4:5", "9:16", "16:9"]).optional(),
  count: z.number().int().min(1).max(6).optional(),
});
const GenerateVariationsPayload = z.object({ creativeId: IdSchema, count: z.number().int().min(1).max(6).default(3) });
const AnalyzeCampaignPayload = z.object({ campaignId: IdSchema });
const AnalyzeCreativePayload = z.object({ creativeId: IdSchema });
const ResearchCompetitorsPayload = z.object({ query: z.string().optional() });
const OptimizeCampaignPayload = z.object({ campaignId: IdSchema });
const ConnectMetaPayload = z.object({ mode: z.enum(["connect", "reauth", "disconnect"]).default("connect") });
const ApplyRecommendationPayload = z.object({ recommendationId: IdSchema });
const AddToCampaignPayload = z.object({ creativeId: IdSchema, campaignId: IdSchema.optional() });
const UpdateCampaignPayload = z.object({
  campaignId: IdSchema,
  patch: z.object({
    status: CampaignStatusSchema.optional(),
    dailyBudget: z.number().nonnegative().optional(),
    name: z.string().optional(),
  }),
});

/* ------------------------------------------------------------------ */
/* Definitions                                                         */
/* ------------------------------------------------------------------ */

function define<P>(def: ActionDefinition<P>): ActionDefinition<P> {
  return def;
}

/** Research / strategy tools all share one shape: start a backend task, jump to the conversation where results land. */
function agentTask<P extends Record<string, unknown>>(type: ActionType, icon: string, payloadSchema: z.ZodType<P>): ActionDefinition<P> {
  return define<P>({
    type,
    labelKey: type,
    icon,
    payloadSchema,
    requiresConfirmation: false,
    async handler(payload, ctx) {
      const task = await ctx.api.startTask({ type, payload });
      await invalidate(ctx.queryClient, [qk.conversations]);
      return { ok: true, toastKey: "toast.taskStarted", navigateTo: taskDestination(task.resultRef), data: task };
    },
  });
}

const invalidate = (qc: QueryClient, keys: readonly (readonly unknown[])[]) =>
  Promise.all(keys.map((queryKey) => qc.invalidateQueries({ queryKey })));

export const actionRegistry = {
  CREATE_CAMPAIGN: define({
    type: "CREATE_CAMPAIGN",
    labelKey: "CREATE_CAMPAIGN",
    icon: "Megaphone",
    payloadSchema: CreateCampaignPayload,
    // Launching starts spend → human confirmation. Saving a draft does not.
    requiresConfirmation: (p) => !!p.draft?.launchNow,
    async getDiff(payload, ctx) {
      const d = payload.draft!;
      return {
        title: ctx.t("launchTitle", { name: d.name }),
        diff: [
          { field: "status", label: ctx.t("diff.campaignStatus"), before: "draft", after: "active" },
          { field: "dailyBudget", label: ctx.t("diff.dailyBudget"), before: 0, after: `${d.dailyBudget} ${d.currency}` },
        ],
      };
    },
    async handler(payload, ctx) {
      if (payload.draft) {
        const campaign = await ctx.api.createCampaign(payload.draft);
        await invalidate(ctx.queryClient, [["campaigns"]]);
        return {
          ok: true,
          toastKey: payload.draft.launchNow ? "toast.campaignLaunched" : "toast.campaignSaved",
          toastValues: { name: campaign.name },
          navigateTo: `/campaigns/${campaign.id}`,
          data: campaign,
        };
      }
      const prefill = payload.prefill ?? (payload.angle ? { name: `${payload.angle} campaign` } : null);
      ctx.ui.setCampaignPrefill(prefill);
      if (prefill && typeof window !== "undefined") {
        try {
          localStorage.setItem("sahm_campaign_wizard_prefill_pending", JSON.stringify(prefill));
        } catch {}
      }
      return { ok: true, navigateTo: "/campaigns/new" };
    },
  }),

  CREATE_CREATIVE: define({
    type: "CREATE_CREATIVE",
    labelKey: "CREATE_CREATIVE",
    icon: "Sparkles",
    payloadSchema: CreateCreativePayload,
    requiresConfirmation: false,
    async handler(payload, ctx) {
      if (payload.brief) {
        const created = await ctx.api.generateCreative({
          kind: payload.kind,
          brief: payload.brief,
          campaignId: payload.campaignId ?? null,
          referenceAnalysisId: payload.referenceAnalysisId,
          aspectRatio: payload.aspectRatio,
          count: payload.count ?? 1,
        });
        await invalidate(ctx.queryClient, [["creatives"]]);
        return { ok: true, toastKey: "toast.creativesGenerated", toastValues: { count: created.length }, navigateTo: "/creatives", data: created };
      }
      ctx.ui.setCreateCreative({ kind: payload.kind, campaignId: payload.campaignId, referenceAnalysisId: payload.referenceAnalysisId });
      return { ok: true, navigateTo: "/creatives" };
    },
  }),

  GENERATE_VARIATIONS: define({
    type: "GENERATE_VARIATIONS",
    labelKey: "GENERATE_VARIATIONS",
    icon: "Layers",
    payloadSchema: GenerateVariationsPayload,
    requiresConfirmation: false,
    async handler(payload, ctx) {
      const created = await ctx.api.generateVariations(payload);
      await invalidate(ctx.queryClient, [["creatives"]]);
      return { ok: true, toastKey: "toast.variationsGenerated", toastValues: { count: created.length }, navigateTo: "/creatives", data: created };
    },
  }),

  ANALYZE_CAMPAIGN: define({
    type: "ANALYZE_CAMPAIGN",
    labelKey: "ANALYZE_CAMPAIGN",
    icon: "BarChart3",
    payloadSchema: AnalyzeCampaignPayload,
    requiresConfirmation: false,
    async handler(payload, ctx) {
      const task = await ctx.api.startTask({ type: "ANALYZE_CAMPAIGN", payload });
      await invalidate(ctx.queryClient, [qk.conversations]);
      return { ok: true, toastKey: "toast.taskStarted", navigateTo: taskDestination(task.resultRef), data: task };
    },
  }),

  ANALYZE_CREATIVE: define({
    type: "ANALYZE_CREATIVE",
    labelKey: "ANALYZE_CREATIVE",
    icon: "ScanSearch",
    payloadSchema: AnalyzeCreativePayload,
    requiresConfirmation: false,
    async handler(payload, ctx) {
      const task = await ctx.api.startTask({ type: "ANALYZE_CREATIVE", payload });
      await invalidate(ctx.queryClient, [qk.conversations]);
      return { ok: true, toastKey: "toast.taskStarted", navigateTo: taskDestination(task.resultRef), data: task };
    },
  }),

  RESEARCH_COMPETITORS: define({
    type: "RESEARCH_COMPETITORS",
    labelKey: "RESEARCH_COMPETITORS",
    icon: "Search",
    payloadSchema: ResearchCompetitorsPayload,
    requiresConfirmation: false,
    async handler(payload, ctx) {
      const task = await ctx.api.startTask({ type: "RESEARCH_COMPETITORS", payload });
      await invalidate(ctx.queryClient, [qk.conversations]);
      return { ok: true, toastKey: "toast.taskStarted", navigateTo: taskDestination(task.resultRef), data: task };
    },
  }),

  OPTIMIZE_CAMPAIGN: define({
    type: "OPTIMIZE_CAMPAIGN",
    labelKey: "OPTIMIZE_CAMPAIGN",
    icon: "Wand2",
    payloadSchema: OptimizeCampaignPayload,
    requiresConfirmation: false,
    async handler(payload, ctx) {
      const task = await ctx.api.startTask({ type: "OPTIMIZE_CAMPAIGN", payload });
      await invalidate(ctx.queryClient, [qk.conversations]);
      return { ok: true, toastKey: "toast.taskStarted", navigateTo: taskDestination(task.resultRef), data: task };
    },
  }),

  CONNECT_META: define({
    type: "CONNECT_META",
    labelKey: "CONNECT_META",
    icon: "Plug",
    payloadSchema: ConnectMetaPayload,
    requiresConfirmation: false,
    async handler(payload, ctx) {
      // Optimistically reflect the "connecting" state so the state machine UI updates immediately.
      ctx.queryClient.setQueryData(qk.meta, (prev: unknown) =>
        prev && typeof prev === "object" ? { ...(prev as object), status: payload.mode === "disconnect" ? "not_connected" : "connecting" } : prev,
      );
      const conn =
        payload.mode === "reauth" ? await ctx.api.reauthMeta() : payload.mode === "disconnect" ? await ctx.api.disconnectMeta() : await ctx.api.connectMeta();
      ctx.queryClient.setQueryData(qk.meta, conn);
      const toastKey =
        conn.status === "connected" ? "toast.metaConnected" : conn.status === "not_connected" ? "toast.metaDisconnected" : conn.status === "needs_reauth" ? "toast.metaNeedsReauth" : "toast.metaError";
      return { ok: conn.status !== "error", toastKey, data: conn };
    },
  }),

  APPLY_RECOMMENDATION: define({
    type: "APPLY_RECOMMENDATION",
    labelKey: "APPLY_RECOMMENDATION",
    icon: "CheckCheck",
    payloadSchema: ApplyRecommendationPayload,
    requiresConfirmation: true,
    async getDiff(payload, ctx) {
      const rec = await ctx.api.getRecommendation(payload.recommendationId);
      return { title: rec.title, description: rec.expectedImpact, diff: rec.changes };
    },
    async handler(payload, ctx) {
      const rec = await ctx.api.applyRecommendation(payload);
      await invalidate(ctx.queryClient, [["campaign", rec.campaignId], ["campaigns"], ["insights"], ["conversation"]]);
      return { ok: true, toastKey: "toast.recommendationApplied", data: rec };
    },
  }),

  ADD_TO_CAMPAIGN: define({
    type: "ADD_TO_CAMPAIGN",
    labelKey: "ADD_TO_CAMPAIGN",
    icon: "FolderPlus",
    payloadSchema: AddToCampaignPayload,
    requiresConfirmation: true,
    async prepare(payload, ctx) {
      if (payload.campaignId) return payload;
      const campaignId = await ctx.pickCampaign(ctx.t("pickCampaignTitle"));
      return campaignId ? { ...payload, campaignId } : null;
    },
    async getDiff(payload, ctx) {
      const [campaign, creative] = await Promise.all([getCampaignCached(ctx, payload.campaignId!), ctx.api.getCreative(payload.creativeId)]);
      return {
        title: ctx.t("addToCampaignTitle", { creative: creative.title, campaign: campaign.name }),
        diff: [
          { field: "creativeIds.length", label: ctx.t("diff.creativeCount"), before: campaign.creativeIds.length, after: campaign.creativeIds.length + 1 },
          { field: "status", label: ctx.t("diff.campaignStatus"), before: campaign.status, after: campaign.status },
        ],
      };
    },
    async handler(payload, ctx) {
      const campaign = await ctx.api.addToCampaign({ campaignId: payload.campaignId!, creativeId: payload.creativeId });
      await invalidate(ctx.queryClient, [["campaign", campaign.id], ["campaigns"], ["creatives"]]);
      return { ok: true, toastKey: "toast.addedToCampaign", toastValues: { name: campaign.name }, data: campaign };
    },
  }),

  /* ---------------- Research tools (agent tasks → conversation) ---------------- */
  ANALYZE_WEBSITE: agentTask("ANALYZE_WEBSITE", "Globe", z.object({ url: z.string().min(3) })),
  ANALYZE_SOCIAL_PROFILE: agentTask("ANALYZE_SOCIAL_PROFILE", "AtSign", z.object({ handle: z.string().min(1), platform: z.enum(["instagram", "tiktok", "facebook"]).default("instagram") })),
  ANALYZE_REVIEWS: agentTask("ANALYZE_REVIEWS", "Star", z.object({ source: z.string().optional() })),
  ANALYZE_MARKET: agentTask("ANALYZE_MARKET", "Globe2", z.object({ query: z.string().optional() })),
  ANALYZE_KEYWORDS: agentTask("ANALYZE_KEYWORDS", "KeyRound", z.object({ seed: z.string().min(1) })),
  ANALYZE_COMPETITOR_CREATIVES: agentTask("ANALYZE_COMPETITOR_CREATIVES", "Images", z.object({ competitor: z.string().optional() })),
  DETECT_MARKET_GAPS: agentTask("DETECT_MARKET_GAPS", "Crosshair", z.object({})),
  GENERATE_MARKETING_STRATEGY: agentTask("GENERATE_MARKETING_STRATEGY", "Compass", z.object({ brief: z.string().optional() })),

  /* ---------------- Generation ---------------- */
  GENERATE_CONTENT_CALENDAR: define({
    type: "GENERATE_CONTENT_CALENDAR",
    labelKey: "GENERATE_CONTENT_CALENDAR",
    icon: "CalendarDays",
    payloadSchema: GenerateContentCalendarInputSchema.partial({ month: true }),
    requiresConfirmation: false,
    async handler(payload, ctx) {
      const month = payload.month ?? new Date().toISOString().slice(0, 7);
      const items = await ctx.api.generateContentCalendar({ ...payload, month });
      await invalidate(ctx.queryClient, [["content"]]);
      return { ok: true, toastKey: "toast.calendarGenerated", toastValues: { count: items.length }, navigateTo: `/calendar?month=${month}`, data: items };
    },
  }),

  GENERATE_TEXT: define({
    type: "GENERATE_TEXT",
    labelKey: "GENERATE_TEXT",
    icon: "FileText",
    payloadSchema: GenerateTextInputSchema,
    requiresConfirmation: false,
    async handler(payload, ctx) {
      const result = await ctx.api.generateText(payload);
      ctx.ui.setGeneratedText(result);
      return { ok: true, data: result };
    },
  }),

  UPDATE_AGENT: define({
    type: "UPDATE_AGENT",
    labelKey: "UPDATE_AGENT",
    icon: "Bot",
    payloadSchema: UpdateAgentInputSchema,
    requiresConfirmation: false,
    async handler(payload, ctx) {
      const agent = await ctx.api.updateAgent(payload);
      await invalidate(ctx.queryClient, [["agents"]]);
      return { ok: true, toastKey: "toast.agentUpdated", toastValues: { name: agent.name }, data: agent };
    },
  }),

  UPDATE_CAMPAIGN: define({
    type: "UPDATE_CAMPAIGN",
    labelKey: "UPDATE_CAMPAIGN",
    icon: "Pencil",
    payloadSchema: UpdateCampaignPayload,
    requiresConfirmation: true,
    async getDiff(payload, ctx) {
      const c = await getCampaignCached(ctx, payload.campaignId);
      const diff: ChangeDiff[] = [];
      if (payload.patch.status !== undefined) diff.push({ field: "status", label: ctx.t("diff.campaignStatus"), before: c.status, after: payload.patch.status });
      if (payload.patch.dailyBudget !== undefined) diff.push({ field: "dailyBudget", label: ctx.t("diff.dailyBudget"), before: c.dailyBudget, after: payload.patch.dailyBudget });
      if (payload.patch.name !== undefined) diff.push({ field: "name", label: ctx.t("diff.name"), before: c.name, after: payload.patch.name });
      return { title: ctx.t("updateCampaignTitle", { name: c.name }), diff };
    },
    async handler(payload, ctx) {
      const c = await ctx.api.updateCampaign({ id: payload.campaignId, patch: payload.patch });
      await invalidate(ctx.queryClient, [["campaign", c.id], ["campaigns"]]);
      return { ok: true, toastKey: "toast.campaignUpdated", toastValues: { name: c.name }, data: c };
    },
  }),

  UPDATE_BRAND_PROFILE: define({
    type: "UPDATE_BRAND_PROFILE",
    labelKey: "UPDATE_BRAND_PROFILE",
    icon: "Building2",
    payloadSchema: z.object({
      tab: z.string().optional(),
      name: z.string().optional(),
    }).passthrough(),
    requiresConfirmation: false,
    async handler(payload, ctx) {
      ctx.navigate("/brand-identity");
      return { ok: true, navigateTo: "/brand-identity" };
    },
  }),

  VIEW_USAGE: define({
    type: "VIEW_USAGE",
    labelKey: "VIEW_USAGE",
    icon: "Gauge",
    payloadSchema: z.object({}).passthrough(),
    requiresConfirmation: false,
    async handler(payload, ctx) {
      ctx.navigate("/settings/usage");
      return { ok: true, navigateTo: "/settings/usage" };
    },
  }),
};

// Compile-time guarantee: every ActionType has a definition.
const _exhaustive: Record<ActionType, unknown> = actionRegistry;
void _exhaustive;

export type ActionRegistry = typeof actionRegistry;
export type ActionPayload<T extends ActionType> = z.infer<ActionRegistry[T]["payloadSchema"]>;

/** Prefer the already-cached campaign for diff previews; fall back to the API. */
async function getCampaignCached(ctx: ActionContext, id: string) {
  const cached = ctx.queryClient.getQueryData<import("@/types").Campaign>(qk.campaign(id));
  return cached ?? ctx.api.getCampaign(id);
}

function taskDestination(ref: { entity: string; id: string } | null): string {
  if (ref?.entity === "conversation") return `/assistant/${ref.id}`;
  return "/assistant";
}

export function getActionDefinition(type: ActionType): ActionDefinition<unknown> {
  return actionRegistry[type] as unknown as ActionDefinition<unknown>;
}
