"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { ActionButton } from "@/components/shared/action-button";
import { SeverityBadge } from "@/components/shared/status-badge";
import { useInsights } from "@/hooks/use-api";

export function NeedsAttention() {
  const t = useTranslations("home");
  const tc = useTranslations("common");
  const q = useInsights();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">{t("needsAttention")}</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/insights">{tc("viewAll")}</Link>
        </Button>
      </CardHeader>
      <CardContent>
        <AsyncBoundary
          {...q}
          data={q.data?.filter((i) => i.severity !== "info")}
          onRetry={() => q.refetch()}
          emptyTitle={t("allClear")}
          emptyAction={<CheckCircle2 className="h-5 w-5 text-green-600" />}
        >
          {(items) => (
            <ul className="divide-y">
              {items.slice(0, 4).map((i) => (
                <li key={i.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={i.severity} />
                      <p className="truncate font-medium">{i.title}</p>
                    </div>
                    <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{i.recommendedAction}</p>
                  </div>
                  {i.action && <ActionButton size="sm" variant="outline" action={i.action} className="shrink-0" />}
                </li>
              ))}
            </ul>
          )}
        </AsyncBoundary>
      </CardContent>
    </Card>
  );
}
