import { z } from "zod";
import type { MarketingApi } from "./types";
import { ApiError } from "./types";
import {
  ACTION_TASK_MAP,
  asArray,
  defaultSettings,
  isRecord,
  mapAgentTask,
  mapAuditList,
  mapAuthSession,
  mapBrandProfile,
  mapBusiness,
  mapBusinessProfileForm,
  mapCampaign,
  mapConnector,
  mapConnectorDeleteResult,
  mapConnectorSettings,
  mapContentItem,
  mapConversationDetail,
  mapConversationSummary,
  mapCreative,
  mapInsight,
  mapMemoryItem,
  mapMemoryItemList,
  mapMessage,
  mapMetaStatus,
  mapPersona,
  mapRecommendation,
  mapReferenceAnalysis,
  mapSessionInfo,
  mapUsage,
  normalizeErrorBody,
  str,
  toBusinessProfilePatch,
  toCampaignCreateBody,
  type Json,
} from "./adapters";
import {
  AgentSchema,
  AgentTaskSchema,
  AuditListSchema,
  AuthSessionSchema,
  BrandProfileSchema,
  BusinessProfileFormSchema,
  BusinessSchema,
  CampaignSchema,
  ConnectorDeleteResultSchema,
  ConnectorSchema,
  ConnectorSettingsSchema,
  ContentItemSchema,
  ConversationSchema,
  CreativeSchema,
  InsightSchema,
  LlmSettingsSchema,
  MemoryItemListSchema,
  MemoryItemSchema,
  MemoryReindexResultSchema,
  MessageSchema,
  MetaConnectionSchema,
  RecommendationSchema,
  ReferenceAnalysisSchema,
  SessionInfoSchema,
  SettingsSchema,
  UsageSchema,
} from "@/types";
import type {
  AnalyzeReferenceInput,
  ApplyRecommendationInput,
  AssistantProgressEvent,
  AuditFilters,
  AuthSession,
  BusinessProfileUpdateInput,
  CampaignDraft,
  ConnectorSettings,
  ConnectorUpdateInput,
  CreateMemoryItemInput,
  GenerateContentCalendarInput,
  GenerateCreativeInput,
  ListCampaignsInput,
  ListContentInput,
  ListInsightsInput,
  ListMemoryItemsInput,
  LoginInput,
  LlmSettings,
  LlmSettingsUpdateInput,
  LogoutResult,
  RegisterInput,
  SendMessageInput,
  SendMessageOutput,
  SessionInfo,
  Settings,
  StartTaskInput,
  UpdateAgentInput,
  UpdateContentItemInput,
  UpdateMemoryItemInput,
  Usage,
  UsagePeriod,
} from "@/types";
import {
  endSession,
  getAccessToken,
  getActiveWorkspaceId,
  useAuthStore,
} from "@/store/auth-store";

const DEFAULT_TIMEOUT_MS = 30_000;
const ASSISTANT_TIMEOUT_MS = 210_000;

/** Supabase access tokens are JWTs; legacy backend sessions are opaque strings. */
function isSupabaseJwt(token: string | null): boolean {
  return Boolean(token && token.split(".").length === 3);
}

/** Routes that must never trigger the refresh dance — they *are* the auth dance. */
const AUTH_ROUTES = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout"];

function timeoutSignal(ms: number): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }
  return undefined;
}

function unsupported(feature: string, hint: string): ApiError {
  return new ApiError("NOT_IMPLEMENTED", `"${feature}" is not available on this backend yet. ${hint}`, 501);
}

type RawInit = RequestInit & { query?: Record<string, unknown>; timeoutMs?: number };

/**
 * Real backend client.
 *
 * The FastAPI service is much narrower than this UI, so every method below does
 * three things: call the real endpoint, reshape the payload through
 * `./adapters`, then validate against the existing Zod schema so contract drift
 * still fails loudly instead of rendering garbage.
 */
export class HttpApi implements MarketingApi {
  constructor(private base = process.env.NEXT_PUBLIC_API_BASE ?? "/api") {}

