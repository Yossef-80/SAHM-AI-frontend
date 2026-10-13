"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { ArrowUp, ImagePlus, Loader2, MessageSquare, Palette, Square, Wand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAnalyzeReference } from "@/hooks/use-api";
import { useAssistantStore } from "@/store/assistant-store";
import { ContextChips } from "./context-chips";

const MAX_REFERENCE_BYTES = 2_000_000;
const SUPPORTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export type CreativeMode = "chat" | "prompt" | "design";

const MODES: { id: CreativeMode; icon: typeof MessageSquare }[] = [
  { id: "chat", icon: MessageSquare },
  { id: "prompt", icon: Wand },
  { id: "design", icon: Palette },
];

export function Composer({
  onSend,
  onStop,
  disabled,
  mode,
  onModeChange,
}: {
  onSend: (text: string) => void;
  onStop: () => void;
  disabled: boolean;
  mode: CreativeMode;
  onModeChange: (mode: CreativeMode) => void;
}) {
  const t = useTranslations("assistant");
  const [value, setValue] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [referenceStatus, setReferenceStatus] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const analyze = useAnalyzeReference();
  const addContext = useAssistantStore((state) => state.addContext);

  const uploadReference = (file: File | undefined) => {
    if (!file) return;
    setUploadError("");
    setReferenceStatus("");
    if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
      setUploadError(t("referenceUnsupported"));
      return;
    }
    if (file.size > MAX_REFERENCE_BYTES) {
      setUploadError(t("referenceTooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const result = await analyze.mutateAsync({
          source: String(reader.result ?? ""),
          fileName: file.name,
          kind: "image",
        });
        if (result.status === "unavailable" || !result.id || result.id === "ref_unknown") {
          setUploadError(result.unavailableReason || t("referenceAnalysisUnavailable"));
          return;
        }
        addContext({ kind: "reference", id: result.id, label: result.sourceName || file.name });
        setReferenceStatus(t("referenceReady"));
      } catch {
        setUploadError(t("referenceUploadFailed"));
      }
    };
    reader.onerror = () => setUploadError(t("referenceUploadFailed"));
    reader.readAsDataURL(file);
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const text = value.trim();
    if (!text || disabled || analyze.isPending) return;
    onSend(text);
    setValue("");
    setReferenceStatus("");
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2 rounded-lg border bg-card p-3">
      <ContextChips />
      <div
        role="radiogroup"
        aria-label={t("modeGroup")}
        className="flex flex-wrap gap-1.5"
      >
        {MODES.map(({ id, icon: Icon }) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={mode === id ? "default" : "outline"}
            role="radio"
            aria-checked={mode === id}
            onClick={() => onModeChange(id)}
            title={t(`mode.${id}.hint`)}
            className="gap-1.5"
          >
            <Icon className="h-3.5 w-3.5" />
            {t(`mode.${id}.label`)}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{t(`mode.${mode}.hint`)}</p>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          uploadReference(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      <div className="flex items-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={disabled || analyze.isPending}
          onClick={() => fileRef.current?.click()}
          aria-label={t("uploadReference")}
          title={t("uploadReference")}
        >
          {analyze.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        </Button>
        <Textarea value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={onKey} placeholder={t("placeholder")} rows={2} className="min-h-[44px] resize-none" aria-label={t("placeholder")} />
        {disabled ? (
          <Button type="button" variant="outline" size="icon" onClick={onStop} aria-label={t("stop")}>
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="submit" size="icon" disabled={!value.trim() || analyze.isPending} aria-label={t("send")}>
            <ArrowUp className="h-4 w-4" />
          </Button>
        )}
      </div>
      {analyze.isPending && <p className="text-xs text-muted-foreground" role="status">{t("analyzingReference")}</p>}
      {referenceStatus && <p className="text-xs text-emerald-700 dark:text-emerald-400" role="status">{referenceStatus}</p>}
      {uploadError && <p className="text-xs text-destructive" role="alert">{uploadError}</p>}
    </form>
  );
}
