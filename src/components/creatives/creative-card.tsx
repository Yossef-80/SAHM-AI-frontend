"use client";

import { useTranslations } from "next-intl";
import { Check, FileText, MoreHorizontal, Play, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/status-badge";
import { useAction } from "@/hooks/use-action";
import { useDeleteCreative } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import type { Creative } from "@/types";

interface Props {
  creative: Creative;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  showActions?: boolean;
  onGenerateVariations?: (creative: Creative) => void;
}

export function CreativeCard({ creative: c, selectable, selected, onSelect, showActions = false, onGenerateVariations }: Props) {
  const t = useTranslations("creatives");
  const tk = useTranslations("kind");
  const ta = useTranslations("actions");
  const { dispatch } = useAction();
  const deleteCreative = useDeleteCreative();

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
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.thumbnailUrl} alt={c.title} className="h-full w-full object-cover" loading="lazy" />
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
                <DropdownMenuItem onClick={() => dispatch({ type: "ANALYZE_CREATIVE", payload: { creativeId: c.id } })}>{ta("ANALYZE_CREATIVE")}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => dispatch({ type: "ADD_TO_CAMPAIGN", payload: { creativeId: c.id } })}>{ta("ADD_TO_CAMPAIGN")}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                  disabled={deleteCreative.isPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(t("card.confirmDelete"))) {
                      deleteCreative.mutate(c.id);
                    }
                  }}
                >
                  <Trash2 className="me-2 h-4 w-4" />
                  {t("card.delete")}
                </DropdownMenuItem>
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
