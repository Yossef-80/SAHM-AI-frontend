"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Copy, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ActionButton } from "@/components/shared/action-button";
import { useAction } from "@/hooks/use-action";
import { useUiStore } from "@/store/ui-store";
import { TextToolSchema, type Locale, type TextTool } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialTool?: TextTool;
  campaignId?: string | null;
}

/**
 * "Write with AI": pick a text tool + brief → GENERATE_TEXT action → result lands in ui-store.generatedText.
 * The result can be copied or handed to CREATE_CREATIVE as a brief (still through the registry).
 */
export function GenerateTextDialog({ open, onOpenChange, initialTool = "generate_ad_copy", campaignId = null }: Props) {
  const t = useTranslations("creatives.textTools");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const { dispatch, isPending } = useAction();
  const result = useUiStore((s) => s.generatedText);
  const setResult = useUiStore((s) => s.setGeneratedText);
  const [tool, setTool] = useState<TextTool>(initialTool);
  const [brief, setBrief] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setTool(initialTool);
      setResult(null);
      setCopied(false);
    }
  }, [open, initialTool, setResult]);

  const valid = brief.trim().length >= 3;
  const generate = () => dispatch({ type: "GENERATE_TEXT", payload: { tool, brief: brief.trim(), campaignId, language: locale } });

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.plainText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable (insecure context) — ignore */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
            <div className="space-y-1.5">
              <Label>{t("tool")}</Label>
              <Select value={tool} onValueChange={(v) => setTool(v as TextTool)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TextToolSchema.options.map((k) => <SelectItem key={k} value={k}>{t(`tools.${k}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gt-brief">{t("brief")}</Label>
              <Textarea id="gt-brief" rows={2} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder={t("briefPlaceholder")} dir="auto" />
            </div>
          </div>

          {result && (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-4" dir="auto">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold">{result.title}</h3>
                <Button variant="ghost" size="sm" onClick={copy}>
                  {copied ? <Check className="me-2 h-4 w-4" /> : <Copy className="me-2 h-4 w-4" />}
                  {copied ? t("copied") : t("copy")}
                </Button>
              </div>
              {result.sections.map((s) => (
                <div key={s.heading}>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.heading}</p>
                  <p className="whitespace-pre-wrap text-sm">{s.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tc("close")}</Button>
          {result && (
            <ActionButton
              variant="secondary"
              onDone={(ok) => ok && onOpenChange(false)}
              action={{ type: "CREATE_CREATIVE", payload: { kind: tool === "generate_video_prompt" || tool === "generate_commercial_script" ? "video" : tool === "generate_ad_copy" ? "copy" : "image", brief: result.plainText.slice(0, 1500), campaignId } }}
            >
              {t("useAsBrief")}
            </ActionButton>
          )}
          <Button disabled={!valid || isPending} onClick={generate}>
            {isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Sparkles className="me-2 h-4 w-4" />}
            {isPending ? t("generating") : result ? t("regenerate") : t("generate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
