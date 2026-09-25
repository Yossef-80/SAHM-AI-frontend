"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type {
  AnalyzeReferenceInput,
  CampaignDraft,
  GenerateCreativeInput,
  GenerateStrategyInput,
  ListCampaignsInput,
  ListInsightsInput,
  ListContentInput,
  UpdateContentItemInput,
  Settings,
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
