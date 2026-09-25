"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { MetaConnectionCard } from "./meta-connection-card";

export function IntegrationsView() {
  const t = useTranslations("integrations");
  return (
    <div>
      <PageHeader title={t("title")} />
      <div className="grid gap-4 lg:grid-cols-2">
        <MetaConnectionCard />
      </div>
    </div>
  );
}
