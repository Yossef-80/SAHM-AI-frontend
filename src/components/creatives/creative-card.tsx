"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Check, FileText, MoreHorizontal, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/status-badge";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/utils";
import type { Creative } from "@/types";

interface Props {
  creative: Creative;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  showActions?: boolean;
  onGenerateVariations?: (creative: Creative) => void;
  /** Only meaningful for `copy` creatives: edits teach Layla the brand voice. */
  onEditCopy?: (creative: Creative) => void;
}

export function CreativeCard({ creative: c, selectable, selected, onSelect, showActions = false, onGenerateVariations, onEditCopy }: Props) {
  const t = useTranslations("creatives");
  const tk = useTranslations("kind");
  const ta = useTranslations("actions");
  const { dispatch } = useAction();

  const preview =
    c.kind === "copy" ? (
      <div className="flex h-full flex-col justify-center gap-1 bg-muted/40 p-4">
        <FileText className="mb-1 h-5 w-5 text-muted-foreground" />
        <p className="line-clamp-2 text-sm font-semibold">{c.headline}</p>
        <p className="line-clamp-3 text-xs text-muted-foreground">{c.primaryText}</p>
      </div>
    ) : (
      <div className="relative h-full w-full bg-muted">
        {c.thumbnailUrl && (
          <Image
            src={c.thumbnailUrl}
            alt={c.title}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            // Creative images come from Supabase Storage, Meta CDNs and user
            // uploads; `unoptimized` serves them directly instead of routing
            // every one through the Next image proxy (and avoids a
            // remotePatterns entry per host). Lazy loading and layout
            // reservation still apply.
            unoptimized
            className="object-cover"
          />
        )}
        {c.kind === "video" && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-black/60 p-2 text-white">
              <Play className="h-5 w-5" />
            </span>
          </span>
        )}
      </div>
    );

  return (
    <Card className={cn("group relative overflow-hidden", selectable && "cursor-pointer", selected && "ring-2 ring-primary")} onClick={selectable ? onSelect : undefined} role={selectable ? "checkbox" : undefined} aria-checked={selectable ? selected : undefined}>
      <div className="aspect-square w-full">{preview}</div>
      {selectable && (
        <span className={cn("absolute start-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border bg-background", selected && "border-primary bg-primary text-primary-foreground")}>
          {selected && <Check className="h-4 w-4" />}
        </span>
      )}
      <div className="space-y-1.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-1 text-sm font-medium">{c.title}</p>
          {showActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="-me-2 -mt-1 h-7 w-7" aria-label={t("card.menu")} onClick={(e) => e.stopPropagation()}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    onGenerateVariations
                      ? onGenerateVariations(c)
                      : dispatch({
                          type: "GENERATE_VARIATIONS",
                          payload: {
                            creativeId: c.id,
                            campaignId: c.campaignId,
                            count: 3,
                            brief: [c.title, c.headline, c.primaryText].filter(Boolean).join("\n"),
                          },
                        })
                  }
                >
                  {ta("GENERATE_VARIATIONS")}
                </DropdownMenuItem>
                {c.kind === "copy" && onEditCopy && (
                  <DropdownMenuItem onClick={() => onEditCopy(c)}>{ta("UPDATE_CREATIVE_TEXT")}</DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => dispatch({ type: "ANALYZE_CREATIVE", payload: { creativeId: c.id } })}>{ta("ANALYZE_CREATIVE")}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => dispatch({ type: "ADD_TO_CAMPAIGN", payload: { creativeId: c.id } })}>{ta("ADD_TO_CAMPAIGN")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="text-[11px]">
            {tk(c.kind)}
            {c.kind === "video" && c.durationSec ? ` · ${c.durationSec}s` : ""}
            {c.aspectRatio ? ` · ${c.aspectRatio}` : ""}
          </Badge>
          <StatusBadge status={c.status} className="text-[11px]" />
          {c.score !== undefined && (
            <span className="ms-auto text-xs tabular-nums text-muted-foreground">
              {t("score")} {c.score}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
