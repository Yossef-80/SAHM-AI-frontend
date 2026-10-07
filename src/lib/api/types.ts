import type {
  Agent,
  AuditFilters,
  AuditList,
  AuthSession,
  BusinessProfileForm,
  BusinessProfileUpdateInput,
  Connector,
  ConnectorDeleteResult,
  ConnectorSettings,
  ConnectorUpdateInput,
  ContentItem,
  GenerateContentCalendarInput,
  GenerateTextInput,
  GeneratedText,
  ListContentInput,
  ListMemoryItemsInput,
  LoginInput,
  LlmSettings,
  LlmSettingsUpdateInput,
  LogoutResult,
  MemoryItem,
  MemoryItemList,
  MemoryReindexResult,
  CreateMemoryItemInput,
  RegisterInput,
  SessionInfo,
  UpdateAgentInput,
  UpdateContentItemInput,
  UpdateMemoryItemInput,
  Usage,
  UsagePeriod,
  AddToCampaignInput,
  AgentTask,
  AssistantProgressEvent,
  AnalyzeReferenceInput,
  Audience,
  ApplyRecommendationInput,
  BrandProfile,
  Business,
  Campaign,
  CampaignDraft,
  CampaignStrategy,
  Conversation,
  Creative,
  GenerateCreativeInput,
  GenerateStrategyInput,
  GenerateVariationsInput,
  Insight,
  Learning,
  ListCampaignsInput,
  ListInsightsInput,
  Message,
  MetaConnection,
  MetricPoint,
  Recommendation,
  ReferenceAnalysis,
  SendMessageInput,
  SendMessageOutput,
  Settings,
  StartTaskInput,
  UpdateCampaignInput,
} from "@/types";

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status?: number,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * The single contract between the frontend and the backend.
 * Both `MockApi` and `HttpApi` implement it; components never touch either directly.
 * See docs/API_CONTRACT.md for the schema of every method.
 */
export interface MarketingApi {
  /* Auth (P1). The only routes that do not carry an Authorization header. */
  register(input: RegisterInput): Promise<AuthSession>;
  login(input: LoginInput): Promise<AuthSession>;
  /** Rotates the stored token; the previous one is revoked server-side. */
  refreshSession(): Promise<AuthSession>;
  /** Idempotent: an unknown or already-revoked token still resolves `{revoked:false}`. */
  logout(): Promise<LogoutResult>;
  /** `GET /auth/me` — the boot check. 401 without a valid token. */
  getSession(): Promise<SessionInfo>;

  /* Business & brand */
  getBusiness(): Promise<Business>;
  getBrandProfile(): Promise<BrandProfile>;
  /** Exclude-unset patch: omitted keys are left alone, `null` clears. */
  getBusinessProfileForm(): Promise<BusinessProfileForm>;
  updateBusinessProfile(input: BusinessProfileUpdateInput): Promise<BusinessProfileForm>;

  /* Campaigns */
  listCampaigns(input?: ListCampaignsInput): Promise<Campaign[]>;
  getCampaign(id: string): Promise<Campaign>;
  createCampaign(draft: CampaignDraft): Promise<Campaign>;
  updateCampaign(input: UpdateCampaignInput): Promise<Campaign>;
  generateStrategy(input: GenerateStrategyInput): Promise<CampaignStrategy>;
  getCampaignPerformance(id: string): Promise<MetricPoint[]>;
  getCampaignRecommendations(id: string): Promise<Recommendation[]>;
  getCampaignLearnings(id: string): Promise<Learning[]>;
  getAudience(id: string): Promise<Audience>;

  /* Creatives */
  listCreatives(campaignId?: string): Promise<Creative[]>;
  getCreative(id: string): Promise<Creative>;
  generateCreative(input: GenerateCreativeInput): Promise<Creative[]>;
  generateVariations(input: GenerateVariationsInput): Promise<Creative[]>;
  analyzeReference(input: AnalyzeReferenceInput): Promise<ReferenceAnalysis>;
  addToCampaign(input: AddToCampaignInput): Promise<Campaign>;

  /* Insights & recommendations */
  getInsights(input?: ListInsightsInput): Promise<Insight[]>;
  getRecommendation(id: string): Promise<Recommendation>;
  applyRecommendation(input: ApplyRecommendationInput): Promise<Recommendation>;
  dismissRecommendation(input: ApplyRecommendationInput): Promise<Recommendation>;

  /* Assistant */
  listConversations(): Promise<Conversation[]>;
  getConversation(id: string): Promise<{ conversation: Conversation; messages: Message[] }>;
  sendMessage(input: SendMessageInput): Promise<SendMessageOutput>;
  /**
   * Streaming-ready: yields progressively updated assistant messages.
   * MockApi simulates chunked text; HttpApi will read SSE / ReadableStream.
   */
  streamMessage(
    input: SendMessageInput,
    onProgress?: (event: AssistantProgressEvent) => void,
    signal?: AbortSignal,
  ): AsyncIterable<SendMessageOutput>;

  /* Agent tasks */
  startTask(input: StartTaskInput): Promise<AgentTask>;
  getTask(id: string): Promise<AgentTask>;

  /* Integrations */
  getMetaConnection(): Promise<MetaConnection>;
  connectMeta(): Promise<MetaConnection>;
  reauthMeta(): Promise<MetaConnection>;
  disconnectMeta(): Promise<MetaConnection>;

  /* Content calendar */
  listContentItems(input: ListContentInput): Promise<ContentItem[]>;
  generateContentCalendar(input: GenerateContentCalendarInput): Promise<ContentItem[]>;
  updateContentItem(input: UpdateContentItemInput): Promise<ContentItem>;
  deleteContentItem(id: string): Promise<{ id: string }>;

  /* Text generation tools */
  generateText(input: GenerateTextInput): Promise<GeneratedText>;

  /* Agents */
  listAgents(): Promise<Agent[]>;
  updateAgent(input: UpdateAgentInput): Promise<Agent>;

  /* Settings */
  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;

  /* Connectors (P2.4) */
  getConnectorSettings(): Promise<ConnectorSettings>;
  updateConnector(connector: string, patch: ConnectorUpdateInput): Promise<Connector>;
  deleteConnector(connector: string): Promise<ConnectorDeleteResult>;
  getLlmSettings(): Promise<LlmSettings>;
  updateLlmSettings(input: LlmSettingsUpdateInput): Promise<LlmSettings>;

  /* Brand memory (P2.2) */
  listMemoryItems(input?: ListMemoryItemsInput): Promise<MemoryItemList>;
  createMemoryItem(input: CreateMemoryItemInput): Promise<MemoryItem>;
  updateMemoryItem(input: UpdateMemoryItemInput): Promise<MemoryItem>;
  deleteMemoryItem(id: string): Promise<{ id: string }>;
  /** `kind` omitted means every kind. */
  reindexMemory(kind?: string): Promise<MemoryReindexResult>;

  /* Usage & audit (P4.1 / P4.4) */
  getUsage(period?: UsagePeriod): Promise<Usage>;
  getAudit(filters?: AuditFilters): Promise<AuditList>;
}
