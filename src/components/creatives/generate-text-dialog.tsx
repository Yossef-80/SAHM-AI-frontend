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
import { useBusinessProfileForm } from "@/hooks/use-api";
import { useUiStore } from "@/store/ui-store";
import { TextToolSchema, type Locale, type TextTool } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialTool?: TextTool;
  initialBrief?: string;
  campaignId?: string | null;
  creativeId?: string | null;
}

/**
 * "Write with AI": pick a text tool + brief → GENERATE_TEXT action → result lands in ui-store.generatedText.
 * The result can be copied or handed to CREATE_CREATIVE as a brief (still through the registry).
 */
export function GenerateTextDialog({ open, onOpenChange, initialTool = "generate_ad_copy", initialBrief = "", campaignId = null, creativeId = null }: Props) {
  const t = useTranslations("creatives.textTools");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const isDemoMode = (process.env.NEXT_PUBLIC_USE_MOCKS ?? "true") !== "false";
  const { dispatch, isPending } = useAction();
  const profile = useBusinessProfileForm();
  const savedVisualStyle = profile.data?.visualStyle?.trim() ?? "";
  const result = useUiStore((s) => s.generatedText);
  const setResult = useUiStore((s) => s.setGeneratedText);
  const [tool, setTool] = useState<TextTool>(initialTool);
  const [brief, setBrief] = useState(initialBrief);
  const [copied, setCopied] = useState(false);
  const [useSavedStyle, setUseSavedStyle] = useState(false);
  // Editable copy. Whatever the user keeps is what gets saved -- and when it
  // differs from what Layla produced, the backend stores the before/after pair
  // as brand-voice memory instead of a plain approval.
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (open) {
      setTool(initialTool);
      setBrief(initialBrief);
      setUseSavedStyle(false);
      setResult(null);
      setCopied(false);
      setDraft("");
    }
  }, [open, initialTool, initialBrief, setResult]);

  const valid = brief.trim().length >= 3;
  const toolUsesVisualStyle = tool !== "generate_ad_copy";
  const generate = () => {
    const styleNote = useSavedStyle && toolUsesVisualStyle && savedVisualStyle
      ? t("preferredStylePrompt", { style: savedVisualStyle })
      : "";
    const requestBrief = [brief.trim(), styleNote].filter(Boolean).join("\n\n");
    return dispatch({ type: "GENERATE_TEXT", payload: { tool, brief: requestBrief, campaignId, creativeId, language: locale } });
  };

  // The generated result is only known after the action resolves, so the editable
  // draft follows it rather than being seeded from the request.
  useEffect(() => {
    setDraft(result?.plainText ?? "");
  }, [result]);

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
          <p className="text-xs text-muted-foreground">{t("outputModeNote")}</p>
          {isDemoMode && (
            <p role="status" className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
              {t("demoModeNote")}
            </p>
          )}
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

          {toolUsesVisualStyle && (
            <div className="space-y-2 rounded-md border border-dashed p-3">
              <Button
                type="button"
                size="sm"
                variant={useSavedStyle ? "secondary" : "outline"}
                disabled={!savedVisualStyle || isPending}
                aria-pressed={useSavedStyle}
                onClick={() => setUseSavedStyle((value) => !value)}
              >
                <Sparkles className="me-2 h-4 w-4" />
                {useSavedStyle ? t("styleIncluded") : t("includeSavedStyle")}
              </Button>
              <p className="text-xs text-muted-foreground">
                {savedVisualStyle
                  ? useSavedStyle
                    ? t("savedStylePreview", { style: savedVisualStyle })
                    : t("savedStyleAvailable")
                  : t("styleNotSet")}
              </p>
            </div>
          )}

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
              <div className="space-y-1.5 border-t pt-3">
                <Label htmlFor="gt-edit">{t("editBeforeSaving")}</Label>
                <Textarea
                  id="gt-edit"
                  rows={5}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  dir="auto"
                  className="bg-background text-sm"
                />
                <p className="text-xs text-muted-foreground">{t("editHint")}</p>
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tc("close")}</Button>
          {result && (tool === "generate_creative_brief" || tool === "generate_image_prompt") && (
            <ActionButton
              variant="secondary"
              onDone={(ok) => ok && onOpenChange(false)}
              action={{ type: "CREATE_CREATIVE", payload: { kind: "image", brief: result.plainText.slice(0, 1500), campaignId } }}
            >
              {t("useAsBrief")}
            </ActionButton>
          )}
          {result && (
            <ActionButton
              variant="outline"
              action={{
                type: "SAVE_GENERATED_TEXT",
                payload: {
                  tool,
                  text: draft.trim() || result.plainText,
                  // Layla's original wording: unequal to `text` means the user
                  // rewrote it, which is the signal worth storing.
                  originalText: result.plainText,
                  brief,
                  title: result.title,
                  campaignId,
                  creativeId,
                },
              }}
            >
              {t("saveToLibrary")}
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
