"use client";

import { useEffect, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type {
  AnalyzeReferenceInput,
  SavedAudienceInput,
  AudienceSuggestionInput,
  AuditFilters,
  BrandIdentityUpdateRequest,
  BusinessProfileUpdateInput,
  CampaignDraft,
  MetaAdPlanAssistInput,
  MetaAdPlanSettings,
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
  PlanId,
  RegisterInput,
  UpdateContentItemInput,
  UpdateMemoryItemInput,
  Settings,
  UsagePeriod,
  TargetingCategory,
} from "@/types";

/* Business */
export const useBusiness = () => useQuery({ queryKey: qk.business, queryFn: () => api.getBusiness() });
export const useBrandProfile = () => useQuery({ queryKey: qk.brand, queryFn: () => api.getBrandProfile() });
export const useBrandIdentity = () =>
  useQuery({
    queryKey: qk.brandIdentity,
    queryFn: () => api.getBrandIdentity(),
    refetchOnMount: "always",
    staleTime: 5_000,
  });
export const useSyncBrandIdentity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.syncBrandIdentity(),
    onSuccess: (data) => {
      qc.setQueryData(qk.brandIdentity, data);
      qc.invalidateQueries({ queryKey: qk.business });
      qc.invalidateQueries({ queryKey: qk.brand });
    },
  });
};
export const useUpdateBrandIdentity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: BrandIdentityUpdateRequest) => api.updateBrandIdentity(patch),
    onSuccess: (data) => {
      qc.setQueryData(qk.brandIdentity, data);
      qc.invalidateQueries({ queryKey: qk.business });
      qc.invalidateQueries({ queryKey: qk.brand });
    },
  });
};

/* Campaigns */
export const useCampaigns = (input?: ListCampaignsInput) =>
  useQuery({ queryKey: qk.campaigns(input), queryFn: () => api.listCampaigns(input), staleTime: 60_000 });
export const useMetaAccountCampaigns = (search?: string) =>
  useInfiniteQuery({
    queryKey: qk.metaAccountCampaigns(search),
    queryFn: ({ pageParam }) =>
      api.listMetaAccountCampaigns({ search, limit: 50, after: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextCursor ?? undefined : undefined,
    staleTime: 60_000,
  });
export const useCampaign = (id: string) =>
  useQuery({ queryKey: qk.campaign(id), queryFn: () => api.getCampaign(id), enabled: !!id, staleTime: 60_000 });
export const useCampaignPerformance = (id: string) =>
  useQuery({ queryKey: qk.campaignPerformance(id), queryFn: () => api.getCampaignPerformance(id), enabled: !!id });
export const useCampaignAdInsights = (id: string) =>
  useQuery({ queryKey: ["campaignAdInsights", id], queryFn: () => api.getCampaignAdInsights(id), enabled: !!id });
export const useCampaignRecommendations = (id: string) =>
  useQuery({ queryKey: qk.campaignRecommendations(id), queryFn: () => api.getCampaignRecommendations(id), enabled: !!id });
export const useAudience = (id: string | null) =>
  useQuery({ queryKey: id ? qk.audience(id) : ["audience", "none"], queryFn: () => api.getAudience(id!), enabled: !!id });
export const useAudiences = () =>
  useQuery({ queryKey: qk.audiences, queryFn: () => api.listAudiences(), staleTime: 30_000 });
export const useCreateAudience = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SavedAudienceInput) => api.createAudience(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.audiences }),
  });
};
export const useUpdateAudience = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; patch: Partial<SavedAudienceInput> }) => api.updateAudience(input),
    onSuccess: (audience) => {
      qc.setQueryData(qk.audience(audience.id), audience);
      qc.invalidateQueries({ queryKey: qk.audiences });
    },
  });
};
export const useArchiveAudience = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.archiveAudience(id),
    onSuccess: (audience) => {
      qc.setQueryData(qk.audience(audience.id), audience);
      qc.invalidateQueries({ queryKey: qk.audiences });
    },
  });
};
export const useSuggestAudiences = () =>
  useMutation({ mutationFn: (input: AudienceSuggestionInput) => api.suggestAudiences(input) });
export const useCampaignLearnings = (id: string) =>
  useQuery({ queryKey: qk.campaignLearnings(id), queryFn: () => api.getCampaignLearnings(id), enabled: !!id });

export const useCreateCampaign = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (draft: CampaignDraft) => api.createCampaign(draft),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });
};
export const usePrepareMetaAdPlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ draft, plan }: { draft: CampaignDraft; plan: MetaAdPlanSettings }) =>
      api.prepareMetaAdPlan(draft, plan),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });
};
export const useAssistMetaAdPlan = () =>
  useMutation({ mutationFn: (input: MetaAdPlanAssistInput) => api.assistMetaAdPlan(input) });
export const useActivateMetaAdPlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { recommendationId: string; confirm: boolean }) =>
      api.activateMetaAdPlan(input.recommendationId, input.confirm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      qc.invalidateQueries({ queryKey: ["campaignAdInsights"] });
    },
  });
};
export const usePreviewMetaAdPlan = () =>
  useMutation({ mutationFn: (recommendationId: string) => api.previewMetaAdPlan(recommendationId) });
