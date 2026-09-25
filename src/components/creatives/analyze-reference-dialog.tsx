"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, ScanSearch, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { ActionButton } from "@/components/shared/action-button";
import { useAnalyzeReference } from "@/hooks/use-api";
import { CreativeKindSchema, type CreativeKind, type ReferenceAnalysis } from "@/types";

export function AnalyzeReferenceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("creatives.reference");
  const tk = useTranslations("kind");
  const analyze = useAnalyzeReference();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState<CreativeKind>("video");

  const onFile = (f: File | undefined) => {
    if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = () => setDataUrl(String(reader.result));
    reader.readAsDataURL(f);
  };

  const source = dataUrl ?? url.trim();
  const run = () => analyze.mutate({ source, fileName: fileName ?? undefined, kind });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) analyze.reset();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("desc")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="space-y-2">
            <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <Button type="button" variant="outline" className="w-full justify-start" onClick={() => fileRef.current?.click()}>
              <Upload className="me-2 h-4 w-4" />
              {fileName ?? t("upload")}
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t("orUrl")}</span>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("urlPlaceholder")} disabled={!!dataUrl} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("kind")}</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as CreativeKind)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CreativeKindSchema.options.map((k) => (
                  <SelectItem key={k} value={k}>
                    {tk(k)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={run} disabled={!source || analyze.isPending}>
          {analyze.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <ScanSearch className="me-2 h-4 w-4" />}
          {analyze.isPending ? t("analyzing") : t("analyze")}
        </Button>
        {!source && <p className="text-xs text-muted-foreground">{t("sourceRequired")}</p>}

        {(analyze.isPending || analyze.isError || analyze.data) && (
          <AsyncBoundary isLoading={analyze.isPending} isError={analyze.isError} error={analyze.error} data={analyze.data} onRetry={run}>
            {(a) => <AnalysisResult analysis={a} onCreated={() => onOpenChange(false)} />}
          </AsyncBoundary>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AnalysisResult({ analysis: a, onCreated }: { analysis: ReferenceAnalysis; onCreated: () => void }) {
  const t = useTranslations("creatives.reference");
  return (
    <div className="space-y-4 rounded-lg border p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{a.sourceName}</p>
        <Badge variant={a.estimatedPerformance === "high" ? "default" : "secondary"}>
          {t("estimated")}: {t(a.estimatedPerformance)}
        </Badge>
      </div>
      <Row label={t("hook")}>{a.hook}</Row>
      <Row label={t("structure")}>
        <ol className="list-inside list-decimal">
          {a.structure.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </Row>
      <div className="grid gap-4 sm:grid-cols-2">
        <Row label={t("visualStyle")}>
          <Tags items={a.visualStyle} />
        </Row>
        <Row label={t("tone")}>
          <Tags items={a.tone} />
        </Row>
        <Row label={t("strengths")}>
          <ul className="list-inside list-disc">
            {a.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Row>
        <Row label={t("weaknesses")}>
          <ul className="list-inside list-disc">
            {a.weaknesses.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Row>
      </div>
      <Row label={t("inspiredBrief")}>
        <p className="rounded-md bg-muted p-3">{a.inspiredBrief}</p>
      </Row>
      <ActionButton
        action={{ type: "CREATE_CREATIVE", payload: { kind: a.kind, brief: a.inspiredBrief, referenceAnalysisId: a.id } }}
        label={t("createInspired")}
        onDone={(ok) => ok && onCreated()}
      />
    </div>
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
