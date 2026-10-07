"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type {
  AnalyzeReferenceInput,
  AuditFilters,
  BusinessProfileUpdateInput,
  CampaignDraft,
  ConnectorUpdateInput,
  CreateMemoryItemInput,
  GenerateCreativeInput,
  GenerateStrategyInput,
  ListCampaignsInput,
  ListInsightsInput,
  ListContentInput,
  ListMemoryItemsInput,
  LoginInput,
  LlmSettingsUpdateInput,
  RegisterInput,
  UpdateContentItemInput,
  UpdateMemoryItemInput,
  Settings,
  UsagePeriod,
} from "@/types";

/* Business */
export const useBusiness = () => useQuery({ queryKey: qk.business, queryFn: () => api.getBusiness() });
export const useBrandProfile = () => useQuery({ queryKey: qk.brand, queryFn: () => api.getBrandProfile() });

/* Campaigns */
export const useCampaigns = (input?: ListCampaignsInput) =>
  useQuery({ queryKey: qk.campaigns(input), queryFn: () => api.listCampaigns(input) });
export const useCampaign = (id: string) =>
  useQuery({ queryKey: qk.campaign(id), queryFn: () => api.getCampaign(id), enabled: !!id });
export const useCampaignPerformance = (id: string) =>
  useQuery({ queryKey: qk.campaignPerformance(id), queryFn: () => api.getCampaignPerformance(id), enabled: !!id });
export const useCampaignRecommendations = (id: string) =>
  useQuery({ queryKey: qk.campaignRecommendations(id), queryFn: () => api.getCampaignRecommendations(id), enabled: !!id });
export const useAudience = (id: string | null) =>
  useQuery({ queryKey: ["audience", id], queryFn: () => api.getAudience(id!), enabled: !!id });
export const useCampaignLearnings = (id: string) =>
  useQuery({ queryKey: qk.campaignLearnings(id), queryFn: () => api.getCampaignLearnings(id), enabled: !!id });

export const useCreateCampaign = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (draft: CampaignDraft) => api.createCampaign(draft),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });
};
export const useGenerateStrategy = () =>
  useMutation({ mutationFn: (input: GenerateStrategyInput) => api.generateStrategy(input) });

/* Creatives */
export const useCreatives = (campaignId?: string) =>
  useQuery({ queryKey: qk.creatives(campaignId), queryFn: () => api.listCreatives(campaignId) });
export const useGenerateCreative = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerateCreativeInput) => api.generateCreative(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["creatives"] }),
  });
};
export const useAnalyzeReference = () =>
  useMutation({ mutationFn: (input: AnalyzeReferenceInput) => api.analyzeReference(input) });

/* Insights */
export const useInsights = (input?: ListInsightsInput) =>
  useQuery({ queryKey: qk.insights(input), queryFn: () => api.getInsights(input) });
export const useDismissRecommendation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (recommendationId: string) => api.dismissRecommendation({ recommendationId }),
    onSuccess: (rec) => qc.invalidateQueries({ queryKey: qk.campaignRecommendations(rec.campaignId) }),
  });
};

/* Assistant */
export const useConversations = () => useQuery({ queryKey: qk.conversations, queryFn: () => api.listConversations() });
export const useConversation = (id: string | null) =>
  useQuery({ queryKey: qk.conversation(id ?? ""), queryFn: () => api.getConversation(id!), enabled: !!id });

/* Tasks — polls while running */
export const useTask = (id: string, enabled = true) =>
  useQuery({
    queryKey: qk.task(id),
    queryFn: () => api.getTask(id),
    enabled: enabled && !!id,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "queued" || s === "running" ? 1000 : false;
    },
  });

/* Integrations */
export const useMetaConnection = () =>
  useQuery({
    queryKey: qk.meta,
    queryFn: () => api.getMetaConnection(),
    refetchInterval: (q) => (q.state.data?.status === "connecting" ? 1000 : false),
  });

/* Content calendar */
export const useContentItems = (input: ListContentInput) =>
  useQuery({ queryKey: ["content", input], queryFn: () => api.listContentItems(input) });
export const useUpdateContentItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateContentItemInput) => api.updateContentItem(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content"] }),
  });
};
export const useDeleteContentItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteContentItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content"] }),
  });
};

