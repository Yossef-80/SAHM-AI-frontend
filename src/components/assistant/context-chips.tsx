"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Megaphone, Plus, X, Image as ImageIcon, ImagePlus, Lightbulb, Crosshair, FileSearch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAssistantStore } from "@/store/assistant-store";
import { useCampaigns, useCreativeReferences, useCreatives, useMemoryItems } from "@/hooks/use-api";
import type { ContextChip } from "@/types";

const icon = {
  campaign: Megaphone,
  creative: ImageIcon,
  insight: Lightbulb,
  competitor: Crosshair,
  research: FileSearch,
  reference: ImageIcon,
  // An attached photo is "a picture to talk about" — same glyph as a creative,
  // different lifecycle (turn-scoped, never sticky context).
  attachment: ImagePlus,
};

export function ContextChips() {
  const t = useTranslations("assistant");
  const tn = useTranslations("nav");
  const context = useAssistantStore((s) => s.context);
  const add = useAssistantStore((s) => s.addContext);
  const remove = useAssistantStore((s) => s.removeContext);
  const campaigns = useCampaigns();
  const creatives = useCreatives();
  const references = useCreativeReferences();
  const memoryItems = useMemoryItems({ kind: "competitor_note" });

  const competitors = useMemo(() => {
    const items = memoryItems.data?.items ?? [];
    const seen = new Set<string>();
    const list: { id: string; name: string }[] = [];
    for (const item of items) {
      const meta = (item.metadata || {}) as Record<string, unknown>;
      const details = (meta.details || {}) as Record<string, unknown>;
      const name = (details.subject as string) || (meta.query as string) || (item.text.length < 35 ? item.text : "");
      const cleanName = typeof name === "string" ? name.trim() : "";
      if (cleanName && !seen.has(cleanName.toLowerCase())) {
        seen.add(cleanName.toLowerCase());
        list.push({ id: item.id, name: cleanName });
      }
    }
    return list;
  }, [memoryItems.data]);

  const has = (c: ContextChip) => context.some((x) => x.kind === c.kind && x.id === c.id);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {context.map((c) => {
        const Icon = icon[c.kind];
        return (
          <Badge key={`${c.kind}-${c.id}`} variant="secondary" className="gap-1 pe-1">
            <Icon className="h-3 w-3" />
            <span className="max-w-[160px] truncate">{c.label}</span>
            <button type="button" onClick={() => remove(c.kind, c.id)} aria-label={t("removeContext", { label: c.label })} className="rounded-full p-0.5 hover:bg-background">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        );
      })}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs">
            <Plus className="h-3 w-3" />
            {t("addContext")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
          <DropdownMenuLabel>{tn("campaigns")}</DropdownMenuLabel>
          {(campaigns.data ?? []).map((c) => (
            <DropdownMenuItem key={c.id} disabled={has({ kind: "campaign", id: c.id, label: c.name })} onClick={() => add({ kind: "campaign", id: c.id, label: c.name })}>
              {c.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{tn("creatives")}</DropdownMenuLabel>
          {(creatives.data ?? []).slice(0, 8).map((c) => (
            <DropdownMenuItem key={c.id} disabled={has({ kind: "creative", id: c.id, label: c.title })} onClick={() => add({ kind: "creative", id: c.id, label: c.title })}>
              {c.title}
            </DropdownMenuItem>
          ))}
          {competitors.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>{t("competitors")}</DropdownMenuLabel>
              {competitors.slice(0, 8).map((c) => (
                <DropdownMenuItem key={c.id} disabled={has({ kind: "competitor", id: c.id, label: c.name })} onClick={() => add({ kind: "competitor", id: c.id, label: c.name })}>
                  {c.name}
                </DropdownMenuItem>
              ))}
            </>
          )}
          {(references.data ?? []).length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>{t("savedReferences")}</DropdownMenuLabel>
              {(references.data ?? []).slice(0, 8).map((reference) => (
                <DropdownMenuItem
                  key={reference.id}
                  disabled={has({ kind: "reference", id: reference.id, label: reference.sourceName })}
                  onClick={() => add({ kind: "reference", id: reference.id, label: reference.sourceName })}
                >
                  {reference.sourceName}
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
