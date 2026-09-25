"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAction } from "@/hooks/use-action";
import { useCampaigns } from "@/hooks/use-api";
import { useUiStore } from "@/store/ui-store";

const RATIOS = ["1:1", "4:5", "9:16", "16:9"] as const;

/**
 * Opened by the CREATE_CREATIVE action when no brief is provided (via ui-store).
 * Submitting dispatches CREATE_CREATIVE again *with* a brief, which calls the API.
 */
export function CreateCreativeDialog() {
  const t = useTranslations("creatives.dialog");
  const tk = useTranslations("kind");
  const tc = useTranslations("common");
  const req = useUiStore((s) => s.createCreative);
  const setReq = useUiStore((s) => s.setCreateCreative);
  const { dispatch, isPending } = useAction();
  const campaigns = useCampaigns();

  const [brief, setBrief] = useState("");
  const [campaignId, setCampaignId] = useState<string>("none");
  const [ratio, setRatio] = useState<(typeof RATIOS)[number]>("1:1");
  const [count, setCount] = useState("1");

  useEffect(() => {
    if (req) {
      setBrief(req.brief ?? "");
      setCampaignId(req.campaignId ?? "none");
      setRatio(req.kind === "video" ? "9:16" : "1:1");
      setCount("1");
    }
  }, [req]);

  const valid = brief.trim().length >= 3;

  return (
    <Dialog open={!!req} onOpenChange={(o) => !o && setReq(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title", { kind: req ? tk(req.kind) : "" })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="brief">{t("brief")}</Label>
            <Textarea id="brief" rows={4} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder={t("briefPlaceholder")} />
            {!valid && brief.length > 0 && <p className="text-xs text-destructive">{t("briefRequired")}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("campaign")}</Label>
              <Select value={campaignId} onValueChange={setCampaignId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("none")}</SelectItem>
                  {(campaigns.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {req?.kind !== "copy" && (
              <div className="space-y-1.5">
                <Label>{t("aspect")}</Label>
                <Select value={ratio} onValueChange={(v) => setRatio(v as (typeof RATIOS)[number])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RATIOS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>{t("count")}</Label>
              <Select value={count} onValueChange={setCount}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["1", "2", "3", "4"].map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setReq(null)}>
            {tc("cancel")}
          </Button>
          <Button
            disabled={!valid || isPending}
            onClick={async () => {
              if (!req) return;
              const res = await dispatch({
                type: "CREATE_CREATIVE",
                payload: {
                  kind: req.kind,
                  brief: brief.trim(),
                  campaignId: campaignId === "none" ? null : campaignId,
                  referenceAnalysisId: req.referenceAnalysisId,
                  aspectRatio: req.kind === "copy" ? undefined : ratio,
                  count: Number(count),
                },
              });
              if (res?.ok) setReq(null);
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
