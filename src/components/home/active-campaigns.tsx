"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { ActionButton } from "@/components/shared/action-button";
import { CampaignsTable } from "@/components/campaigns/campaigns-table";
import { useCampaigns } from "@/hooks/use-api";

export function ActiveCampaigns() {
  const t = useTranslations("home");
  const tc = useTranslations("common");
  const q = useCampaigns({ status: "active" });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">{t("activeCampaigns")}</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/campaigns">{tc("viewAll")}</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <AsyncBoundary
          {...q}
          onRetry={() => q.refetch()}
          emptyTitle={t("noActiveCampaigns")}
          emptyAction={<ActionButton size="sm" action={{ type: "CREATE_CAMPAIGN", payload: {} }} />}
        >
          {(campaigns) => <CampaignsTable campaigns={campaigns} compact />}
        </AsyncBoundary>
      </CardContent>
    </Card>
  );
}
