import { z } from "zod";
import type { MarketingApi } from "./types";
import { ApiError } from "./types";
import {
  AgentTaskSchema,
  AudienceSchema,
  BrandProfileSchema,
  BusinessSchema,
  CampaignSchema,
  CampaignStrategySchema,
  ConversationSchema,
  CreativeSchema,
  InsightSchema,
  LearningSchema,
  MessageSchema,
  MetaConnectionSchema,
  MetricPointSchema,
  RecommendationSchema,
  ReferenceAnalysisSchema,
  SendMessageOutputSchema,
  SettingsSchema,
  ApiErrorSchema,
  AgentSchema,
  ContentItemSchema,
  GeneratedTextSchema,
} from "@/types";
import type {
  GenerateContentCalendarInput,
  GenerateTextInput,
  ListContentInput,
  UpdateAgentInput,
  UpdateContentItemInput,
  AddToCampaignInput,
  AnalyzeReferenceInput,
  ApplyRecommendationInput,
  CampaignDraft,
  GenerateCreativeInput,
  GenerateStrategyInput,
  GenerateVariationsInput,
  ListCampaignsInput,
  ListInsightsInput,
  SendMessageInput,
  SendMessageOutput,
  Settings,
  StartTaskInput,
  UpdateCampaignInput,
} from "@/types";

/**
 * Real backend implementation. Wired but unused until NEXT_PUBLIC_USE_MOCKS=false.
 * Every response is validated against the Zod schema so contract drift fails loudly.
 * Endpoint paths are documented in docs/API_CONTRACT.md.
 */
export class HttpApi implements MarketingApi {
  constructor(private base = process.env.NEXT_PUBLIC_API_BASE ?? "/api") {}

