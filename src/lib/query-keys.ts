/** Centralized TanStack Query keys so invalidation is consistent across hooks and actions. */
export const qk = {
  business: ["business"] as const,
  brand: ["brand"] as const,
  campaigns: (filters?: Record<string, unknown>) => ["campaigns", filters ?? {}] as const,
  campaign: (id: string) => ["campaign", id] as const,
  campaignPerformance: (id: string) => ["campaign", id, "performance"] as const,
  campaignRecommendations: (id: string) => ["campaign", id, "recommendations"] as const,
  campaignLearnings: (id: string) => ["campaign", id, "learnings"] as const,
  creatives: (campaignId?: string) => ["creatives", campaignId ?? "all"] as const,
  creative: (id: string) => ["creative", id] as const,
  insights: (filters?: Record<string, unknown>) => ["insights", filters ?? {}] as const,
  conversations: ["conversations"] as const,
  conversation: (id: string) => ["conversation", id] as const,
  task: (id: string) => ["task", id] as const,
  meta: ["integrations", "meta"] as const,
  settings: ["settings"] as const,
};
