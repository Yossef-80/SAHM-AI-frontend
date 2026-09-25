"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { useCampaigns, useContentItems } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import type { ContentChannel, ContentItem } from "@/types";
import { ContentItemSheet } from "./content-item-sheet";
import { GenerateCalendarDialog } from "./generate-calendar-dialog";

export const CHANNEL_COLOR: Record<ContentChannel, string> = {
  instagram: "bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/30",
  facebook: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  tiktok: "bg-neutral-500/15 text-neutral-800 dark:text-neutral-200 border-neutral-500/30",
  email: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  blog: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30",
};

const pad = (n: number) => String(n).padStart(2, "0");
const thisMonth = () => `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}`;
const shift = (month: string, delta: number) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

export function CalendarView() {
  const t = useTranslations("calendar");
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const month = /^\d{4}-\d{2}$/.test(params.get("month") ?? "") ? params.get("month")! : thisMonth();
  const setMonth = (m: string) => router.replace(`/calendar?month=${m}`);
  const [campaignId, setCampaignId] = useState("all");
  const [selected, setSelected] = useState<ContentItem | null>(null);
  const [genOpen, setGenOpen] = useState(false);

  const q = useContentItems({ month, campaignId: campaignId === "all" ? undefined : campaignId });
  const campaigns = useCampaigns();

  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(`${month}-01T00:00:00`));
  const weekdays = t.raw("weekdays") as string[];

  // Grid: weeks starting Monday, padded with leading/trailing empty cells.
  const cells = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const days = new Date(y, m, 0).getDate();
    const lead = (first.getDay() + 6) % 7; // Monday = 0
    const out: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= days; d++) out.push(`${month}-${pad(d)}`);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [month]);
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <PageHeader
        title={t("title")}
        actions={
          <>
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger className="w-48" aria-label={t("filterCampaign")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allCampaigns")}</SelectItem>
                {(campaigns.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setGenOpen(true)}>
              <Sparkles className="me-2 h-4 w-4" />
              {(q.data?.length ?? 0) > 0 ? t("regenerate") : t("generate")}
            </Button>
          </>
        }
      />

      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label={t("prevMonth")} onClick={() => setMonth(shift(month, -1))}>
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <Button variant="outline" size="icon" aria-label={t("nextMonth")} onClick={() => setMonth(shift(month, 1))}>
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setMonth(thisMonth())}>
            {t("today")}
          </Button>
        </div>
        <h2 className="text-lg font-semibold capitalize">{monthLabel}</h2>
      </div>

      <AsyncBoundary
        {...q}
        onRetry={() => q.refetch()}
        isEmpty={() => false}
        skeleton={<Skeleton className="h-[560px] w-full" />}
      >
        {(items) => {
          const byDate = items.reduce<Record<string, ContentItem[]>>((acc, it) => ((acc[it.date] ??= []).push(it), acc), {});
          return (
            <div className="overflow-hidden rounded-lg border bg-card">
              <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-medium text-muted-foreground">
                {weekdays.map((d) => (
                  <div key={d} className="py-2">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {cells.map((date, i) => {
                  const dayItems = date ? (byDate[date] ?? []).sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "")) : [];
                  const isToday = date === todayStr;
                  return (
                    <div key={i} className={cn("min-h-[96px] border-b border-e p-1.5 text-xs [&:nth-child(7n)]:border-e-0 md:min-h-[120px]", !date && "bg-muted/20")}>
                      {date && (
                        <>
                          <div className={cn("mb-1 flex h-6 w-6 items-center justify-center rounded-full tabular-nums", isToday && "bg-primary font-semibold text-primary-foreground")}>
                            {Number(date.slice(-2))}
                          </div>
                          <ul className="space-y-1">
                            {dayItems.slice(0, 3).map((it) => (
                              <li key={it.id}>
                                <button
                                  type="button"
                                  onClick={() => setSelected(it)}
                                  className={cn("w-full truncate rounded border px-1.5 py-0.5 text-start", CHANNEL_COLOR[it.channel], it.status === "published" && "opacity-60", it.status === "idea" && "border-dashed")}
                                  title={it.title}
                                >
                                  {it.time && <span className="me-1 tabular-nums opacity-70">{it.time}</span>}
                                  {it.title}
                                </button>
                              </li>
                            ))}
                            {dayItems.length > 3 && (
                              <li>
                                <button type="button" className="text-muted-foreground hover:underline" onClick={() => setSelected(dayItems[3])}>
                                  {t("more", { count: dayItems.length - 3 })}
                                </button>
                              </li>
                            )}
                          </ul>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              {items.length === 0 && !q.isFetching && (
                <div className="flex flex-col items-center gap-2 border-t p-8 text-center">
                  <p className="font-medium">{t("empty")}</p>
                  <p className="text-sm text-muted-foreground">{t("emptyDesc")}</p>
                  <Button size="sm" onClick={() => setGenOpen(true)}>
                    <Sparkles className="me-2 h-4 w-4" />
                    {t("generate")}
                  </Button>
                </div>
              )}
              {q.isFetching && items.length === 0 && (
                <div className="flex items-center justify-center gap-2 border-t p-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t("generating")}
                </div>
              )}
            </div>
          );
        }}
      </AsyncBoundary>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {(Object.keys(CHANNEL_COLOR) as ContentChannel[]).map((c) => (
          <span key={c} className={cn("rounded border px-2 py-0.5", CHANNEL_COLOR[c])}>
            {t(`channel.${c}`)}
          </span>
        ))}
      </div>

      <ContentItemSheet item={selected} onClose={() => setSelected(null)} campaigns={campaigns.data ?? []} />
      <GenerateCalendarDialog open={genOpen} onOpenChange={setGenOpen} month={month} monthLabel={monthLabel} campaigns={campaigns.data ?? []} />
    </div>
  );
}
