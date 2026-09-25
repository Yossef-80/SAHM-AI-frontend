"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { CampaignStrategy } from "@/types";

export function StrategyView({ strategy }: { strategy: CampaignStrategy }) {
  const t = useTranslations("campaigns.strategy");
  return (
    <div className="grid gap-4 text-sm md:grid-cols-2">
      <Section title={t("summary")} className="md:col-span-2">
        <p>{strategy.summary}</p>
      </Section>
      <Section title={t("keyMessages")}>
        <ul className="list-inside list-disc space-y-1">
          {strategy.keyMessages.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </Section>
      <Section title={t("phases")}>
        <ol className="space-y-2">
          {strategy.phases.map((p, i) => (
            <li key={p.name} className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">{i + 1}</span>
              <span>
                <span className="font-medium">{p.name}</span> <span className="text-muted-foreground">· {t("days", { count: p.durationDays })}</span>
                <span className="block text-xs text-muted-foreground">{p.focus}</span>
              </span>
            </li>
          ))}
        </ol>
      </Section>
      <Section title={t("channels")}>
        <div className="flex flex-wrap gap-1">
          {strategy.channels.map((c) => (
            <Badge key={c} variant="secondary" className="capitalize">
              {c.replace("_", " ")}
            </Badge>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t("placements")}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {strategy.placements.map((p) => (
            <Badge key={p} variant="outline">
              {p}
            </Badge>
          ))}
        </div>
      </Section>
      <Section title={t("kpis")}>
        <ul className="space-y-1">
          {strategy.kpis.map((k) => (
            <li key={k.metric} className="flex justify-between">
              <span>{k.metric}</span>
              <span className="font-medium tabular-nums">{k.target}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("bidding")}: <span className="capitalize">{strategy.biddingStrategy.replace("_", " ")}</span>
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}
