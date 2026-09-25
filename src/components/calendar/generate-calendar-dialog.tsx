"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/utils";
import { ContentChannelSchema, type Campaign, type ContentChannel } from "@/types";
import { CHANNEL_COLOR } from "./calendar-view";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  month: string;
  monthLabel: string;
  campaigns: Campaign[];
}

export function GenerateCalendarDialog({ open, onOpenChange, month, monthLabel, campaigns }: Props) {
  const t = useTranslations("calendar");
  const tc = useTranslations("common");
  const { dispatch, isPending } = useAction();
  const [postsPerWeek, setPostsPerWeek] = useState("4");
  const [channels, setChannels] = useState<ContentChannel[]>(["instagram", "facebook"]);
  const [campaignId, setCampaignId] = useState("none");
  const [brief, setBrief] = useState("");

  const toggle = (c: ContentChannel) => setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="capitalize">{t("dialog.title", { month: monthLabel })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("dialog.postsPerWeek")}</Label>
              <Select value={postsPerWeek} onValueChange={setPostsPerWeek}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["2", "3", "4", "5", "7"].map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("dialog.campaign")}</Label>
              <Select value={campaignId} onValueChange={setCampaignId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("dialog.none")}</SelectItem>
                  {campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("dialog.channels")}</Label>
            <div className="flex flex-wrap gap-2">
              {ContentChannelSchema.options.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={channels.includes(c)}
                  onClick={() => toggle(c)}
                  className={cn("rounded-md border px-2.5 py-1 text-xs transition", channels.includes(c) ? CHANNEL_COLOR[c] : "text-muted-foreground opacity-60")}
                >
                  {t(`channel.${c}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cal-brief">{t("dialog.brief")}</Label>
            <Textarea id="cal-brief" rows={3} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder={t("dialog.briefPlaceholder")} dir="auto" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tc("cancel")}</Button>
          <Button
            disabled={isPending || channels.length === 0}
            onClick={async () => {
              const res = await dispatch({
                type: "GENERATE_CONTENT_CALENDAR",
                payload: { month, postsPerWeek: Number(postsPerWeek), channels, campaignId: campaignId === "none" ? null : campaignId, brief: brief.trim() || undefined },
              });
              if (res?.ok) onOpenChange(false);
            }}
          >
            {isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Sparkles className="me-2 h-4 w-4" />}
            {isPending ? t("generating") : t("generate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
