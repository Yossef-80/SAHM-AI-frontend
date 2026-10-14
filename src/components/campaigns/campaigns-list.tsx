"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { ActionButton } from "@/components/shared/action-button";
import { useCampaigns, useMetaAccountCampaigns } from "@/hooks/use-api";
import { CampaignStatusSchema, type CampaignStatus } from "@/types";
import { filterImportedMetaCampaigns, filterSahmCampaigns } from "@/lib/campaigns/meta-campaigns";
import { CampaignsTable } from "./campaigns-table";

export function CampaignsList() {
  const t = useTranslations("campaigns");
  const tc = useTranslations("common");
  const ts = useTranslations("status");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CampaignStatus | "all">("all");
  const campaignsQuery = useCampaigns();
  const metaCampaignsQuery = useMetaAccountCampaigns(search.trim() || undefined);
  const campaigns = useMemo(() => campaignsQuery.data ?? [], [campaignsQuery.data]);
  const visibleCampaigns = useMemo(
    () => filterSahmCampaigns(campaigns, search, status),
    [campaigns, search, status],
  );
  const metaCampaigns = useMemo(
    () => metaCampaignsQuery.data?.pages.flatMap((page) => page.campaigns) ?? [],
    [metaCampaignsQuery.data],
  );
  const visibleImportedCampaigns = useMemo(
    () => filterImportedMetaCampaigns(metaCampaigns, campaigns, search, status),
    [metaCampaigns, campaigns, search, status],
  );
  const latestMetaPage = metaCampaignsQuery.data?.pages.at(-1);
  const metaUnavailable = metaCampaignsQuery.isError || latestMetaPage?.status === "unavailable";
  const metaUnavailableReason = latestMetaPage?.unavailableReason;

  return (
    <div>
      <PageHeader title={t("title")} actions={<ActionButton action={{ type: "CREATE_CAMPAIGN", payload: {} }} label={t("new")} />} />
      <div className="mb-3 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        {t("sourceLegend")}
      </div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} className="sm:max-w-xs" aria-label={tc("search")} />
        <Select value={status} onValueChange={(v) => setStatus(v as CampaignStatus | "all")}>
          <SelectTrigger className="sm:w-44" aria-label={t("filterStatus")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tc("all")}</SelectItem>
            {CampaignStatusSchema.options.map((s) => (
              <SelectItem key={s} value={s}>
                {ts(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {metaCampaignsQuery.isPending && (
        <p className="mb-3 text-sm text-muted-foreground" role="status">{t("metaImportLoading")}</p>
      )}
      {metaUnavailable && (
        <p className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-800 dark:text-amber-200" role="status">
          {t("metaImportUnavailable")}{metaUnavailableReason ? ` ${metaUnavailableReason}` : ""}
        </p>
      )}

      <AsyncBoundary
        isLoading={campaignsQuery.isLoading}
        isPending={campaignsQuery.isPending}
        isError={campaignsQuery.isError}
        error={campaignsQuery.error}
        data={visibleCampaigns}
        isEmpty={(items) =>
          items.length === 0 &&
          visibleImportedCampaigns.length === 0 &&
          !metaCampaignsQuery.isPending &&
          !metaCampaignsQuery.hasNextPage
        }
        onRetry={() => {
          void campaignsQuery.refetch();
          void metaCampaignsQuery.refetch();
        }}
        emptyTitle={t("emptyCombined")}
        emptyDescription={t("emptyCombinedDesc")}
        emptyAction={<ActionButton size="sm" action={{ type: "CREATE_CAMPAIGN", payload: {} }} label={t("new")} />}
      >
        {(localCampaigns) => (
          <div className="space-y-3">
            {localCampaigns.length > 0 || visibleImportedCampaigns.length > 0 ? (
              <CampaignsTable
                campaigns={localCampaigns}
                importedCampaigns={visibleImportedCampaigns}
                showSourceBadges
              />
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                {metaCampaignsQuery.isPending
                  ? t("metaImportLoading")
                  : metaCampaignsQuery.hasNextPage
                    ? t("metaPageNoMatches")
                    : t("emptyCombinedDesc")}
              </div>
            )}
            {metaCampaignsQuery.hasNextPage && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => void metaCampaignsQuery.fetchNextPage()}
                  disabled={metaCampaignsQuery.isFetchingNextPage}
                >
                  {metaCampaignsQuery.isFetchingNextPage ? t("metaImportLoading") : t("loadMoreMeta")}
                </Button>
              </div>
            )}
          </div>
        )}
      </AsyncBoundary>
    </div>
  );
}