  /** Request id echoed by the backend on the last response; correlated on the next request. */
  private lastRequestId: string | null = null;

  /** Single in-flight refresh, so N parallel 401s cause exactly one `/auth/refresh`. */
  private refreshInFlight: Promise<AuthSession | null> | null = null;

  /* --------------------------------------------------- centralised request headers */

  /**
   * Every header this client ever sends is built here — there is no second place
   * that attaches credentials. `Authorization` comes from the auth store and
   * `X-Workspace-Id` from the workspace the portfolio switcher selected, so a
   * workspace switch is a store change and nothing else.
   */
  private buildHeaders(init: RawInit): Record<string, string> {
    if (useAuthStore.getState().status === "unknown") {
      useAuthStore.getState().hydrate();
    }
    const hasBody = init.body !== undefined && init.body !== null;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (hasBody) headers["Content-Type"] = "application/json";

    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const workspaceId = getActiveWorkspaceId();
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;

    if (this.lastRequestId) headers["X-Request-Id"] = this.lastRequestId;

    // Explicit per-call headers win, but a caller cannot silently drop the token
    // by passing `Authorization: undefined` — `delete` is the only escape hatch
    // and auth routes do not use it.
    const overrides = init.headers as Record<string, string> | undefined;
    for (const [k, v] of Object.entries(overrides ?? {})) {
      if (v === undefined) delete headers[k];
      else headers[k] = v;
    }
    return headers;
  }

  private buildUrl(path: string, query?: Record<string, unknown>): string {
    const origin = typeof window === "undefined" ? "http://localhost" : window.location.origin;
    const url = new URL(`${this.base}${path}`, origin);
    Object.entries(query ?? {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    });
    return url.toString();
  }

  /* --------------------------------------------------- 401 / refresh / 429 policy */

