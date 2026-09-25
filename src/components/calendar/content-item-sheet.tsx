"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/shared/action-button";
import { useDeleteContentItem, useUpdateContentItem } from "@/hooks/use-api";
import { ContentChannelSchema, ContentFormatSchema, ContentStatusSchema, type Campaign, type ContentChannel, type ContentFormat, type ContentItem, type ContentStatus } from "@/types";

interface Props {
  item: ContentItem | null;
  onClose: () => void;
  campaigns: Campaign[];
}

/** Side editor for one calendar entry. Edits go through the TanStack mutations (no direct API calls). */
export function ContentItemSheet({ item, onClose, campaigns }: Props) {
  const t = useTranslations("calendar");
  const tc = useTranslations("common");
  const update = useUpdateContentItem();
  const remove = useDeleteContentItem();

  const [form, setForm] = useState({ title: "", date: "", time: "", caption: "", channel: "instagram" as ContentChannel, format: "post" as ContentFormat, status: "idea" as ContentStatus });
  useEffect(() => {
    if (item) setForm({ title: item.title, date: item.date, time: item.time ?? "", caption: item.caption ?? "", channel: item.channel, format: item.format, status: item.status });
  }, [item]);

  const campaign = campaigns.find((c) => c.id === item?.campaignId);
  const busy = update.isPending || remove.isPending;

  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-start">{item?.title}</SheetTitle>
        </SheetHeader>
        {item && (
          <div className="mt-4 flex flex-1 flex-col gap-4">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary">{t(`channel.${item.channel}`)}</Badge>
              <Badge variant="secondary">{t(`format.${item.format}`)}</Badge>
              {item.pillar && <Badge variant="outline">{item.pillar}</Badge>}
              {campaign && <Badge variant="outline">{campaign.name}</Badge>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ci-title">{t("item.title")}</Label>
              <Input id="ci-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} dir="auto" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ci-date">{t("item.date")}</Label>
                <Input id="ci-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ci-time">{t("item.time")}</Label>
                <Input id="ci-time" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>{t("item.channel")}</Label>
                <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v as ContentChannel })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ContentChannelSchema.options.map((c) => <SelectItem key={c} value={c}>{t(`channel.${c}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("item.format")}</Label>
                <Select value={form.format} onValueChange={(v) => setForm({ ...form, format: v as ContentFormat })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ContentFormatSchema.options.map((f) => <SelectItem key={f} value={f}>{t(`format.${f}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("item.status")}</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as ContentStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ContentStatusSchema.options.map((s) => <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {item.hook && (
              <div className="space-y-1.5">
                <Label>{t("item.hook")}</Label>
                <p className="rounded-md border bg-muted/40 p-2 text-sm">{item.hook}</p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="ci-caption">{t("item.caption")}</Label>
              <Textarea id="ci-caption" rows={5} value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} dir="auto" />
            </div>
            {item.hashtags.length > 0 && (
              <div className="space-y-1.5">
                <Label>{t("item.hashtags")}</Label>
                <p className="text-sm text-muted-foreground">{item.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}</p>
              </div>
            )}

            {update.isError && <p className="text-sm text-destructive">{update.error instanceof Error ? update.error.message : tc("errorGeneric")}</p>}
            {remove.isError && <p className="text-sm text-destructive">{remove.error instanceof Error ? remove.error.message : tc("errorGeneric")}</p>}

            <div className="mt-auto space-y-2 pt-2">
              <ActionButton
                variant="outline"
                className="w-full"
                action={{
                  type: "CREATE_CREATIVE",
                  payload: { kind: item.format === "reel" || item.format === "story" ? "video" : "image", brief: `${item.title}. ${item.hook ?? ""} ${item.caption ?? ""}`.trim(), campaignId: item.campaignId },
                }}
              >
                {t("item.createCreative")}
              </ActionButton>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="text-destructive"
                  disabled={busy}
                  onClick={() => remove.mutate(item.id, { onSuccess: onClose })}
                >
                  {remove.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Trash2 className="me-2 h-4 w-4" />}
                  {t("item.delete")}
                </Button>
                <Button
                  className="flex-1"
                  disabled={busy || !form.title.trim() || !form.date}
                  onClick={() =>
                    update.mutate(
                      { id: item.id, patch: { ...form, time: form.time || undefined, caption: form.caption || undefined } },
                      { onSuccess: onClose },
                    )
                  }
                >
                  {update.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                  {t("item.save")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
