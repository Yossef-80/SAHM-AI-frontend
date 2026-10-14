import type { Campaign, CampaignObjective, CampaignStatus, MetaAccountCampaign } from "@/types";

/** Prefer Meta's effective delivery state, then fall back to configured status. */
export function normalizeMetaCampaignStatus(campaign: MetaAccountCampaign): CampaignStatus {
  const effective = (campaign.effectiveStatus ?? "").toUpperCase();
  if (effective.includes("PAUSED")) return "paused";
  if (["ARCHIVED", "DELETED", "COMPLETED"].includes(effective)) return "completed";
  if (["IN_PROCESS", "PENDING_REVIEW", "PREAPPROVED", "PENDING_BILLING_INFO"].includes(effective)) {
    return "scheduled";
  }
  if (effective === "ACTIVE") return "active";

  const status = (campaign.status ?? "").toUpperCase();
  if (status === "ACTIVE") return "active";
  if (status === "PAUSED") return "paused";
  if (["ARCHIVED", "DELETED", "COMPLETED"].includes(status)) return "completed";
  return "draft";
}

export function metaCampaignObjectiveKey(objective: string | null): CampaignObjective | null {
  const value = (objective ?? "").toUpperCase();
  if (value.includes("AWARENESS") || value === "REACH" || value === "BRAND_AWARENESS") return "awareness";
  if (value.includes("TRAFFIC") || value === "LINK_CLICKS") return "traffic";
  if (value.includes("ENGAGEMENT") || value === "POST_ENGAGEMENT") return "engagement";
  if (value.includes("LEAD") || value === "OUTCOME_LEADS") return "leads";
  if (value.includes("SALES") || value === "CONVERSIONS" || value === "OUTCOME_SALES") return "sales";
  if (value.includes("APP_PROMOTION") || value === "APP_INSTALLS" || value === "OUTCOME_APP_INSTALLS") return "app_installs";
  return null;
}

export function filterSahmCampaigns(
  campaigns: readonly Campaign[],
  search: string,
  status: CampaignStatus | "all",
): Campaign[] {
  const query = search.trim().toLocaleLowerCase();
  return campaigns.filter((campaign) => {
    const matchesName = !query || campaign.name.toLocaleLowerCase().includes(query);
    return matchesName && (status === "all" || campaign.status === status);
  });
}

/**
 * Keep Meta-only rows separate and read-only. A Meta campaign already linked
 * to a Sahm row appears once, with the Sahm record and its richer data.
 */
export function filterImportedMetaCampaigns(
  imported: readonly MetaAccountCampaign[],
  allSahmCampaigns: readonly Campaign[],
  search: string,
  status: CampaignStatus | "all",
): MetaAccountCampaign[] {
  const linkedMetaIds = new Set(
    allSahmCampaigns
      .map((campaign) => campaign.metaCampaignId)
      .filter((metaId): metaId is string => Boolean(metaId)),
  );
  const query = search.trim().toLocaleLowerCase();
  return imported.filter((campaign) => {
    if (linkedMetaIds.has(campaign.metaCampaignId)) return false;
    const matchesSearch = !query ||
      `${campaign.name} ${campaign.metaCampaignId}`.toLocaleLowerCase().includes(query);
    const matchesStatus = status === "all" || normalizeMetaCampaignStatus(campaign) === status;
    return matchesSearch && matchesStatus;
  });
}

export function campaignRowTimestamp(campaign: Campaign): number {
  const timestamp = Date.parse(campaign.createdAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function metaCampaignRowTimestamp(campaign: MetaAccountCampaign): number {
  const timestamp = Date.parse(campaign.createdTime ?? campaign.startTime ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}