  /**
   * One silent refresh, shared by every concurrent 401. Returns the new session
   * or `null` when the session is unrecoverable — in which case the caller is
   * dropped to `/login`. It never recurses: `/auth/refresh` goes through
   * `perform` with `allowRefresh: false`.
   */
  private silentRefresh(): Promise<AuthSession | null> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.runRefresh().finally(() => {
        this.refreshInFlight = null;
      });
    }
    return this.refreshInFlight;
  }

  private async runRefresh(): Promise<AuthSession | null> {
    const token = getAccessToken();
    if (!token) return null;
    try {
      const res = await this.perform("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      const parsed = this.parse(AuthSessionSchema, mapAuthSession(res), "/auth/refresh");
      useAuthStore.getState().applySession(parsed);
      return parsed;
    } catch {
      // Refresh failed: the token is expired, revoked or the account is gone.
      // Clearing here (rather than at each call site) is what makes the failure
      // uniform — the user lands on /login from wherever they were.
      return null;
    }
  }

  private handleSessionLost(): void {
    endSession();
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.assign(`/login?next=${next}`);
    }
  }

  /** Single fetch, no retry, no refresh. Response only — the caller unwraps it. */
  private async perform(path: string, init: RawInit): Promise<Response> {
    const { query, timeoutMs, ...requestInit } = init;
    const url = this.buildUrl(path, query);
    let res: Response;
    try {
      res = await fetch(url, {
        ...requestInit,
        headers: this.buildHeaders(init),
        signal: init.signal ?? timeoutSignal(timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });
    } catch (error) {
      throw new ApiError(
        "network_error",
        `Could not reach the backend at ${url}. Check that it is running and that the browser can access it.`,
        0,
        { cause: error instanceof Error ? error.message : String(error) },
      );
    }
    const requestId = res.headers.get("x-request-id");
    if (requestId) this.lastRequestId = requestId;
    return res;
  }

  /** Turn a non-OK response into an `ApiError`, honouring `Retry-After` on a 429. */
  private async toError(res: Response): Promise<ApiError> {
    const body = await res.json().catch(() => null);
    const { code, message, details } = normalizeErrorBody(body);
    if (res.status === 429) {
      // A 429 is a *schedule*, not a failure: the client must be able to tell the
      // user when to come back, so `Retry-After` is carried as structured detail
      // rather than dropped into a generic message.
      const raw = res.headers.get("retry-after");
      const seconds = raw !== null ? Number.parseInt(raw, 10) : NaN;
      const retryAfterSeconds = Number.isFinite(seconds) ? seconds : undefined;
      const hint = isRecord(details) && typeof details.retry_after_seconds === "number" ? details.retry_after_seconds : undefined;
      const wait = retryAfterSeconds ?? hint;
      return new ApiError(
        "rate_limited",
        wait !== undefined ? `Too many requests. Try again in ${wait}s.` : "Too many requests.",
        429,
        { ...(details ?? {}), retryAfter: wait, retryAfterSeconds: wait },
      );
    }
    if (res.status === 401) {
      // Surface the backend's own generic message verbatim on the login screen.
      return new ApiError(code || "unauthorized", message || "Unauthorized", 401, details);
    }
    return new ApiError(code, message, res.status, details);
  }

  /** Raw JSON with normalised errors. No schema validation here on purpose. */
  private async raw<T = Json>(path: string, init?: RawInit): Promise<T> {
    const opts: RawInit = init ?? {};
    const allowRefresh = !AUTH_ROUTES.includes(path);
    let res = await this.perform(path, opts);

    // Supabase owns JWT refresh. Sending one to the legacy `/auth/refresh`
    // endpoint can never work and used to clear the valid Supabase session,
    // causing a relogin loop and a burst of duplicate auth/API requests.
    const supabaseJwt = isSupabaseJwt(getAccessToken());
    if (res.status === 401 && allowRefresh && !supabaseJwt) {
      const session = await this.silentRefresh();
      if (session) {
        // Exactly one retry, with the freshly rotated token attached. A second
        // 401 falls through to `toError` — there is no second refresh, so this
        // cannot loop.
        res = await this.perform(path, opts);
      } else {
        this.handleSessionLost();
      }
    }

    if (!res.ok) throw await this.toError(res);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  /** Validate after mapping. Keeps SCHEMA_MISMATCH reporting intact. */
  private parse<T>(schema: z.ZodType<T>, value: unknown, path: string): T {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      throw new ApiError("SCHEMA_MISMATCH", `Response for ${path} does not match contract`, 200, {
        issues: parsed.error.issues,
      });
    }
    return parsed.data;
  }

  private get<T = Json>(path: string, query?: Record<string, unknown>) {
    return this.raw<T>(path, { method: "GET", query });
  }

  private post<T = Json>(path: string, body?: unknown, query?: Record<string, unknown>) {
    return this.raw<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body), query });
  }

  private patch<T = Json>(path: string, body?: unknown) {
    return this.raw<T>(path, { method: "PATCH", body: JSON.stringify(body) });
  }

  private delete<T = Json>(path: string) {
    return this.raw<T>(path, { method: "DELETE" });
  }

  /* ------------------------------------------------------------------- auth */

  async register(input: RegisterInput): Promise<AuthSession> {
    const raw = await this.post("/auth/register", {
      email: input.email,
      password: input.password,
      fullName: input.fullName,
      workspaceName: input.workspaceName,
    });
    const session = this.parse(AuthSessionSchema, mapAuthSession(raw), "/auth/register");
    useAuthStore.getState().applySession(session);
    return session;
  }

  async login(input: LoginInput): Promise<AuthSession> {
    const raw = await this.post("/auth/login", { email: input.email, password: input.password });
    const session = this.parse(AuthSessionSchema, mapAuthSession(raw), "/auth/login");
    useAuthStore.getState().applySession(session);
    return session;
  }

  /**
   * Explicit refresh (the store's "retry" path). The silent one lives in
   * `raw()`; this exists so a screen can proactively extend a session and so
   * `MockApi` can be exercised on the same contract.
   */
  async refreshSession(): Promise<AuthSession> {
    const session = await this.silentRefresh();
    if (!session) {
      this.handleSessionLost();
      throw new ApiError("unauthorized", "Your session has expired. Please sign in again.", 401);
    }
    return session;
  }

  async logout(): Promise<LogoutResult> {
    try {
      const raw = await this.post("/auth/logout", {});
      return { revoked: raw.revoked === true };
    } finally {
      // Local state is cleared whether or not the server accepted it: a logout
      // that leaves the UI authenticated is worse than a 500.
      endSession();
    }
  }

  async getSession(): Promise<SessionInfo> {
    const raw = await this.get("/auth/me");
    const info = this.parse(SessionInfoSchema, mapSessionInfo(raw), "/auth/me");
    useAuthStore.getState().applySessionInfo(info);
    return info;
  }

  /* ---------------------------------------------------------------- business */

  private async businessProfile() {
    return (await this.get("/business/profile")).business as Json;
  }

  async getBusiness() {
    return this.parse(BusinessSchema, mapBusiness(await this.businessProfile()), "/business/profile");
  }

  async getBrandProfile() {
    return this.parse(BrandProfileSchema, mapBrandProfile(await this.businessProfile()), "/business/profile");
  }

  async getBusinessProfileForm() {
    const payload = await this.get("/business/profile");
    return this.parse(
      BusinessProfileFormSchema,
      mapBusinessProfileForm((payload.business as Json) ?? {}),
      "/business/profile",
    );
  }

  /**
   * `PATCH /business/profile` is exclude-unset: only the keys the form actually
   * touched are sent. `toBusinessProfilePatch` strips `undefined` so an untouched
   * field is genuinely absent from the JSON rather than sent as `null` — which
   * would silently wipe it server-side.
   */
  async updateBusinessProfile(input: BusinessProfileUpdateInput) {
    const payload = await this.patch("/business/profile", toBusinessProfilePatch(input as Json));
    return this.parse(
      BusinessProfileFormSchema,
      mapBusinessProfileForm((payload.business as Json) ?? {}),
      "/business/profile",
    );
  }

  /* ---------------------------------------------------------------- campaigns */

  async listCampaigns(input?: ListCampaignsInput) {
    const payload = await this.get("/campaigns");
    let campaigns = asArray(payload.campaigns).map((c) => mapCampaign(c));
    // The backend has no filtering, so do it here.
    if (input?.status) campaigns = campaigns.filter((c) => c.status === input.status);
    if (input?.search) {
      const q = input.search.toLowerCase();
      campaigns = campaigns.filter((c) => c.name.toLowerCase().includes(q));
    }
    return this.parse(z.array(CampaignSchema), campaigns, "/campaigns");
  }

  async getCampaign(id: string) {
    const payload = await this.get(`/campaigns/${id}`);
    return this.parse(CampaignSchema, mapCampaign(payload.campaign, payload), `/campaigns/${id}`);
  }

  async createCampaign(draft: CampaignDraft) {
    const created = await this.post("/campaigns", toCampaignCreateBody(draft));
    return this.parse(CampaignSchema, mapCampaign(created), "/campaigns");
  }

  async updateCampaign(): Promise<never> {
    throw unsupported("Campaign updates", "The backend has no PATCH /campaigns/{id} endpoint yet.");
  }

  async generateStrategy(): Promise<never> {
    throw unsupported("Campaign strategy generation", "Use the assistant: it routes to Omar's campaign_strategy task.");
  }

  async getCampaignPerformance(): Promise<never> {
    throw unsupported("Campaign performance", "Connect Meta, then read the Insights screen.");
  }

  async getCampaignRecommendations(id: string) {
    const payload = await this.get(`/campaigns/${id}`);
    const recs = asArray(payload.recommendations).map((r) => mapRecommendation(r));
    return this.parse(z.array(RecommendationSchema), recs, `/campaigns/${id}`);
  }

  async getCampaignLearnings(): Promise<never> {
    throw unsupported("Campaign learnings", "Learnings are surfaced inside assistant answers.");
  }

  async getAudience(): Promise<never> {
    throw unsupported("Audience detail", "Campaign audiences are stored as free text in the backend.");
  }

  /* ---------------------------------------------------------------- creatives */

  async listCreatives(campaignId?: string) {
    const list = asArray(await this.get("/creatives"))
      .map((c) => mapCreative(c))
      .filter((c) => (campaignId ? c.campaignId === campaignId : true));
    return this.parse(z.array(CreativeSchema), list, "/creatives");
  }

  async getCreative(): Promise<never> {
    throw unsupported("Creative detail", "The backend only exposes the creative list.");
  }

  async generateCreative(input: GenerateCreativeInput) {
    const payload = await this.post("/creatives/generate", {
      prompt: input.brief,
      aspectRatio: input.aspectRatio ?? "1:1",
      campaignId: input.campaignId,
      numImages: Math.min(4, Math.max(1, input.count)),
      referenceAnalysisId: input.referenceAnalysisId,
    });
    const assets = asArray(payload.assets).map((a) => mapCreative(a));
    return this.parse(z.array(CreativeSchema), assets, "/creatives/generate");
  }

  async generateVariations(): Promise<never> {
    throw unsupported("Creative variations", "Use the assistant: it routes to Layla's ad_variations task.");
  }

  async analyzeReference(input: AnalyzeReferenceInput) {
    const payload = await this.post("/creatives/analyze-reference", {
      imageUrl: input.source,
      kind: input.kind,
    });
    return this.parse(ReferenceAnalysisSchema, mapReferenceAnalysis(payload), "/creatives/analyze-reference");
  }

  async addToCampaign(): Promise<never> {
    throw unsupported("Attaching a creative to a campaign", "Generate the creative with a campaignId instead.");
  }

  /* ----------------------------------------------------------------- insights */

  async getInsights(input?: ListInsightsInput) {
    let campaignIds: string[];
    if (input?.campaignId) {
      campaignIds = [input.campaignId];
    } else {
      const payload = await this.get("/campaigns");
      campaignIds = asArray(payload.campaigns)
        .map((c) => str(c.id))
        .filter(Boolean);
    }

    const collected: Json[] = [];
    for (const id of campaignIds) {
      try {
        const payload = await this.get(`/campaigns/${id}/insights`);
        collected.push(...asArray(payload.insights));
      } catch {
        // A campaign with no stored insights must not break the whole screen.
      }
    }
    let insights = collected.map((i) => mapInsight(i));
    if (input?.severity) insights = insights.filter((i) => i.severity === input.severity);
    return this.parse(z.array(InsightSchema), insights, "/campaigns/{id}/insights");
  }

  /* ---------------------------------------------------------- recommendations */

  async getRecommendation(id: string) {
    const raw = await this.get(`/recommendations/${id}`);
    return this.parse(RecommendationSchema, mapRecommendation(raw), `/recommendations/${id}`);
  }

  /** Two-phase: record the diff, then execute with an explicit confirmation. */
  async applyRecommendation(input: ApplyRecommendationInput) {
    const preview = await this.post(`/recommendations/${input.recommendationId}/approve`, { confirm: false });
    const approved = preview.requiresConfirmation
      ? await this.post(`/recommendations/${input.recommendationId}/approve`, { confirm: true })
      : preview;
    return this.parse(
      RecommendationSchema,
      mapRecommendation(approved.recommendation),
      `/recommendations/${input.recommendationId}/approve`,
    );
  }

  async dismissRecommendation(input: ApplyRecommendationInput) {
    const raw = await this.post(`/recommendations/${input.recommendationId}/reject`, {});
    return this.parse(RecommendationSchema, mapRecommendation(raw), `/recommendations/${input.recommendationId}/reject`);
  }

  /* ---------------------------------------------------------- conversations */

  async listConversations() {
    const list = asArray(await this.get("/assistant/conversations")).map((c) => mapConversationSummary(c));
    return this.parse(z.array(ConversationSchema), list, "/assistant/conversations");
  }

  async getConversation(id: string) {
    const detail = await this.get(`/assistant/conversations/${id}`);
    const mapped = mapConversationDetail(detail);
    const messages = this.parse(z.array(MessageSchema), mapped.messages, `/assistant/conversations/${id}`);
    const conversation = this.parse(ConversationSchema, mapped.conversation, `/assistant/conversations/${id}`);
    return { conversation, messages };
  }

  async sendMessage(input: SendMessageInput): Promise<SendMessageOutput> {
    const payload = await this.raw("/assistant/message", {
      method: "POST",
      body: JSON.stringify(this.assistantPayload(input)),
      timeoutMs: ASSISTANT_TIMEOUT_MS,
    });
    return this.mapAssistantResponse(input, payload, "/assistant/message");
  }

  private assistantPayload(input: SendMessageInput) {
    const chip = input.context[0];
    return {
      conversationId: input.conversationId ?? undefined,
      message: input.text,
      context: chip
        ? {
            campaignId: chip.kind === "campaign" ? chip.id : undefined,
            creativeId: chip.kind === "creative" ? chip.id : undefined,
            insightId: chip.kind === "insight" ? chip.id : undefined,
            competitorId: chip.kind === "competitor" ? chip.id : undefined,
            competitorName: chip.kind === "competitor" ? chip.label : undefined,
          }
        : undefined,
    };
  }

  private mapAssistantResponse(input: SendMessageInput, payload: Json, path: string): SendMessageOutput {
    const conversationId = str(payload.conversationId, input.conversationId ?? "new");
    const userMessage = this.parse(
      MessageSchema,
      {
        id: `u_${Date.now()}`,
        conversationId,
        role: "user",
        blocks: [{ type: "text", text: input.text }],
        context: input.context,
        createdAt: new Date().toISOString(),
      },
      path,
    );
    const assistantMessage = this.parse(
      MessageSchema,
      mapMessage(payload.message, conversationId),
      path,
    );
    const conversation = this.parse(
      ConversationSchema,
      {
        id: conversationId,
        title: input.text.slice(0, 80),
        lastMessagePreview: input.text.slice(0, 120),
        messageCount: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      path,
    );
    return { conversation, userMessage, assistantMessage };
  }

  /** Stream orchestrator progress, then yield the normal final assistant response. */
  async *streamMessage(
    input: SendMessageInput,
    onProgress?: (event: AssistantProgressEvent) => void,
    signal?: AbortSignal,
  ): AsyncIterable<SendMessageOutput> {
    const timeout = timeoutSignal(ASSISTANT_TIMEOUT_MS);
    const requestSignal = signal && timeout && typeof AbortSignal.any === "function"
      ? AbortSignal.any([signal, timeout])
      : signal ?? timeout;
    const init: RawInit = {
      method: "POST",
      body: JSON.stringify(this.assistantPayload(input)),
      headers: { Accept: "text/event-stream" },
      signal: requestSignal,
      timeoutMs: ASSISTANT_TIMEOUT_MS,
    };
    let response = await this.perform("/assistant/message/stream", init);
    if (response.status === 401 && !isSupabaseJwt(getAccessToken())) {
      const session = await this.silentRefresh();
      if (session) response = await this.perform("/assistant/message/stream", init);
      else this.handleSessionLost();
    }
    if (!response.ok) throw await this.toError(response);
    if (!response.body) throw new ApiError("EMPTY_STREAM", "The backend did not open a progress stream.");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const finalPayload: { value: Json | null } = { value: null };
    const consumeFrame = (frame: string) => {
      let eventName = "message";
      const dataLines: string[] = [];
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
      }
      if (!dataLines.length) return;
      let data: Json;
      try { data = JSON.parse(dataLines.join("\n")) as Json; }
      catch { return; }
      if (eventName === "progress") onProgress?.(data as AssistantProgressEvent);
      else if (eventName === "complete") finalPayload.value = data;
      else if (eventName === "error") {
        throw new ApiError("ASSISTANT_STREAM_FAILED", str(data.message, "The assistant could not complete this request."));
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        consumeFrame(frame);
        boundary = buffer.indexOf("\n\n");
      }
      if (done) break;
    }
    if (finalPayload.value === null) throw new ApiError("EMPTY_STREAM", "The assistant stream ended without a final reply.");
    yield this.mapAssistantResponse(input, finalPayload.value, "/assistant/message/stream");
  }

  /* ------------------------------------------------------------------- tasks */

  /** The backend takes `(persona_id, task)` as query params, not a JSON body. */
  async startTask(input: StartTaskInput) {
    const target = ACTION_TASK_MAP[input.type] ?? ACTION_TASK_MAP.ANALYZE_CAMPAIGN;
    const raw = await this.post("/tasks", undefined, { persona_id: target.personaId, task: target.task });
    return this.parse(AgentTaskSchema, mapAgentTask(raw, input.type), "/tasks");
  }

  async getTask(id: string) {
    const raw = await this.get(`/tasks/${id}`);
    return this.parse(AgentTaskSchema, mapAgentTask(raw), `/tasks/${id}`);
  }

  /* ------------------------------------------------------------ integrations */

  async getMetaConnection() {
    const raw = await this.get("/integrations/meta/status");
    return this.parse(MetaConnectionSchema, mapMetaStatus(raw), "/integrations/meta/status");
  }

  async connectMeta(): Promise<never> {
    throw new ApiError(
      "MISSING_CREDENTIALS",
      "Meta connection needs a Meta access token. POST /integrations/meta/connect requires { accessToken } and this screen does not collect one yet.",
      400,
    );
  }

  async reauthMeta(): Promise<never> {
    throw unsupported("Meta re-auth", "Disconnect and connect again instead.");
  }

  async disconnectMeta() {
    await this.post("/integrations/meta/disconnect", {});
    return this.getMetaConnection();
  }

  /* ---------------------------------------------------- content calendar */

  async listContentItems(input?: ListContentInput) {
    const list = asArray(await this.get("/content", input as Record<string, unknown> | undefined)).map((item) =>
      mapContentItem(item),
    );
    return this.parse(z.array(ContentItemSchema), list, "/content");
  }

  async generateContentCalendar(input: GenerateContentCalendarInput) {
    const list = asArray(await this.post("/content/generate", input)).map((item) => mapContentItem(item));
    return this.parse(z.array(ContentItemSchema), list, "/content/generate");
  }

  async updateContentItem(input: UpdateContentItemInput) {
    const raw = await this.patch(`/content/${input.id}`, input.patch);
    return this.parse(ContentItemSchema, mapContentItem(raw), `/content/${input.id}`);
  }

  async deleteContentItem(id: string) {
    await this.delete(`/content/${id}`);
    return { id };
  }

  async generateText(): Promise<never> {
    throw unsupported("Write with AI", "Ask the assistant for ad copy, scripts or image prompts.");
  }

  /* ---------------------------------------------------------------- personas */

  async listAgents() {
    const list = asArray(await this.get("/personas")).map((p) => mapPersona(p));
    return this.parse(z.array(AgentSchema), list, "/personas");
  }

  async updateAgent(input: UpdateAgentInput) {
    // Only name/tone/autonomy/language are editable server-side.
    const body: Json = {};
    if (input.patch.name !== undefined) body.name = input.patch.name;
    if (input.patch.autonomy !== undefined) body.autonomy = input.patch.autonomy;
    if (input.patch.persona?.tone !== undefined) body.tone = input.patch.persona.tone;
    if (input.patch.persona?.language !== undefined) body.language = input.patch.persona.language;
    const raw = await this.patch(`/personas/${input.id}`, body);
    return this.parse(AgentSchema, mapPersona(raw), `/personas/${input.id}`);
  }

  /* --------------------------------------------------------------- settings */

  async getSettings(): Promise<Settings> {
    return this.parse(SettingsSchema, defaultSettings(), "settings");
  }

  async updateSettings(patch: Partial<Settings>): Promise<Settings> {
    return this.parse(SettingsSchema, { ...defaultSettings(), ...patch }, "settings");
  }

  /* ------------------------------------------------------------- connectors */

  async getConnectorSettings(): Promise<ConnectorSettings> {
    const raw = await this.get("/settings/connectors");
    return this.parse(ConnectorSettingsSchema, mapConnectorSettings(raw), "/settings/connectors");
  }

  /** Only keys present in `patch` are sent — omitted means "leave the stored value". */
  async updateConnector(connector: string, patch: ConnectorUpdateInput) {
    const body: Json = {};
    for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
      if (v === undefined) continue;
      // `null` and `""` both mean "clear"; the backend accepts either.
      body[k] = v === "" ? null : v;
    }
    const raw = await this.patch(`/settings/connectors/${connector}`, body);
    return this.parse(ConnectorSchema, mapConnector(raw), `/settings/connectors/${connector}`);
  }

  async deleteConnector(connector: string) {
    const raw = await this.delete(`/settings/connectors/${connector}`);
    return this.parse(
      ConnectorDeleteResultSchema,
      mapConnectorDeleteResult(raw),
      `/settings/connectors/${connector}`,
    );
  }

  async getLlmSettings(): Promise<LlmSettings> {
    const raw = await this.get("/settings/llm");
    return this.parse(LlmSettingsSchema, raw, "/settings/llm");
  }

  async updateLlmSettings(input: LlmSettingsUpdateInput): Promise<LlmSettings> {
    const raw = await this.patch("/settings/llm", input);
    return this.parse(LlmSettingsSchema, raw, "/settings/llm");
  }

  /* ------------------------------------------------------------ brand memory */

  async listMemoryItems(input?: ListMemoryItemsInput) {
    const raw = await this.get("/memory/items", {
      kind: input?.kind,
      q: input?.q,
      limit: input?.limit,
    });
    return this.parse(MemoryItemListSchema, mapMemoryItemList(raw), "/memory/items");
  }

  async createMemoryItem(input: CreateMemoryItemInput) {
    const raw = await this.post("/memory/items", {
      kind: input.kind,
      text: input.text,
      metadata: input.metadata,
      campaignId: input.campaignId,
    });
    return this.parse(MemoryItemSchema, mapMemoryItem(raw), "/memory/items");
  }

  async updateMemoryItem(input: UpdateMemoryItemInput) {
    const body: Json = {};
    if (input.text !== undefined) body.text = input.text;
    if (input.metadata !== undefined) body.metadata = input.metadata;
    const raw = await this.patch(`/memory/items/${input.id}`, body);
    return this.parse(MemoryItemSchema, mapMemoryItem(raw), `/memory/items/${input.id}`);
  }

  async deleteMemoryItem(id: string): Promise<{ id: string }> {
    await this.delete(`/memory/items/${id}`);
    return { id };
  }

  async reindexMemory(kind?: string) {
    const raw = await this.post("/memory/reindex", { kind: kind ?? null });
    return this.parse(MemoryReindexResultSchema, raw as never, "/memory/reindex");
  }

  /* ---------------------------------------------------------- usage & audit */

  async getUsage(period: UsagePeriod = "today"): Promise<Usage> {
    const raw = await this.get("/usage", { period });
    return this.parse(UsageSchema, mapUsage(raw), "/usage");
  }

  async getAudit(filters?: AuditFilters) {
    const raw = await this.get("/audit", {
      entity_type: filters?.entityType,
      entity_id: filters?.entityId,
      actor: filters?.actor,
      action: filters?.action,
      limit: filters?.limit,
    });
    return this.parse(AuditListSchema, mapAuditList(raw), "/audit");
  }
}