/* Agents */
export const useAgents = () => useQuery({ queryKey: ["agents"], queryFn: () => api.listAgents() });

/* Settings */
export const useSettings = () => useQuery({ queryKey: qk.settings, queryFn: () => api.getSettings() });
export const useUpdateSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Settings>) => api.updateSettings(patch),
    onSuccess: (s) => qc.setQueryData(qk.settings, s),
  });
};

/* -------------------------------------------------------------------------- */
/* Auth (P1)                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * `GET /auth/me` — the boot check. It runs once per session; the token itself
 * lives in the auth store, not in the query cache, so React Query never
 * serialises, inspects or persists it.
 */
export const useSession = (enabled = true) =>
  useQuery({
    queryKey: qk.session,
    queryFn: () => api.getSession(),
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
  });

export const useRegister = () =>
  useMutation({ mutationFn: (input: RegisterInput) => api.register(input) });

export const useLogin = () => useMutation({ mutationFn: (input: LoginInput) => api.login(input) });

export const useLogout = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.logout(),
    // Nothing cached under the old workspace is valid after a sign-out.
    onSuccess: () => qc.clear(),
    onSettled: () => qc.clear(),
  });
};

/* -------------------------------------------------------------------------- */
/* Business profile (P2.1)                                                      */
/* -------------------------------------------------------------------------- */

export const useBusinessProfileForm = () =>
  useQuery({ queryKey: qk.businessProfile, queryFn: () => api.getBusinessProfileForm() });

/**
 * Saving a profile form is not a domain action — it is not in the action
 * registry and has no before/after diff to confirm — so it goes through a
 * TanStack mutation directly, consistent with `useUpdateSettings` above.
 */
export const useUpdateBusinessProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BusinessProfileUpdateInput) => api.updateBusinessProfile(input),
    onSuccess: (profile) => {
      qc.setQueryData(qk.businessProfile, profile);
      qc.invalidateQueries({ queryKey: qk.business });
      qc.invalidateQueries({ queryKey: qk.brand });
    },
  });
};

/* -------------------------------------------------------------------------- */
/* Connectors (P2.4)                                                            */
/* -------------------------------------------------------------------------- */

export const useConnectorSettings = () =>
  useQuery({ queryKey: qk.connectors, queryFn: () => api.getConnectorSettings() });

export const useUpdateConnector = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { connector: string; patch: ConnectorUpdateInput }) =>
      api.updateConnector(input.connector, input.patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.connectors }),
  });
};

export const useDeleteConnector = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (connector: string) => api.deleteConnector(connector),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.connectors }),
  });
};

export const useLlmSettings = () =>
  useQuery({ queryKey: qk.llmSettings, queryFn: () => api.getLlmSettings() });

export const useUpdateLlmSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LlmSettingsUpdateInput) => api.updateLlmSettings(input),
    onSuccess: (settings) => qc.setQueryData(qk.llmSettings, settings),
  });
};

/* -------------------------------------------------------------------------- */
/* Brand memory (P2.2)                                                          */
/* -------------------------------------------------------------------------- */

export const useMemoryItems = (input?: ListMemoryItemsInput) =>
  useQuery({
    queryKey: qk.memory(input as Record<string, unknown> | undefined),
    queryFn: () => api.listMemoryItems(input),
  });

export const useCreateMemoryItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMemoryItemInput) => api.createMemoryItem(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["memory"] }),
  });
};

export const useUpdateMemoryItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateMemoryItemInput) => api.updateMemoryItem(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["memory"] }),
  });
};

export const useDeleteMemoryItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteMemoryItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["memory"] }),
  });
};

export const useReindexMemory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (kind?: string) => api.reindexMemory(kind),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["memory"] }),
  });
};

/* -------------------------------------------------------------------------- */
/* Usage & audit (P4.1 / P4.4)                                                  */
/* -------------------------------------------------------------------------- */

export const useUsage = (period: UsagePeriod = "today") =>
  useQuery({ queryKey: qk.usage(period), queryFn: () => api.getUsage(period) });

export const useAudit = (filters?: AuditFilters) =>
  useQuery({
    queryKey: qk.audit(filters as Record<string, unknown> | undefined),
    queryFn: () => api.getAudit(filters),
  });
