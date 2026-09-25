"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatCurrency } from "@/lib/format";
import type { Campaign } from "@/types";
import { HealthDot } from "./health-dot";

export function CampaignsTable({ campaigns, compact = false }: { campaigns: Campaign[]; compact?: boolean }) {
  const t = useTranslations("campaigns");
  const to = useTranslations("objective");
  const locale = useLocale();
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
          {campaigns.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">
                <Link href={`/campaigns/${c.id}`} className="hover:underline">
                  {c.name}
                </Link>
              </TableCell>
              {!compact && <TableCell className="text-muted-foreground">{to(c.objective)}</TableCell>}
              <TableCell>
                <StatusBadge status={c.status} />
              </TableCell>
              <TableCell className="text-end tabular-nums">
                {formatCurrency(c.dailyBudget, c.currency, locale)}
                <span className="text-xs text-muted-foreground">{t("perDay")}</span>
              </TableCell>
              <TableCell className="text-end tabular-nums">{c.metrics ? formatCurrency(c.metrics.spend, c.currency, locale) : "—"}</TableCell>
              <TableCell className="text-end tabular-nums">{c.metrics ? `${c.metrics.roas.toFixed(1)}×` : "—"}</TableCell>
              <TableCell className="text-end">
                <HealthDot score={c.healthScore} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