export const useConfirmMetaAdPlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (recommendationId: string) => api.confirmMetaAdPlan(recommendationId),
    onSuccess: (_result, recommendationId) => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      qc.invalidateQueries({ queryKey: ["campaignAdInsights"] });
      qc.invalidateQueries({ queryKey: ["recommendations", recommendationId] });
    },
  });
};
export const useGenerateStrategy = () =>
  useMutation({ mutationFn: (input: GenerateStrategyInput) => api.generateStrategy(input) });

/* Creatives */
export const useCreatives = (campaignId?: string) =>
  useQuery({ queryKey: qk.creatives(campaignId), queryFn: () => api.listCreatives(campaignId), staleTime: 60_000 });
export const useUploadCreative = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { file: File; campaignId?: string; note?: string }) =>
      api.uploadCreative(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["creatives"] }),
  });
};
export const useGenerateCreative = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerateCreativeInput) => api.generateCreative(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["creatives"] }),
  });
};
export const useCreativeReferences = () =>
  useQuery({ queryKey: qk.creativeReferences, queryFn: () => api.listCreativeReferences() });
export const useUpdateCreativeReference = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; favorite: boolean }) => api.updateCreativeReference(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.creativeReferences }),
  });
};
export const useDeleteCreativeReference = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteCreativeReference(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.creativeReferences }),
  });
};
/**
 * Uploads an image for the next chat message.
 *
 * Separate from `useAnalyzeReference` on purpose: attaching a picture to a chat
 * must not run the vision analysis, change the composer mode, or navigate. The
 * returned id is added as a turn-scoped `attachment` chip.
 */
export const useUploadChatAttachment = () =>
  useMutation({
    mutationFn: (input: { source: string; fileName?: string; mime?: string }) =>
      api.uploadChatAttachment(input),
  });

export const useAnalyzeReference = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AnalyzeReferenceInput) => api.analyzeReference(input),
    onSuccess: (result) => {
      if (result.status !== "unavailable" && result.id !== "ref_unknown") {
        qc.invalidateQueries({ queryKey: qk.creativeReferences });
      }
    },
  });
};

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
export const useConversations = () =>
  useQuery({ queryKey: qk.conversations, queryFn: () => api.listConversations(), staleTime: 60_000 });
export const useConversation = (id: string | null) =>
  useQuery({ queryKey: qk.conversation(id ?? ""), queryFn: () => api.getConversation(id!), enabled: !!id, staleTime: 60_000 });

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
/**
 * Category-aware lookup against Meta Targeting Search. Wait for typing to pause
 * so every prefix does not trigger a rate-limited Graph request.
 */
export const useMetaInterestSearch = (query: string, category: TargetingCategory) => {
  const normalized = query.trim();
  const [debouncedQuery, setDebouncedQuery] = useState(normalized);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(normalized), 450);
    return () => clearTimeout(timer);
  }, [normalized]);

  const result = useQuery({
    queryKey: qk.metaInterestSearch(category, debouncedQuery.toLowerCase()),
    queryFn: () => api.searchMetaInterests(debouncedQuery, category),
    enabled: debouncedQuery.length >= 2,
    staleTime: 5 * 60_000,
    // An unavailable Meta lookup is already converted into an empty result by
    // the backend; don't let React Query amplify a transient HTTP error.
    retry: false,
  });
  return { ...result, isDebouncing: normalized !== debouncedQuery };
};

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

/**
 * Whether image generation can actually run.
 *
 * The backend already answers this: `ConnectorOut.configured` is false for a
 * placeholder provider (`mock`), and `placeholder` says so explicitly. Without
 * this the Create buttons looked live and the request came back 200 with zero
 * assets, which the UI reported as a success.
 */
export const useImageGenerationReady = () => {
  const query = useConnectorSettings();
  const image = query.data?.connectors.find((c) => c.connector === "image");
  return {
    isLoading: query.isLoading,
    ready: Boolean(image?.configured && !image?.placeholder),
  };
};

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
    staleTime: 60_000,
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

/* ------------------------------------------------ subscriptions & observability */

export const useSubscription = () =>
  useQuery({ queryKey: qk.subscription, queryFn: () => api.getSubscription() });

/** The catalog changes only with a deploy, so it is cached for the session. */
export const useSubscriptionPlans = () =>
  useQuery({
    queryKey: qk.subscriptionPlans,
    queryFn: () => api.getSubscriptionPlans(),
    staleTime: Infinity,
  });

export const useObservability = () =>
  useQuery({ queryKey: qk.observability, queryFn: () => api.getObservabilityStatus() });

/**
 * Switching a plan moves the workspace's daily token ceiling, so every number
 * derived from it — the meter, the usage page, the plan badge — is stale
 * afterwards. Invalidate the whole `subscription` prefix plus `usage`.
 */
export const useSwitchPlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (planId: PlanId) => api.switchPlan(planId),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.subscription }),
        qc.invalidateQueries({ queryKey: ["usage"] }),
      ]);
    },
  });
};

export const useAudit = (filters?: AuditFilters) =>
  useQuery({
    queryKey: qk.audit(filters as Record<string, unknown> | undefined),
    queryFn: () => api.getAudit(filters),
  });
