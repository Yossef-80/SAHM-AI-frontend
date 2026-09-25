"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { ActionButton } from "@/components/shared/action-button";
import { useCampaigns } from "@/hooks/use-api";
import { CampaignStatusSchema, type CampaignStatus } from "@/types";
import { CampaignsTable } from "./campaigns-table";

export function CampaignsList() {
  const t = useTranslations("campaigns");
  const tc = useTranslations("common");
  const ts = useTranslations("status");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CampaignStatus | "all">("all");
  const q = useCampaigns({ search: search || undefined, status: status === "all" ? undefined : status });

  return (
    <div>
      <PageHeader title={t("title")} actions={<ActionButton action={{ type: "CREATE_CAMPAIGN", payload: {} }} label={t("new")} />} />
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
      <AsyncBoundary
        {...q}
        onRetry={() => q.refetch()}
        emptyTitle={t("empty")}
        emptyDescription={t("emptyDesc")}
        emptyAction={<ActionButton size="sm" action={{ type: "CREATE_CAMPAIGN", payload: {} }} label={t("new")} />}
      >
        {(campaigns) => <CampaignsTable campaigns={campaigns} />}
      </AsyncBoundary>
    </div>
  );
}
