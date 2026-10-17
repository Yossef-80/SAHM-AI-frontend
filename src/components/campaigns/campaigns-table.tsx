"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatCurrency } from "@/lib/format";
import {
  campaignRowTimestamp,
  metaCampaignObjectiveKey,
  metaCampaignRowTimestamp,
  normalizeMetaCampaignStatus,
} from "@/lib/campaigns/meta-campaigns";
import type { Campaign, MetaAccountCampaign } from "@/types";
import { HealthDot } from "./health-dot";

type CampaignTableRow =
  | { source: "sahm"; campaign: Campaign; timestamp: number }
  | { source: "imported"; campaign: MetaAccountCampaign; timestamp: number };

type CampaignsTableProps = {
  campaigns: Campaign[];
  importedCampaigns?: MetaAccountCampaign[];
  compact?: boolean;
  showSourceBadges?: boolean;
};

export function CampaignsTable({
  campaigns,
  importedCampaigns = [],
  compact = false,
  showSourceBadges = false,
}: CampaignsTableProps) {
  const t = useTranslations("campaigns");
  const to = useTranslations("objective");
  const locale = useLocale();
  const rows: CampaignTableRow[] = [
    ...campaigns.map((campaign) => ({
      source: "sahm" as const,
      campaign,
      timestamp: campaignRowTimestamp(campaign),
    })),
    ...importedCampaigns.map((campaign) => ({
      source: "imported" as const,
      campaign,
      timestamp: metaCampaignRowTimestamp(campaign),
    })),
  ].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("name")}</TableHead>
            {!compact && <TableHead>{t("objective")}</TableHead>}
            <TableHead>{t("status")}</TableHead>
            <TableHead className="text-end">{t("budget")}</TableHead>
            <TableHead className="text-end">{t("spend")}</TableHead>
            <TableHead className="text-end">{t("roas")}</TableHead>
            <TableHead className="text-end">{t("health")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const isImported = row.source === "imported";
            const name = row.campaign.name;
            const objective = isImported
              ? metaCampaignObjectiveKey(row.campaign.objective)
              : row.campaign.objective;
            const objectiveLabel = objective
              ? to(objective)
              : isImported
                ? row.campaign.objective?.replaceAll("_", " ").toLowerCase() || "—"
                : "—";
            const status = isImported
              ? normalizeMetaCampaignStatus(row.campaign)
              : row.campaign.status;
            const sourceBadge = showSourceBadges ? (
              <Badge
                variant="outline"
                title={isImported ? t("sourceImportedHint") : undefined}
                className={isImported
                  ? "shrink-0 border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                  : "shrink-0 border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"}
              >
                {isImported ? t("sourceImported") : t("sourceSahm")}
              </Badge>
            ) : null;

            return (
              <TableRow key={isImported ? `meta:${row.campaign.metaCampaignId}` : `sahm:${row.campaign.id}`}>
                <TableCell className="font-medium">
                  <div className="flex min-w-48 items-center gap-2">
                    {isImported ? (
                      <span className="truncate" title={t("sourceImportedHint")}>{name}</span>
                    ) : (
                      <Link href={`/campaigns/${row.campaign.id}`} className="truncate hover:underline">
                        {name}
                      </Link>
                    )}
                    {sourceBadge}
                  </div>
                </TableCell>
                {!compact && <TableCell className="text-muted-foreground">{objectiveLabel}</TableCell>}
                <TableCell><StatusBadge status={status} /></TableCell>
                <TableCell className="text-end tabular-nums">
                  {isImported
                    ? "—"
                    : <>{formatCurrency(row.campaign.dailyBudget, row.campaign.currency, locale)}<span className="text-xs text-muted-foreground">{t("perDay")}</span></>}
                </TableCell>
                <TableCell className="text-end tabular-nums">
                  {!isImported && row.campaign.metrics
                    ? formatCurrency(row.campaign.metrics.spend, row.campaign.currency, locale)
                    : "—"}
                </TableCell>
                <TableCell className="text-end tabular-nums">
                  {!isImported && row.campaign.metrics ? `${row.campaign.metrics.roas.toFixed(1)}×` : "—"}
                </TableCell>
                <TableCell className="text-end">
                  <HealthDot score={isImported ? null : row.campaign.healthScore} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
