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
  mapCreativeReference,
  mapInsight,
  mapMemoryItem,
  mapMemoryItemList,
  mapMessage,
  mapMetaAccountCampaignPage,
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
  AudienceSchema,
  SavedAudienceSchema,
  SavedAudienceListSchema,
  SavedAudienceInputSchema,
  AudienceSuggestionResponseSchema,
  AuditListSchema,
  AuthSessionSchema,
  BrandProfileSchema,
  BrandIdentityResponseSchema,
  BusinessProfileFormSchema,
  BusinessSchema,
  CampaignSchema,
  ConnectorDeleteResultSchema,
  ConnectorSchema,
  ConnectorSettingsSchema,
  ContentItemSchema,
  GenerateContentCalendarInputSchema,
  UpdateContentItemInputSchema,
  ChatAttachmentSchema,
  ConversationSchema,
  CreativeSchema,
  CreativeReferenceSchema,
  GeneratedTextSchema,
  GeneratedCampaignStrategySchema,
  InsightSchema,
  LlmSettingsSchema,
  MemoryItemListSchema,
  MemoryItemSchema,
  MemoryReindexResultSchema,
  MessageSchema,
  MetaConnectionSchema,
  MetaAccountCampaignPageSchema,
  MetaTargetingSearchSchema,
  MetaAdPlanCreatedSchema,
  MetaAdPlanAssistInputSchema,
  MetaAdPlanAssistResponseSchema,
  MetaAdPlanApprovalResponseSchema,
  MetaAdInsightsResponseSchema,
  MetaAdPlanActivationResponseSchema,
  MetricPointSchema,
  RecommendationSchema,
  ReferenceAnalysisSchema,
  SessionInfoSchema,
  SettingsSchema,
  UsageSchema,
} from "@/types";
import type {
  AnalyzeReferenceInput,
  ApplyRecommendationInput,
  Audience,
  SavedAudience,
  SavedAudienceInput,
  AudienceSuggestionInput,
  AudienceSuggestionResponse,
  ChatAttachmentUpload,
  AssistantProgressEvent,
  AuditFilters,
  AuthSession,
  BrandIdentityResponse,
  BrandIdentityUpdateRequest,
  BusinessProfileUpdateInput,
  Campaign,
  CampaignDraft,
  ConnectorSettings,
  ConnectorUpdateInput,
  CreateMemoryItemInput,
  GenerateContentCalendarInput,
  GenerateCreativeInput,
  GenerateStrategyInput,
  GenerateTextInput,
  GeneratedCampaignStrategy,
  MetaAdPlanAssistInput,
  MetaAdPlanAssistResponse,
  GeneratedText,
  ListCampaignsInput,
  ListMetaAccountCampaignsInput,
  ListContentInput,
  ListInsightsInput,
  ListMemoryItemsInput,
  LoginInput,
  MetaAdPlanActivationResponse,
  MetaAdPlanSettings,
  TargetingCategory,
  LlmSettings,
  LlmSettingsUpdateInput,
  LogoutResult,
  MetricPoint,
  RegisterInput,
  SendMessageInput,
  SendMessageOutput,
  SessionInfo,
  Settings,
  StartTaskInput,
  UpdateAgentInput,
  UpdateCampaignInput,
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
const CAMPAIGN_STRATEGY_TIMEOUT_MS = 120_000;
const AUDIENCE_SUGGESTION_TIMEOUT_MS = 120_000;
const ASSISTANT_TIMEOUT_MS = 210_000;
const REFERENCE_ANALYSIS_TIMEOUT_MS = 210_000;

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

const LAYLA_TEXT_TITLES = {
  en: {
    generate_creative_brief: "Creative brief",
    generate_commercial_script: "Commercial script",
    generate_image_prompt: "Image-generation prompt",
    generate_video_prompt: "Video-generation prompt",
    generate_ad_copy: "Ad copy",
    generate_ad_variations: "Ad variations",
  },
  ar: {
    generate_creative_brief: "موجز إبداعي",
    generate_commercial_script: "سيناريو إعلاني",
    generate_image_prompt: "برومبت لتوليد صورة",
    generate_video_prompt: "برومبت لتوليد فيديو",
    generate_ad_copy: "نص إعلاني",
    generate_ad_variations: "نسخ إعلانية متنوعة",
  },
} satisfies Record<GenerateTextInput["language"], Record<GenerateTextInput["tool"], string>>;

function generatedTextSections(
  tool: GenerateTextInput["tool"],
  output: Json,
  language: GenerateTextInput["language"],
): GeneratedText["sections"] {
  const ar = language === "ar";
  const labels = ar
    ? {
        concept: "الفكرة",
        headline: "العنوان الرئيسي",
        subheadline: "العنوان الفرعي",
        visualDirection: "التوجيه البصري",
        styleSpec: "مواصفات الأسلوب",
        ctas: "دعوات الإجراء",
        variations: "الزوايا المقترحة",
        hook: "الافتتاحية",
        scenes: "المشاهد",
        scene: "مشهد",
        timecode: "التوقيت",
        visual: "الصورة",
        camera: "حركة الكاميرا",
        voiceover: "التعليق الصوتي",
        onScreenText: "النص على الشاشة",
        cta: "دعوة الإجراء",
        duration: "المدة",
        prompt: "البرومبت الرئيسي",
        negativePrompt: "ما يجب تجنبه",
        aspectRatio: "نسبة الأبعاد",
        referenceNotes: "ملاحظات المرجع",
        shots: "اللقطات",
        music: "اتجاه الموسيقى",
        primaryTexts: "النصوص الأساسية",
        headlines: "العناوين",
        descriptions: "الأوصاف",
        angle: "الزاوية",
        styleNotes: "ملاحظات بصرية",
        basedOn: "مبني على",
        notes: "ملاحظات Layla",
        summary: "الملخص",
        unavailable: "مصادر غير متاحة",
        output: "الناتج",
      }
    : {
        concept: "Concept",
        headline: "Headline",
        subheadline: "Subheadline",
        visualDirection: "Visual direction",
        styleSpec: "Structured style spec",
        ctas: "Calls to action",
        variations: "Suggested angles",
        hook: "Hook",
        scenes: "Scenes",
        scene: "Scene",
        timecode: "Timecode",
        visual: "Visual",
        camera: "Camera",
        voiceover: "Voiceover",
        onScreenText: "On-screen text",
        cta: "Call to action",
        duration: "Duration",
        prompt: "Master prompt",
        negativePrompt: "Negative prompt",
        aspectRatio: "Aspect ratio",
        referenceNotes: "Reference notes",
        shots: "Shots",
        music: "Music direction",
        primaryTexts: "Primary text options",
        headlines: "Headlines",
        descriptions: "Descriptions",
        angle: "Angle",
        styleNotes: "Visual notes",
        basedOn: "Based on",
        notes: "Layla's notes",
        summary: "Summary",
        unavailable: "Unavailable sources",
        output: "Output",
      };

  const sections: GeneratedText["sections"] = [];
  const valueText = (value: unknown): string => {
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) return value.map(valueText).filter(Boolean).join("\n");
    if (isRecord(value)) {
      return Object.entries(value)
        .filter(([, field]) => field !== null && field !== undefined && field !== "")
        .map(([key, field]) => `${key.replace(/_/g, " ")}: ${valueText(field)}`)
        .filter(Boolean)
        .join("\n");
    }
    return "";
  };
  const add = (heading: string, value: unknown) => {
    const body = valueText(value);
    if (body) sections.push({ heading, body });
  };
  const listText = (value: unknown) =>
    asArray(value)
      .map((item, index) => {
        const body = valueText(item);
        return body ? `${index + 1}. ${body}` : "";
      })
      .filter(Boolean)
      .join("\n");

  switch (tool) {
    case "generate_creative_brief":
      add(labels.concept, output.concept);
      add(labels.headline, output.headline);
      add(labels.subheadline, output.subheadline);
      add(labels.visualDirection, output.visual_direction ?? output.visualDirection);
      add(labels.styleSpec, output.style_spec ?? output.styleSpec);
      add(labels.ctas, listText(output.ctas));
      add(labels.variations, listText(output.variations));
      break;
    case "generate_commercial_script": {
      add(labels.hook, output.hook);
      const scenes = asArray(output.scenes)
        .map((scene, index) => {
          if (!isRecord(scene)) return "";
          const order = typeof scene.order === "number" ? scene.order : index + 1;
          const seconds = valueText(scene.duration_seconds ?? scene.durationSeconds);
          const title = `${labels.scene} ${order}${seconds ? ` (${seconds}s)` : ""}`;
          const details = [
            valueText(scene.timecode) ? `${labels.timecode}: ${valueText(scene.timecode)}` : "",
            valueText(scene.visual) ? `${labels.visual}: ${valueText(scene.visual)}` : "",
            valueText(scene.camera) ? `${labels.camera}: ${valueText(scene.camera)}` : "",
            valueText(scene.voiceover) ? `${labels.voiceover}: ${valueText(scene.voiceover)}` : "",
            valueText(scene.on_screen_text ?? scene.onScreenText)
              ? `${labels.onScreenText}: ${valueText(scene.on_screen_text ?? scene.onScreenText)}`
              : "",
          ].filter(Boolean);
          return [title, ...details].join("\n");
        })
        .filter(Boolean)
        .join("\n\n");
      add(labels.scenes, scenes);
      add(labels.voiceover, output.voiceover);
      add(labels.cta, output.cta);
      if (output.duration_seconds !== undefined) add(labels.duration, output.duration_seconds);
      break;
    }
    case "generate_image_prompt":
      add(labels.prompt, output.prompt);
      add(labels.negativePrompt, output.negative_prompt ?? output.negativePrompt);
      add(labels.styleSpec, output.style_spec ?? output.styleSpec);
      add(labels.aspectRatio, output.aspect_ratio ?? output.aspectRatio);
      add(labels.referenceNotes, output.reference_notes ?? output.referenceNotes);
      break;
    case "generate_video_prompt": {
      add(labels.prompt, output.prompt);
      const shots = asArray(output.shots)
        .map((shot, index) => {
          if (!isRecord(shot)) return "";
          const order = typeof shot.order === "number" ? shot.order : index + 1;
          const seconds = valueText(shot.duration_seconds ?? shot.durationSeconds);
          const title = `${labels.scene} ${order}${seconds ? ` (${seconds}s)` : ""}`;
          const details = [
            valueText(shot.timecode) ? `${labels.timecode}: ${valueText(shot.timecode)}` : "",
            valueText(shot.description) ? `${labels.visual}: ${valueText(shot.description)}` : "",
            valueText(shot.camera) ? `${labels.camera}: ${valueText(shot.camera)}` : "",
            valueText(shot.voiceover) ? `${labels.voiceover}: ${valueText(shot.voiceover)}` : "",
            valueText(shot.on_screen_text ?? shot.onScreenText)
              ? `${labels.onScreenText}: ${valueText(shot.on_screen_text ?? shot.onScreenText)}`
              : "",
          ].filter(Boolean);
          return [title, ...details].join("\n");
        })
        .filter(Boolean)
        .join("\n\n");
      add(labels.shots, shots);
      add(labels.voiceover, output.voiceover);
      add(labels.music, output.music_direction ?? output.musicDirection);
      if (output.duration_seconds !== undefined) add(labels.duration, output.duration_seconds);
      add(labels.aspectRatio, output.aspect_ratio ?? output.aspectRatio);
      break;
    }
    case "generate_ad_copy":
      add(labels.primaryTexts, listText(output.primary_texts ?? output.primaryTexts));
      add(labels.headlines, listText(output.headlines));
      add(labels.descriptions, listText(output.descriptions));
      add(labels.ctas, listText(output.ctas));
      break;
    case "generate_ad_variations": {
      const variations = asArray(output.variations)
        .map((variation, index) => {
          if (!isRecord(variation)) return "";
          const parts = [
            `${index + 1}. ${valueText(variation.angle)}`,
            valueText(variation.headline) ? `${labels.headline}: ${valueText(variation.headline)}` : "",
            valueText(variation.primary_text ?? variation.primaryText)
              ? `${labels.primaryTexts}: ${valueText(variation.primary_text ?? variation.primaryText)}`
              : "",
            valueText(variation.cta) ? `${labels.cta}: ${valueText(variation.cta)}` : "",
            valueText(variation.style_notes ?? variation.styleNotes)
              ? `${labels.styleNotes}: ${valueText(variation.style_notes ?? variation.styleNotes)}`
              : "",
          ].filter(Boolean);
          return parts.join("\n");
        })
        .filter(Boolean)
        .join("\n\n");
      add(labels.variations, variations);
      add(labels.basedOn, output.based_on ?? output.basedOn);
      break;
    }
  }

  add(labels.summary, output.summary);
  add(labels.notes, output.notes);
  add(labels.unavailable, listText(output.unavailable_sources ?? output.unavailableSources));
  if (!sections.length) add(labels.output, "Layla returned no structured text for this request.");
  return sections;
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
    // FormData must set its own Content-Type: the browser embeds the multipart
    // boundary in it, and any value chosen here would break the upload.
    const isMultipart = typeof FormData !== "undefined" && init.body instanceof FormData;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (hasBody && !isMultipart) headers["Content-Type"] = "application/json";

    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const workspaceId = getActiveWorkspaceId();
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;

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
      const cause = error instanceof Error ? error.message : String(error);
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new ApiError(
          "request_timeout",
          `The request to ${url} timed out after ${timeoutMs ?? DEFAULT_TIMEOUT_MS}ms. The backend may still be processing it.`,
          408,
          { cause, timeoutMs: timeoutMs ?? DEFAULT_TIMEOUT_MS },
        );
      }
      throw new ApiError(
        "network_error",
        `Could not reach the backend at ${url}. Check that it is running and that the browser can access it.`,
        0,
        { cause },
      );
    }
    // The backend creates a fresh request id when the client does not supply
    // one. Do not recycle the previous response's id across unrelated calls.
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

  async getBrandIdentity(): Promise<BrandIdentityResponse> {
    const raw = await this.get("/business/brand-identity");
    return this.parse(BrandIdentityResponseSchema, this.mapBrandIdentity(raw), "/business/brand-identity");
  }

  async syncBrandIdentity(): Promise<BrandIdentityResponse> {
    const raw = await this.post("/business/brand-identity/sync", {});
    return this.parse(BrandIdentityResponseSchema, this.mapBrandIdentity(raw), "/business/brand-identity/sync");
  }

  async updateBrandIdentity(patch: BrandIdentityUpdateRequest): Promise<BrandIdentityResponse> {
    const payload = {
      name: patch.brandName,
      brandName: patch.brandName,
      industry: patch.industry,
      colors: patch.palette,
      palette: patch.palette,
      essence: patch.essence,
      audience: patch.targetAudience,
      targetAudience: patch.targetAudience,
      swot: patch.swot,
      keyOffers: patch.keyOffers,
      competitors: patch.competitors,
      marketGaps: patch.marketGaps,
    };
    const raw = await this.patch("/business/brand-identity", payload);
    return this.parse(BrandIdentityResponseSchema, this.mapBrandIdentity(raw), "/business/brand-identity");
  }

  private mapBrandIdentity(raw: unknown): BrandIdentityResponse {
    const rawObj = isRecord(raw) ? raw : {};
    const p = isRecord(rawObj.colors)
      ? rawObj.colors
      : isRecord(rawObj.palette)
        ? rawObj.palette
        : {};
    const e = isRecord(rawObj.essence) ? rawObj.essence : {};
    const t = isRecord(rawObj.audience)
      ? rawObj.audience
      : isRecord(rawObj.target_audience)
        ? rawObj.target_audience
        : isRecord(rawObj.targetAudience)
          ? rawObj.targetAudience
          : {};
    const s = isRecord(rawObj.swot) ? rawObj.swot : {};

    return {
      businessId: String(rawObj.business_id ?? rawObj.businessId ?? ""),
      brandName: String(rawObj.name ?? rawObj.brand_name ?? rawObj.brandName ?? "Brand"),
      industry: String(rawObj.industry ?? "Marketing & E-commerce"),
      palette: {
        primary: String(p.primary ?? "#2563EB"),
        secondary: String(p.secondary ?? "#1E293B"),
        accent: String(p.accent ?? "#F59E0B"),
        background: String(p.background ?? "#F8FAFC"),
        text: String(p.text ?? "#0F172A"),
        palette: asArray(p.palette).map(String),
      },
      essence: {
        tagline: String(e.tagline ?? ""),
        mission: String(e.mission ?? ""),
        vision: String(e.vision ?? ""),
        brandVoice: String(e.brand_voice ?? e.brandVoice ?? ""),
        toneKeywords: asArray(e.tone_keywords ?? e.toneKeywords).map(String),
        archetype: e.archetype ? String(e.archetype) : undefined,
      },
      targetAudience: {
        summary: String(t.summary ?? ""),
        demographics: String(t.demographics ?? ""),
        painPoints: asArray(t.pain_points ?? t.painPoints).map(String),
        goals: asArray(t.goals).map(String),
      },
      swot: {
        strengths: asArray(s.strengths).map(String),
        weaknesses: asArray(s.weaknesses).map(String),
        opportunities: asArray(s.opportunities).map(String),
        threats: asArray(s.threats).map(String),
      },
      keyOffers: asArray(rawObj.key_offers ?? rawObj.keyOffers).map(String),
      competitors: asArray(rawObj.competitors).map(String),
      marketGaps: asArray(rawObj.market_gaps ?? rawObj.marketGaps).map(String),
      syncedAt: (rawObj.last_synced_at ?? rawObj.lastSyncedAt ?? rawObj.synced_at ?? rawObj.syncedAt ?? null) as string | null,
    };
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

  async listMetaAccountCampaigns(input?: ListMetaAccountCampaignsInput) {
    const raw = await this.get("/integrations/meta/campaigns", {
      q: input?.search,
      limit: input?.limit ?? 50,
      after: input?.after,
    });
    return this.parse(
      MetaAccountCampaignPageSchema,
      mapMetaAccountCampaignPage(raw),
      "/integrations/meta/campaigns",
    );
  }

  async getCampaign(id: string) {
    const payload = await this.get(`/campaigns/${id}`);
    return this.parse(CampaignSchema, mapCampaign(payload.campaign, payload), `/campaigns/${id}`);
  }

  async createCampaign(draft: CampaignDraft) {
    const created = await this.post("/campaigns", toCampaignCreateBody(draft));
    return this.parse(CampaignSchema, mapCampaign(created), "/campaigns");
  }

  async prepareMetaAdPlan(draft: CampaignDraft, plan: MetaAdPlanSettings) {
    const raw = await this.post("/campaigns/meta-ad-plan", {
      campaign: toCampaignCreateBody({ ...draft, launchNow: false }),
      plan,
    });
    return this.parse(MetaAdPlanCreatedSchema, raw, "/campaigns/meta-ad-plan");
  }

  async assistMetaAdPlan(input: MetaAdPlanAssistInput): Promise<MetaAdPlanAssistResponse> {
    const payload = MetaAdPlanAssistInputSchema.parse(input);
    const raw = await this.raw("/campaigns/meta-ad-plan/assist", {
      method: "POST",
      body: JSON.stringify(payload),
      timeoutMs: ASSISTANT_TIMEOUT_MS,
    });
    return this.parse(MetaAdPlanAssistResponseSchema, raw, "/campaigns/meta-ad-plan/assist");
  }

  async previewMetaAdPlan(recommendationId: string) {
    const raw = await this.post(`/recommendations/${recommendationId}/approve`, { confirm: false });
    return this.parse(MetaAdPlanApprovalResponseSchema, raw, `/recommendations/${recommendationId}/approve`);
  }

  async confirmMetaAdPlan(recommendationId: string) {
    const raw = await this.post(`/recommendations/${recommendationId}/approve`, { confirm: true });
    return this.parse(MetaAdPlanApprovalResponseSchema, raw, `/recommendations/${recommendationId}/approve`);
  }

  async activateMetaAdPlan(
    recommendationId: string,
    confirm: boolean,
  ): Promise<MetaAdPlanActivationResponse> {
    // confirm=false only previews which Meta objects would go ACTIVE.
    const path = `/recommendations/${recommendationId}/activate`;
    const raw = await this.post(path, { confirm });
    return this.parse(MetaAdPlanActivationResponseSchema, raw, path);
  }

  async updateCampaign(input: UpdateCampaignInput): Promise<Campaign> {
    const body: Record<string, unknown> = {};
    const patch = input.patch;
    if (patch.name !== undefined) body.name = patch.name;
    if (patch.status !== undefined) body.status = patch.status;
    // The backend column is `budget` (a daily amount), not `dailyBudget`.
    if (patch.dailyBudget !== undefined) body.budget = patch.dailyBudget;
    if (patch.endDate !== undefined) body.end_date = patch.endDate;
    const raw = await this.patch(`/campaigns/${input.id}`, body);
    return this.parse(CampaignSchema, mapCampaign(raw), `/campaigns/${input.id}`);
  }

  async generateStrategy(input: GenerateStrategyInput): Promise<GeneratedCampaignStrategy> {
    // Gemini may internally retry transient 503s; allow this draft-only request
    // more than the global 30s timeout so the browser does not abandon a request
    // that the backend is still processing.
    const raw = await this.raw("/campaigns/strategy", {
      method: "POST",
      body: JSON.stringify(input),
      timeoutMs: CAMPAIGN_STRATEGY_TIMEOUT_MS,
    });
    return this.parse(GeneratedCampaignStrategySchema, raw, "/campaigns/strategy");
  }

  async getCampaignPerformance(id: string): Promise<MetricPoint[]> {
    // GET /campaigns/{id}/insights returns `latest.daily`: one row per day.
    // When Meta is not connected the backend answers status="unavailable" with
    // an empty series rather than an error, so this resolves to [] and the
    // caller renders its own empty state instead of a hard failure.
    const payload = (await this.get(`/campaigns/${id}/insights`)) as {
      latest?: { daily?: unknown } | null;
    };
    const rows = asArray(payload.latest?.daily);
    const points = rows.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        date: String(r.date ?? ""),
        impressions: Number(r.impressions ?? 0),
        clicks: Number(r.clicks ?? 0),
        conversions: Number(r.conversions ?? 0),
        spend: Number(r.spend ?? 0),
      };
    });
    return this.parse(z.array(MetricPointSchema), points, `/campaigns/${id}/insights`);
  }

  async getCampaignRecommendations(id: string) {
    const payload = await this.get(`/campaigns/${id}`);
    const recs = asArray(payload.recommendations).map((r) => mapRecommendation(r));
    return this.parse(z.array(RecommendationSchema), recs, `/campaigns/${id}`);
  }

  async getCampaignLearnings(): Promise<never> {
    throw unsupported("Campaign learnings", "Learnings are surfaced inside assistant answers.");
  }

  async getAudience(id: string): Promise<Audience> {
    const raw = await this.get(`/audiences/${id}`);
    const saved = this.parse(SavedAudienceSchema, raw, `/audiences/${id}`);
    return this.parse(
      AudienceSchema,
      {
        id: saved.id,
        name: saved.name,
        description: saved.description,
        ageMin: saved.targeting.ageMin,
        ageMax: saved.targeting.ageMax,
        genders: saved.targeting.genders,
        locations: saved.targeting.locations,
        countries: saved.targeting.countries,
        interests: saved.targeting.interests,
        interestTargets: saved.targeting.interestTargets,
        targetingTargets: saved.targeting.targetingTargets.length
          ? saved.targeting.targetingTargets
          : saved.targeting.interestTargets.map((target) => ({ ...target, category: "interests" as const })),
        behaviors: saved.targeting.behaviors,
        source: saved.source,
        isArchived: saved.isArchived,
      },
      `/audiences/${id}`,
    );
  }

  async listAudiences(): Promise<SavedAudience[]> {
    const raw = await this.get("/audiences");
    return this.parse(SavedAudienceListSchema, raw, "/audiences").audiences;
  }

  async createAudience(input: SavedAudienceInput): Promise<SavedAudience> {
    const payload = SavedAudienceInputSchema.parse(input);
    const raw = await this.post("/audiences", payload);
    return this.parse(SavedAudienceSchema, raw, "/audiences");
  }

  async updateAudience(input: { id: string; patch: Partial<SavedAudienceInput> }): Promise<SavedAudience> {
    const raw = await this.patch(`/audiences/${input.id}`, input.patch);
    return this.parse(SavedAudienceSchema, raw, `/audiences/${input.id}`);
  }

  async archiveAudience(id: string): Promise<SavedAudience> {
    const raw = await this.raw(`/audiences/${id}`, { method: "DELETE" });
    return this.parse(SavedAudienceSchema, raw, `/audiences/${id}`);
  }

  async suggestAudiences(input: AudienceSuggestionInput): Promise<AudienceSuggestionResponse> {
    const raw = await this.raw("/audiences/suggest", {
      method: "POST",
      body: JSON.stringify(input),
      timeoutMs: AUDIENCE_SUGGESTION_TIMEOUT_MS,
    });
    return this.parse(AudienceSuggestionResponseSchema, raw, "/audiences/suggest");
  }

  /* ---------------------------------------------------------------- creatives */

  async listCreatives(campaignId?: string) {
    const query = campaignId
      ? `?campaignId=${encodeURIComponent(campaignId)}&limit=500`
      : "";
    const list = asArray(await this.get(`/creatives${query}`))
      .map((c) => mapCreative(c))
      // Kept as a second line of defence: if the server-side filter ever drifts,
      // a creative from another campaign still cannot leak into this list.
      .filter((c) => (campaignId ? c.campaignId === campaignId : true));
    return this.parse(z.array(CreativeSchema), list, "/creatives");
  }

  async getCreative(): Promise<never> {
    throw unsupported("Creative detail", "The backend only exposes the creative list.");
  }

  /**
   * Upload a user-supplied image as a creative.
   *
   * Multipart, because that is the only shape FastAPI's `UploadFile` reads. The
   * backend validates the file signature and stores the bytes inline, then this
   * maps it through the same adapter as `/creatives/generate` — so the UI never
   * has to know whether an image was made or uploaded.
   */
  async uploadCreative(input: { file: File; campaignId?: string; note?: string }) {
    const form = new FormData();
    form.append("file", input.file, input.file.name || "upload.png");
    if (input.campaignId) form.append("campaignId", input.campaignId);
    if (input.note) form.append("note", input.note);

    const payload = await this.raw<Json>("/creatives/upload", {
      method: "POST",
      body: form,
      // A 10 MB upload on a slow link is not a 30 s request.
      timeoutMs: 120_000,
    });
    return this.parse(CreativeSchema, mapCreative(payload), "/creatives/upload");
  }

  async generateCreative(input: GenerateCreativeInput) {
    const payload = await this.post("/creatives/generate", {
      prompt: input.brief,
      aspectRatio: input.aspectRatio ?? "1:1",
      campaignId: input.campaignId,
      numImages: Math.min(4, Math.max(1, input.count)),
      referenceAnalysisId: input.referenceAnalysisId,
      referenceImageUrl: input.referenceImageUrl,
    });
    // The backend answers 200 with `assets: []` when the image provider is not
    // configured or refuses. Surfacing that as an error is the difference between
    // a red toast explaining why and a green "0 creatives generated".
    if (payload.status === "unavailable" || payload.status === "partial") {
      throw new ApiError(
        "IMAGE_GENERATION_UNAVAILABLE",
        String(
          payload.unavailableReason ??
            "Image generation is not available. Check the image provider in Settings → Connectors.",
        ),
        503,
      );
    }
    const assets = asArray(payload.assets).map((a) => mapCreative(a));
    if (assets.length === 0) {
      throw new ApiError(
        "IMAGE_GENERATION_EMPTY",
        "The image provider returned no asset and gave no reason. Check the image provider in Settings → Connectors.",
        503,
      );
    }
    return this.parse(z.array(CreativeSchema), assets, "/creatives/generate");
  }

  async generateVariations(): Promise<never> {
    throw unsupported("Creative variations", "Open Write with AI; Layla's text endpoint is /creatives/generate-text, not a queued /tasks job.");
  }

  async analyzeReference(input: AnalyzeReferenceInput) {
    const source = input.source.trim();
    const request = source.startsWith("data:")
      ? { imageData: source, sourceName: input.fileName ?? "" }
      : { imageUrl: source, sourceName: input.fileName ?? "" };
    const payload = await this.raw("/creatives/analyze-reference", {
      method: "POST",
      body: JSON.stringify(request),
      timeoutMs: REFERENCE_ANALYSIS_TIMEOUT_MS,
    });
    return this.parse(ReferenceAnalysisSchema, mapReferenceAnalysis(payload), "/creatives/analyze-reference");
  }

  async listCreativeReferences() {
    const raw = asArray(await this.get("/creatives/references")).map((item) => mapCreativeReference(item));
    return this.parse(z.array(CreativeReferenceSchema), raw, "/creatives/references");
  }

  async updateCreativeReference(input: { id: string; favorite: boolean }) {
    const raw = await this.patch(`/creatives/references/${input.id}`, { favorite: input.favorite });
    return this.parse(CreativeReferenceSchema, mapCreativeReference(raw), `/creatives/references/${input.id}`);
  }

  async uploadChatAttachment(input: ChatAttachmentUpload) {
    const payload = await this.raw("/assistant/attachments", {
      method: "POST",
      body: JSON.stringify({ imageData: input.source, sourceName: input.fileName ?? "" }),
      timeoutMs: REFERENCE_ANALYSIS_TIMEOUT_MS,
    });
    return this.parse(ChatAttachmentSchema, payload, "/assistant/attachments");
  }

  async addToCampaign(): Promise<never> {
    throw unsupported("Attaching a creative to a campaign", "Generate the creative with a campaignId instead.");
  }

  /* ----------------------------------------------------------------- insights */

  async getCampaignAdInsights(id: string) {
    const raw = await this.get(`/campaigns/${id}/ads/insights`);
    return this.parse(MetaAdInsightsResponseSchema, raw, `/campaigns/${id}/ads/insights`);
  }

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
    // Values are mostly single ids; `attachmentIds` is the one list-valued key.
    const context: Record<string, unknown> = {};
    // Turn-scoped images ride along as a list, not as the single id the other
    // kinds use: a message may carry several photos, and they must not become
    // part of the conversation's sticky context.
    const attachmentIds = [...input.context.filter((chip) => chip.kind === "attachment").map((chip) => chip.id)];
    if (input.attachmentIds?.length) attachmentIds.push(...input.attachmentIds);
    for (const chip of input.context) {
      if (chip.kind === "attachment") continue;
      const field =
        chip.kind === "campaign"
          ? "campaignId"
          : chip.kind === "creative"
            ? "creativeId"
            : chip.kind === "reference"
              ? "referenceAnalysisId"
              : chip.kind === "competitor"
                ? "competitorId"
                : "insightId";
      // The backend context contract has one id per entity kind. Preserve the
      // first explicit selection of each kind instead of dropping non-campaign chips.
      if (!context[field]) context[field] = chip.id;
      if (chip.kind === "competitor" && !context["competitorName"]) {
        context["competitorName"] = chip.label;
      }
    }
    if (input.referenceAnalysisId) context.referenceAnalysisId = input.referenceAnalysisId;
    if (input.workflow) context.workflow = input.workflow;
    if (input.promptType) context.promptType = input.promptType;
    if (input.creativeMode) context.creativeMode = input.creativeMode;
    // `Array.from` (not spread) so the file keeps compiling against the project's
    // configured target, which does not enable downlevel iteration.
    const uniqueAttachments = Array.from(new Set(attachmentIds)).slice(0, 4);
    if (uniqueAttachments.length) context.attachmentIds = uniqueAttachments;
    return {
      conversationId: input.conversationId ?? undefined,
      message: input.text,
      language: input.language ?? undefined,
      personaId: input.personaId,
      answer: input.answer,
      context: Object.keys(context).length ? context : undefined,
    };
  }

  private mapAssistantResponse(input: SendMessageInput, payload: Json, path: string): SendMessageOutput {
    const conversationId = str(payload.conversationId, input.conversationId ?? "new");
    const assistantMessage = this.parse(
      MessageSchema,
      mapMessage(payload.message, conversationId),
      path,
    );
    const asstTime = new Date(assistantMessage.createdAt).getTime();
    const defaultUserCreatedAt = isNaN(asstTime)
      ? new Date(Date.now() - 3000).toISOString()
      : new Date(asstTime - 3000).toISOString();

    const rawUserMessage = isRecord(payload.userMessage)
      ? mapMessage(payload.userMessage, conversationId)
      : {
          id: `u_${Date.now()}`,
          conversationId,
          role: "user" as const,
          blocks: [{ type: "text" as const, text: input.text }],
          createdAt: defaultUserCreatedAt,
        };
    const userMessage = this.parse(
      MessageSchema,
      { ...rawUserMessage, context: input.context },
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

  /** Task identity is in query params; non-secret inputs and conversation link use the optional body. */
  async startTask(input: StartTaskInput) {
    const target = ACTION_TASK_MAP[input.type];
    if (!target) {
      throw new ApiError(
        "DIRECT_ACTION",
        `${input.type} is not a queued task; use its dedicated API workflow instead.`,
        400,
      );
    }
    const raw = await this.post(
      "/tasks",
      { inputs: input.payload, conversationId: input.conversationId },
      { persona_id: target.personaId, task: target.task },
    );
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

  async searchMetaInterests(query: string, category: TargetingCategory) {
    const raw = await this.get("/integrations/meta/targeting-search", { q: query, category });
    return this.parse(
      MetaTargetingSearchSchema,
      raw,
      "/integrations/meta/targeting-search",
    );
  }

  async connectMeta(): Promise<never> {
    throw new ApiError(
      "ADMIN_CONFIGURATION_REQUIRED",
      "Meta is admin-managed. Configure the access token, ad account ID, and Facebook Page ID in Settings > Admin > Connectors > Meta; do not paste credentials into chat.",
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

  /* ---------------------------------------------------------- content calendar */

  async listContentItems(input?: ListContentInput) {
    const raw = await this.get<Json[]>("/content", input ? {
      month: input.month,
      campaignId: input.campaignId,
    } : undefined);
    const list = asArray(raw).map((item) => mapContentItem(item));
    return this.parse(z.array(ContentItemSchema), list, "/content");
  }

  async generateContentCalendar(input: GenerateContentCalendarInput) {
    const request = GenerateContentCalendarInputSchema.parse(input);
    const raw = await this.raw<Json[]>("/content/generate", {
      method: "POST",
      body: JSON.stringify(request),
      timeoutMs: ASSISTANT_TIMEOUT_MS,
    });
    const list = asArray(raw).map((item) => mapContentItem(item));
    return this.parse(z.array(ContentItemSchema), list, "/content/generate");
  }

  async updateContentItem(input: UpdateContentItemInput) {
    const request = UpdateContentItemInputSchema.parse(input);
    const raw = await this.patch<Json>(`/content/${encodeURIComponent(request.id)}`, request.patch);
    return this.parse(ContentItemSchema, mapContentItem(raw), `/content/${request.id}`);
  }

  async deleteContentItem(id: string): Promise<{ id: string }> {
    const raw = await this.delete<Json>(`/content/${encodeURIComponent(id)}`);
    return this.parse(z.object({ id: z.string() }), raw ?? { id }, `/content/${id}`);
  }

  async generateText(input: GenerateTextInput): Promise<GeneratedText> {
    if (input.tool === "generate_image_prompt" || input.tool === "generate_video_prompt") {
      throw unsupported("Image/video prompt generation", "Continue in Layla chat to gather details and approve the final prompt.");
    }
    const response = await this.raw<Json>("/creatives/generate-text", {
      method: "POST",
      timeoutMs: ASSISTANT_TIMEOUT_MS,
      body: JSON.stringify({
        tool: input.tool,
        brief: input.brief,
        language: input.language,
        campaignId: input.campaignId,
        creativeId: input.creativeId,
      }),
    });
    const row = isRecord(response) ? response : {};
    const id = str(row.id);
    if (!id) {
      throw new ApiError("SCHEMA_MISMATCH", "Layla's generation endpoint did not return an id.", 200);
    }
    const output = isRecord(row.output) ? row.output : {};
    const sections = generatedTextSections(input.tool, output, input.language);
    const titles = LAYLA_TEXT_TITLES[input.language] ?? LAYLA_TEXT_TITLES.en;
    const generated = {
      id,
      tool: input.tool,
      title: titles[input.tool],
      sections,
      plainText: sections.map((section) => `${section.heading}\n${section.body}`).join("\n\n"),
      createdAt: str(row.createdAt, new Date().toISOString()),
    };
    return this.parse(GeneratedTextSchema, generated, "/creatives/generate-text");
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
