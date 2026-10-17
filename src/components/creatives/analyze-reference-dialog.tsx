"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ImagePlus, Loader2, ScanSearch, Upload, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { ActionButton } from "@/components/shared/action-button";
import { useAnalyzeReference } from "@/hooks/use-api";
import type { ReferenceAnalysis } from "@/types";

export function AnalyzeReferenceDialog({
  open,
  onOpenChange,
  onStartPrompt,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onStartPrompt: (kind: "image" | "video", reference: { id: string; sourceName: string }) => void;
}) {
  const t = useTranslations("creatives.reference");
  const analyze = useAnalyzeReference();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [fileError, setFileError] = useState<"unsupported" | "large" | "read" | null>(null);

  const onFile = (f: File | undefined) => {
    if (!f) return;
    setUrl("");
    setFileError(null);
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) {
      setFileError("unsupported");
      setFileName(null);
      setDataUrl(null);
      return;
    }
    if (f.size > 2_000_000) {
      setFileError("large");
      setFileName(null);
      setDataUrl(null);
      return;
    }
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => setDataUrl(String(reader.result));
    reader.onerror = () => setFileError("read");
    reader.readAsDataURL(f);
  };

  const source = dataUrl ?? url.trim();
  const run = () => analyze.mutate({ source, fileName: fileName ?? undefined, kind: "image" });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          analyze.reset();
          setFileName(null);
          setDataUrl(null);
          setUrl("");
          setFileError(null);
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("desc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.currentTarget.value = "";
            }}
          />
          <Button type="button" variant="outline" className="w-full justify-start" onClick={() => fileRef.current?.click()}>
            <Upload className="me-2 h-4 w-4" />
            {fileName ?? t("upload")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("supportedFormats")}</p>
          {fileError && (
            <p className="text-xs text-destructive">
              {fileError === "large" ? t("fileTooLarge") : fileError === "read" ? t("fileReadError") : t("unsupportedFile")}
            </p>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t("orUrl")}</span>
            <Input
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (e.target.value) {
                  setDataUrl(null);
                  setFileName(null);
                }
              }}
              placeholder={t("urlPlaceholder")}
            />
          </div>
        </div>
        <Button onClick={run} disabled={!source || analyze.isPending}>
          {analyze.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <ScanSearch className="me-2 h-4 w-4" />}
          {analyze.isPending ? t("analyzing") : t("analyze")}
        </Button>
        {!source && <p className="text-xs text-muted-foreground">{t("sourceRequired")}</p>}

        {(analyze.isPending || analyze.isError || analyze.data) && (
          <AsyncBoundary isLoading={analyze.isPending} isError={analyze.isError} error={analyze.error} data={analyze.data} onRetry={run}>
            {(a) => (
              <AnalysisResult
                analysis={a}
                onCreated={() => onOpenChange(false)}
                onStartPrompt={(kind) => onStartPrompt(kind, { id: a.id, sourceName: a.sourceName })}
              />
            )}
          </AsyncBoundary>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AnalysisResult({
  analysis: a,
  onCreated,
  onStartPrompt,
}: {
  analysis: ReferenceAnalysis;
  onCreated: () => void;
  onStartPrompt: (kind: "image" | "video") => void;
}) {
  const t = useTranslations("creatives.reference");
  return (
    <div className="space-y-4 rounded-lg border p-4 text-sm" dir="auto">
      <p className="font-medium">{a.sourceName}</p>
      {a.status === "unavailable" && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {a.unavailableReason || t("analysisUnavailable")}
        </p>
      )}
      {a.status === "partial" && a.unavailableReason && (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-muted-foreground">
          {a.unavailableReason}
        </p>
      )}
      {a.hook && <Row label={t("hook")}>{a.hook}</Row>}
      {a.structure.length > 0 && (
        <Row label={t("structure")}>
          <ul className="list-inside list-disc">
            {a.structure.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </Row>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {a.visualStyle.length > 0 && <Row label={t("visualStyle")}><Tags items={a.visualStyle} /></Row>}
        {a.tone.length > 0 && <Row label={t("tone")}><Tags items={a.tone} /></Row>}
        {a.observedOffers.length > 0 && <Row label={t("observedOffers")}><Tags items={a.observedOffers} /></Row>}
        {a.observedCta.length > 0 && <Row label={t("observedCta")}><Tags items={a.observedCta} /></Row>}
      </div>
      <ReferenceDetails style={a.style} />
      {a.inspiredBrief && (
        <Row label={t("inspiredBrief")}>
          <p className="rounded-md bg-muted p-3">{a.inspiredBrief}</p>
        </Row>
      )}
      {a.status !== "unavailable" && a.inspiredBrief && (
        <ActionButton
          action={{ type: "CREATE_CREATIVE", payload: { kind: "image", brief: a.inspiredBrief, referenceAnalysisId: a.id } }}
          label={t("createInspired")}
          onDone={(ok) => ok && onCreated()}
        />
      )}
      {a.status !== "unavailable" && a.id !== "ref_unknown" && (
        <div className="flex flex-wrap gap-2 border-t pt-3">
          <Button type="button" variant="outline" size="sm" onClick={() => onStartPrompt("image")}>
            <ImagePlus className="me-2 h-4 w-4" /> {t("continueWithImagePrompt")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onStartPrompt("video")}>
            <Video className="me-2 h-4 w-4" /> {t("continueWithVideoPrompt")}
          </Button>
        </div>
      )}
    </div>
  );
}

function ReferenceDetails({ style }: { style: ReferenceAnalysis["style"] }) {
  const t = useTranslations("creatives.reference");
  const hasBasics = Boolean(style.canvasRatio || style.background || style.lighting || style.composition || style.typography);
  const hasDetails = hasBasics || style.visibleText.length > 0 || style.elements.length > 0 || style.palette.length > 0;
  if (!hasDetails) return null;

  return (
    <section className="space-y-3 rounded-md border bg-muted/20 p-3">
      <h4 className="font-medium">{t("detailsTitle")}</h4>
      <div className="grid gap-3 sm:grid-cols-2">
        {style.canvasRatio && <Row label={t("canvasRatio")}>{style.canvasRatio}</Row>}
        {style.background && <Row label={t("background")}>{style.background}</Row>}
        {style.lighting && <Row label={t("lighting")}>{style.lighting}</Row>}
        {style.composition && <Row label={t("composition")}>{style.composition}</Row>}
        {style.typography && <Row label={t("typography")}>{style.typography}</Row>}
        {style.layoutPattern && <Row label={t("layoutPattern")}>{style.layoutPattern}</Row>}
        {style.colorMood && <Row label={t("colorMood")}>{style.colorMood}</Row>}
        {style.textDensity && <Row label={t("textDensity")}>{style.textDensity}</Row>}
        {style.brandElements.length > 0 && <Row label={t("brandElements")}><Tags items={style.brandElements} /></Row>}
      </div>
      {style.palette.length > 0 && (
        <Row label={t("palette")}>
          <div className="flex flex-wrap gap-2">
            {style.palette.map((color, index) => (
              <span key={`${color}-${index}`} className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-1 text-xs">
                <span
                  className="h-3 w-3 rounded-full border"
                  style={{ backgroundColor: /^#[0-9a-f]{6}$/i.test(color) ? color : "transparent" }}
                  aria-hidden="true"
                />
                {color}
              </span>
            ))}
          </div>
        </Row>
      )}
      {style.visibleText.length > 0 && (
        <Row label={t("visibleText")}>
          <ul className="list-inside list-disc">
            {style.visibleText.map((text, index) => <li key={`${text}-${index}`}>{text}</li>)}
          </ul>
        </Row>
      )}
      {style.elements.length > 0 && (
        <Row label={t("elements")}>
          <ol className="space-y-2">
            {style.elements.map((element, index) => (
              <li key={`${element.element}-${index}`} className="rounded-md bg-muted/40 p-2">
                <p className="font-medium">
                  {element.element || t("element")}
                  {element.layerOrder !== null ? ` · ${t("layerOrder")} ${element.layerOrder}` : ""}
                </p>
                {element.relativePosition && <p>{t("relativePosition")}: {element.relativePosition}</p>}
                {element.relativeSize && <p>{t("relativeSize")}: {element.relativeSize}</p>}
                {element.visualAttributes && <p>{t("appearance")}: {element.visualAttributes}</p>}
                {element.exactText && <p>{t("elementText")}: {element.exactText}</p>}
              </li>
            ))}
          </ol>
        </Row>
      )}
      {style.notes && <Row label={t("analysisNotes")}>{style.notes}</Row>}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
function Tags({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((i) => (
        <Badge key={i} variant="outline">
          {i}
        </Badge>
      ))}
    </div>
  );
}