  private async request<T>(schema: z.ZodType<T>, path: string, init?: RequestInit & { query?: Record<string, unknown> }) {
    const url = new URL(`${this.base}${path}`, typeof window === "undefined" ? "http://localhost" : window.location.origin);
    Object.entries(init?.query ?? {}).forEach(([k, v]) => v !== undefined && url.searchParams.set(k, String(v)));
    const res = await fetch(url.toString(), {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      credentials: "include",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const parsed = ApiErrorSchema.safeParse(body);
      throw new ApiError(
        parsed.success ? parsed.data.code : "HTTP_ERROR",
        parsed.success ? parsed.data.message : res.statusText,
        res.status,
        parsed.success ? parsed.data.details : undefined,
      );
    }
    const json = await res.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new ApiError("SCHEMA_MISMATCH", `Response for ${path} does not match contract`, res.status, {
        issues: parsed.error.issues,
      });
    }
    return parsed.data;
  }
  private get<T>(schema: z.ZodType<T>, path: string, query?: Record<string, unknown>) {
    return this.request(schema, path, { method: "GET", query });
  }
  private post<T>(schema: z.ZodType<T>, path: string, body?: unknown) {
    return this.request(schema, path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
  }
  private patch<T>(schema: z.ZodType<T>, path: string, body?: unknown) {
    return this.request(schema, path, { method: "PATCH", body: JSON.stringify(body) });
  }

  getBusiness = () => this.get(BusinessSchema, "/business");
  getBrandProfile = () => this.get(BrandProfileSchema, "/brand-profile");

  listCampaigns = (input?: ListCampaignsInput) => this.get(z.array(CampaignSchema), "/campaigns", input);
  getCampaign = (id: string) => this.get(CampaignSchema, `/campaigns/${id}`);
  createCampaign = (draft: CampaignDraft) => this.post(CampaignSchema, "/campaigns", draft);
  updateCampaign = (input: UpdateCampaignInput) => this.patch(CampaignSchema, `/campaigns/${input.id}`, input.patch);
  generateStrategy = (input: GenerateStrategyInput) => this.post(CampaignStrategySchema, "/campaigns/strategy", input);
  getCampaignPerformance = (id: string) => this.get(z.array(MetricPointSchema), `/campaigns/${id}/performance`);
  getCampaignRecommendations = (id: string) =>
    this.get(z.array(RecommendationSchema), `/campaigns/${id}/recommendations`);
  getAudience = (id: string) => this.get(AudienceSchema, `/audiences/${id}`);
  getCampaignLearnings = (id: string) => this.get(z.array(LearningSchema), `/campaigns/${id}/learnings`);

  listCreatives = (campaignId?: string) => this.get(z.array(CreativeSchema), "/creatives", { campaignId });
  getCreative = (id: string) => this.get(CreativeSchema, `/creatives/${id}`);
  generateCreative = (input: GenerateCreativeInput) => this.post(z.array(CreativeSchema), "/creatives/generate", input);
  generateVariations = (input: GenerateVariationsInput) =>
    this.post(z.array(CreativeSchema), `/creatives/${input.creativeId}/variations`, input);
  analyzeReference = (input: AnalyzeReferenceInput) => this.post(ReferenceAnalysisSchema, "/creatives/analyze-reference", input);
  addToCampaign = (input: AddToCampaignInput) =>
    this.post(CampaignSchema, `/campaigns/${input.campaignId}/creatives`, { creativeId: input.creativeId });

  getInsights = (input?: ListInsightsInput) => this.get(z.array(InsightSchema), "/insights", input);
  getRecommendation = (id: string) => this.get(RecommendationSchema, `/recommendations/${id}`);
  applyRecommendation = (input: ApplyRecommendationInput) =>
    this.post(RecommendationSchema, `/recommendations/${input.recommendationId}/apply`);
  dismissRecommendation = (input: ApplyRecommendationInput) =>
    this.post(RecommendationSchema, `/recommendations/${input.recommendationId}/dismiss`);

  listConversations = () => this.get(z.array(ConversationSchema), "/conversations");
  getConversation = (id: string) =>
    this.get(z.object({ conversation: ConversationSchema, messages: z.array(MessageSchema) }), `/conversations/${id}`);
  sendMessage = (input: SendMessageInput) => this.post(SendMessageOutputSchema, "/conversations/messages", input);

  /** SSE stream: each `data:` line is a full SendMessageOutput snapshot. */
  async *streamMessage(input: SendMessageInput): AsyncIterable<SendMessageOutput> {
    const res = await fetch(`${this.base}/conversations/messages/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      credentials: "include",
      body: JSON.stringify(input),
    });
    if (!res.ok || !res.body) throw new ApiError("HTTP_ERROR", res.statusText, res.status);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const ev of events) {
        const line = ev.split("\n").find((l) => l.startsWith("data:"));
        if (!line) continue;
        const parsed = SendMessageOutputSchema.safeParse(JSON.parse(line.slice(5).trim()));
        if (parsed.success) yield parsed.data;
      }
    }
  }

  startTask = (input: StartTaskInput) => this.post(AgentTaskSchema, "/tasks", input);
  getTask = (id: string) => this.get(AgentTaskSchema, `/tasks/${id}`);

  getMetaConnection = () => this.get(MetaConnectionSchema, "/integrations/meta");
  connectMeta = () => this.post(MetaConnectionSchema, "/integrations/meta/connect");
  reauthMeta = () => this.post(MetaConnectionSchema, "/integrations/meta/reauth");
  disconnectMeta = () => this.post(MetaConnectionSchema, "/integrations/meta/disconnect");

  listContentItems = (input: ListContentInput) => this.get(z.array(ContentItemSchema), "/content", input);
  generateContentCalendar = (input: GenerateContentCalendarInput) => this.post(z.array(ContentItemSchema), "/content/generate", input);
  updateContentItem = (input: UpdateContentItemInput) => this.patch(ContentItemSchema, `/content/${input.id}`, input.patch);
  deleteContentItem = (id: string) => this.request(z.object({ id: z.string() }), `/content/${id}`, { method: "DELETE" });

  generateText = (input: GenerateTextInput) => this.post(GeneratedTextSchema, "/generate/text", input);

  listAgents = () => this.get(z.array(AgentSchema), "/agents");
  updateAgent = (input: UpdateAgentInput) => this.patch(AgentSchema, `/agents/${input.id}`, input.patch);

  getSettings = () => this.get(SettingsSchema, "/settings");
  updateSettings = (patch: Partial<Settings>) => this.patch(SettingsSchema, "/settings", patch);
}
