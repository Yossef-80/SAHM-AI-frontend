"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Lock, RotateCcw, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { useConnectorSettings, useDeleteConnector, useUpdateConnector } from "@/hooks/use-api";
import { useAuthStore } from "@/store/auth-store";
import { describeError } from "@/lib/errors";
import type { Connector, ConnectorField } from "@/types";

/** A blank string means "the user typed nothing"; only that clears the field. */
type Draft = Record<string, string>;

const draftKey = (connector: string, field: string) => `${connector}.${field}`;

/**
 * Secrets are write-only by design: the backend returns `value: null` for every
 * `secret: true` field and reports `hasValue`/`masked` instead. So a secret row
 * renders an **empty** password input plus a status line. A field left empty is
 * simply omitted from the patch — it never clears the stored secret by accident.
 * Clearing is an explicit button.
 */
function FieldRow({
  connector,
  field,
  draft,
  canEdit,
  busy,
  onChange,
  onClear,
  labels,
}: {
  connector: string;
  field: ConnectorField;
  draft: string;
  canEdit: boolean;
  busy: boolean;
  onChange: (v: string) => void;
  onClear: () => void;
  labels: { source: (s: string) => string; configured: string; notConfigured: string; inherited: string; required: string };
}) {
  const t = useTranslations("connectors");
  const id = `connector-${draftKey(connector, field.key)}`;
  const touched = draft.trim() !== "";

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id} className="flex items-center gap-1.5">
          {field.label}
          {field.required && <span className="text-destructive">*</span>}
          {field.secret && <Lock className="h-3 w-3 text-muted-foreground" />}
        </Label>
        <div className="flex items-center gap-1.5">
          <Badge variant={field.source === "workspace" ? "default" : "secondary"} className="text-[10px]">
            {labels.source(field.source)}
          </Badge>
          {field.required && <Badge variant="outline" className="text-[10px]">{labels.required}</Badge>}
        </div>
      </div>

      {field.secret ? (
        <Input
          id={id}
          type="password"
          autoComplete="new-password"
          disabled={!canEdit || busy}
          value={draft}
          placeholder={field.hasValue ? (field.masked ?? "••••••••") : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          id={id}
          disabled={!canEdit || busy}
          value={draft}
          placeholder={field.value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          {field.description ? `${field.description} · ` : ""}
          {field.hasValue
            ? field.secret
              ? field.source === "workspace"
                ? labels.configured
                : labels.inherited
              : ""
            : labels.notConfigured}
        </p>
        {touched && canEdit && (
          <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={onClear} disabled={busy}>
            <RotateCcw className="me-1 h-3 w-3" />
            {t("clear")}
          </Button>
        )}
      </div>
    </div>
  );
}

function ConnectorCard({
  connector,
  canEdit,
  labels,
}: {
  connector: Connector;
  canEdit: boolean;
  labels: { source: (s: string) => string; configured: string; notConfigured: string; inherited: string; required: string };
}) {
  const t = useTranslations("connectors");
  const update = useUpdateConnector();
  const remove = useDeleteConnector();
  const te = useTranslations("errors");
  const [draft, setDraft] = useState<Draft>({});

  const busy = update.isPending || remove.isPending;
  const patchKeys = Object.keys(draft);
  const dirty = patchKeys.length > 0;

  // Clear local edits whenever the server copy changes (save, refetch, switch).
  useEffect(() => {
    setDraft({});
  }, [connector]);

  const save = async () => {
    const body: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(draft)) body[key] = value.trim() === "" ? null : value.trim();
    if (!Object.keys(body).length) return;
    try {
      await update.mutateAsync({ connector: connector.connector, patch: body });
      setDraft({});
      toast.success(t("saved", { name: connector.label }));
    } catch (error) {
      toast.error(describeError(error, te));
    }
  };

  const reset = async () => {
    try {
      await remove.mutateAsync(connector.connector);
      toast.success(t("resetDone", { name: connector.label }));
    } catch (error) {
      toast.error(describeError(error, te));
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{connector.label}</CardTitle>
            {connector.provider && <CardDescription className="mt-1">{connector.provider}</CardDescription>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={connector.configured ? "default" : "outline"}>
              {connector.configured ? labels.configured : labels.notConfigured}
            </Badge>
            {connector.placeholder && <Badge variant="secondary">{t("placeholder")}</Badge>}
          </div>
        </div>
        {connector.notes && <CardDescription className="mt-2">{connector.notes}</CardDescription>}
      </CardHeader>

      <CardContent className="space-y-4">
        {!canEdit && (
          <p className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {t("readOnlyRole")}
          </p>
        )}
        {connector.fields.map((field) => (
          <FieldRow
            key={field.key}
            connector={connector.connector}
            field={field}
            draft={draft[field.key] ?? ""}
            canEdit={canEdit}
            busy={busy}
            onChange={(v) => setDraft((d) => ({ ...d, [field.key]: v }))}
            onClear={() => setDraft((d) => ({ ...d, [field.key]: "" }))}
            labels={labels}
          />
        ))}
      </CardContent>

      <CardFooter className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => void save()} disabled={!dirty || !canEdit || busy}>
          <Save className="me-2 h-4 w-4" />
          {update.isPending ? t("saving") : t("save")}
        </Button>
        <Button size="sm" variant="outline" onClick={() => void reset()} disabled={!canEdit || busy || !connector.hasOverride}>
          <RotateCcw className="me-2 h-4 w-4" />
          {t("reset")}
        </Button>
        <span className="text-xs text-muted-foreground">{t("resetHint")}</span>
      </CardFooter>
    </Card>
  );
}

export function ConnectorsView() {
  const t = useTranslations("connectors");
  const query = useConnectorSettings();
  const role = useAuthStore((s) => s.activeRole);
  // P1.7 role matrix: connector settings are owner-only on the server too.
  const canEdit = role === null || role === "owner";

  const labels = {
    source: (s: string) => t(`source.${s}` as "source.workspace"),
    configured: t("configured"),
    notConfigured: t("notConfigured"),
    inherited: t("inherited"),
    required: t("required"),
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("title")} description={t("description")} />
      <AsyncBoundary
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        data={query.data}
        isEmpty={() => (query.data?.connectors.length ?? 0) === 0}
        onRetry={() => void query.refetch()}
        emptyTitle={t("emptyTitle")}
        emptyDescription={t("emptyDescription")}
        skeleton={<div className="h-72" />}
      >
        {(data) => (
          <div className="space-y-4">
            {!data.encryptionKeyConfigured && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {t("noEncryptionKey")}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {t("summary", { environment: data.environment, count: data.overrideCount })}
            </p>
            {data.connectors.map((connector) => (
              <ConnectorCard key={connector.connector} connector={connector} canEdit={canEdit} labels={labels} />
            ))}
          </div>
        )}
      </AsyncBoundary>
    </div>
  );
}
