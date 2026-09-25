"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { BarChart3, Search, Sparkles, Wand2, type LucideIcon } from "lucide-react";
import { useAction, type DispatchInput } from "@/hooks/use-action";
import { useCampaigns } from "@/hooks/use-api";

type Cap = { key: "research" | "create" | "analyze" | "optimize"; icon: LucideIcon } & ({ href: string; action?: undefined } | { href?: undefined; action: (campaignId?: string) => DispatchInput });

const caps: Cap[] = [
  { key: "research", icon: Search, href: "/research" },
  { key: "create", icon: Sparkles, action: () => ({ type: "CREATE_CAMPAIGN", payload: {} }) },
  { key: "analyze", icon: BarChart3, action: (id) => ({ type: "ANALYZE_CAMPAIGN", payload: { campaignId: id ?? "cmp_1" } }) },
  { key: "optimize", icon: Wand2, action: (id) => ({ type: "OPTIMIZE_CAMPAIGN", payload: { campaignId: id ?? "cmp_1" } }) },
];

const cardClass = "flex flex-col items-start gap-2 rounded-lg border bg-card p-4 text-start text-card-foreground shadow-sm transition-colors hover:bg-accent disabled:opacity-60";

export function Capabilities() {
  const t = useTranslations("home");
  const { dispatch, pending } = useAction();
  const { data: campaigns } = useCampaigns({ status: "active" });
  const firstActive = campaigns?.[0]?.id;

  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">{t("capabilities")}</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {caps.map((c) => {
          const inner = (
            <>
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <c.icon className="h-4 w-4" />
              </span>
              <span className="font-medium">{t(c.key)}</span>
              <span className="text-xs text-muted-foreground">{t(`${c.key}Desc`)}</span>
            </>
          );
          if (c.href !== undefined) {
            return (
              <Link key={c.key} href={c.href} className={cardClass}>
                {inner}
              </Link>
            );
          }
          const action = c.action(firstActive);
          return (
            <button key={c.key} type="button" disabled={pending !== null} onClick={() => dispatch(action)} className={cardClass}>
              {inner}
            </button>
          );
        })}
      </div>
    </section>
  );
}
