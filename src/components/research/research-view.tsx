"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, AtSign, Compass, Crosshair, Globe, Globe2, Images, KeyRound, Loader2, Search, Star, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { useAction } from "@/hooks/use-action";
import { useConversations } from "@/hooks/use-api";
import { formatDate } from "@/lib/format";
import type { ActionType } from "@/types";

type ToolKey =
  | "analyze_website"
  | "analyze_competitor"
  | "analyze_social_profile"
  | "analyze_reviews"
  | "analyze_market"
  | "analyze_keywords"
  | "analyze_competitor_creatives"
  | "detect_market_gaps"
  | "generate_marketing_strategy";

/** Config-driven: each tool = an action type + which payload field the input fills. */
const TOOLS: { key: ToolKey; icon: LucideIcon; action: ActionType; field: string | null; required: boolean; type?: "url" | "text" }[] = [
  { key: "analyze_website", icon: Globe, action: "ANALYZE_WEBSITE", field: "url", required: true, type: "url" },
  { key: "analyze_competitor", icon: Search, action: "RESEARCH_COMPETITORS", field: "query", required: false },
  { key: "analyze_social_profile", icon: AtSign, action: "ANALYZE_SOCIAL_PROFILE", field: "handle", required: true },
  { key: "analyze_reviews", icon: Star, action: "ANALYZE_REVIEWS", field: "source", required: false },
  { key: "analyze_market", icon: Globe2, action: "ANALYZE_MARKET", field: "query", required: false },
  { key: "analyze_keywords", icon: KeyRound, action: "ANALYZE_KEYWORDS", field: "seed", required: true },
  { key: "analyze_competitor_creatives", icon: Images, action: "ANALYZE_COMPETITOR_CREATIVES", field: "competitor", required: false },
  { key: "detect_market_gaps", icon: Crosshair, action: "DETECT_MARKET_GAPS", field: null, required: false },
  { key: "generate_marketing_strategy", icon: Compass, action: "GENERATE_MARKETING_STRATEGY", field: "brief", required: false },
];

export function ResearchView() {
  const t = useTranslations("research");
  return (
    <div>
      <PageHeader title={t("title")} description={t("desc")} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {TOOLS.map((tool) => (
            <ToolCard key={tool.key} tool={tool} />
          ))}
        </div>
        <RecentResearch />
      </div>
    </div>
  );
}

function ToolCard({ tool }: { tool: (typeof TOOLS)[number] }) {
  const t = useTranslations("research");
  const { dispatch, pending } = useAction();
  const [value, setValue] = useState("");
  const busy = pending === tool.action;
  const disabled = pending !== null || (tool.required && !value.trim());

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    const payload: Record<string, unknown> = {};
    if (tool.field && value.trim()) payload[tool.field] = value.trim();
    void dispatch({ type: tool.action, payload });
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <tool.icon className="h-4 w-4" />
          </span>
          <CardTitle className="text-sm">{t(`tools.${tool.key}.title`)}</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">{t(`tools.${tool.key}.desc`)}</p>
      </CardHeader>
      <CardContent className="mt-auto">
        <form onSubmit={submit} className="flex gap-2">
          {tool.field && (
            <Input
              type={tool.type ?? "text"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={t(`tools.${tool.key}.placeholder`)}
              aria-label={t(`tools.${tool.key}.title`)}
              className="h-9"
              dir="auto"
            />
          )}
          <Button type="submit" size="sm" className="h-9 shrink-0" disabled={disabled}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4 rtl:rotate-180" />}
            <span className="ms-1.5">{t("run")}</span>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function RecentResearch() {
  const t = useTranslations("research");
  const locale = useLocale();
  const q = useConversations();
  const isResearch = (title: string) => /analy|research|market|keyword|review|gap|strategy|website|profile/i.test(title);
  return (
    <Card className="h-fit">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{t("recent")}</CardTitle>
      </CardHeader>
      <CardContent>
        <AsyncBoundary {...q} data={q.data?.filter((c) => isResearch(c.title)).slice(0, 8)} onRetry={() => q.refetch()} emptyTitle={t("noRecent")}>
          {(items) => (
            <ul className="divide-y">
              {items.map((c) => (
                <li key={c.id}>
                  <Link href={`/assistant/${c.id}`} className="block py-2 hover:underline">
                    <p className="truncate text-sm font-medium">{c.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(c.updatedAt, locale)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </AsyncBoundary>
      </CardContent>
    </Card>
  );
}
