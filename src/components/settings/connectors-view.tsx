"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, Lock, RotateCcw, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { useConnectorSettings, useDeleteConnector, useUpdateConnector } from "@/hooks/use-api";
import { useAuthStore } from "@/store/auth-store";
import { describeError } from "@/lib/errors";
import type { Connector, ConnectorField } from "@/types";

/** A blank string means "the user typed nothing"; only that clears the field. */
type Draft = Record<string, string>;

const draftKey = (connector: string, field: string) => `${connector}.${field}`;

/** Backend field keys are snake_case; PATCH bodies use the public camelCase API contract. */
const connectorPatchKey = (field: string) =>
  field.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());

/**
 * Providers that only return placeholder data.
 *
 * The backend refuses to store a credential under one of these (it would never
 * be read), and this list keeps the form from submitting that request at all --
 * the user gets the reason next to the field instead of after a round trip.
 */
const PLACEHOLDER_PROVIDERS = new Set(["mock", "none"]);

const isPlaceholderProvider = (value: string | null | undefined) =>
  !value || PLACEHOLDER_PROVIDERS.has(value.trim().toLowerCase());

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
  providers,
  draft,
  canEdit,
  busy,
  error,
  onChange,
  onClear,
  labels,
}: {
  connector: string;
  field: ConnectorField;
  /** Accepted provider values for this connector; empty when it has no selector. */
  providers: string[];
  draft: string;
  canEdit: boolean;
  busy: boolean;
  error?: string;
  onChange: (v: string) => void;
  onClear: () => void;
  labels: { source: (s: string) => string; configured: string; notConfigured: string; inherited: string; required: string };
}) {
  const t = useTranslations("connectors");
  const id = `connector-${draftKey(connector, field.key)}`;
  const touched = draft.trim() !== "";
  // The provider is a closed set on the server, so it is a select here: a
  // free-text box let "OpenAI" or the model id be typed in, which saved fine and
  // then left image generation disabled with no explanation.
  const asSelect = field.key === "provider" && providers.length > 0;
  const selectValue = draft || (field.value ?? "");

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

      {asSelect ? (
        <Select
          value={selectValue}
          disabled={!canEdit || busy}
          onValueChange={(value) => onChange(value === "__unset__" ? "" : value)}
        >
          <SelectTrigger id={id} aria-label={field.label}>
            <SelectValue placeholder={t("selectProvider")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__unset__">{t("selectProvider")}</SelectItem>
            {providers.map((provider) => (
              <SelectItem key={provider} value={provider}>
                {provider}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.secret ? (
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

      {error && (
        <p className="flex items-start gap-1.5 text-[11px] font-medium text-destructive">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
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
  /** Set when a save would store a credential the selected provider never reads. */
  const [fieldError, setFieldError] = useState<string | null>(null);

  const busy = update.isPending || remove.isPending;
  const patchKeys = Object.keys(draft);
  const dirty = patchKeys.length > 0;

  // Clear local edits whenever the server copy changes (save, refetch, switch).
  useEffect(() => {
    setDraft({});
    setFieldError(null);
  }, [connector]);

  const providerField = connector.fields.find((f) => f.key === "provider");
  const effectiveProvider = (draft.provider ?? providerField?.value ?? connector.provider ?? "").trim();
  const providerIsPlaceholder = Boolean(providerField) && isPlaceholderProvider(effectiveProvider);
  // Credential fields the user just edited while the provider is still a
  // placeholder: the backend would store them and never read them.
  const orphanedCredentials = providerIsPlaceholder
    ? connector.fields.filter((f) => f.key !== "provider" && f.key in draft)
    : [];
  // A stored credential under a placeholder provider is the same mistake made
  // earlier (or inherited from the environment) — say so instead of leaving a
  // "saved" badge on a connector that cannot generate anything.
  const storedCredentials = providerIsPlaceholder
    ? connector.fields.filter((f) => f.key !== "provider" && (f.hasValue || Boolean(f.value)))
    : [];

  const save = async () => {
    if (orphanedCredentials.length > 0) {
      const names = orphanedCredentials.map((f) => f.label).join("، ");
      setFieldError(
        t("providerRequired", { provider: effectiveProvider || t("selectProvider"), fields: names }),
      );
      return;
    }
    setFieldError(null);
    const body: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(draft)) {
      body[connectorPatchKey(key)] = value.trim() === "" ? null : value.trim();
    }
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
            <Badge
              variant={connector.configured ? "default" : "outline"}
              title={
                !connector.configured && connector.missingRequired.length > 0
                  ? t("missingRequired", { fields: connector.missingRequired.join(", ") })
                  : undefined
              }
            >
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
        {providerIsPlaceholder && storedCredentials.length > 0 && (
          <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
            {t("orphanedCredentials", {
              provider: effectiveProvider || t("selectProvider"),
              fields: storedCredentials.map((f) => f.label).join("، "),
            })}
          </p>
        )}
        {connector.fields.map((field) => (
          <FieldRow
            key={field.key}
            connector={connector.connector}
            field={field}
            providers={connector.providers}
            draft={draft[field.key] ?? ""}
            canEdit={canEdit}
            busy={busy}
            error={field.key === "provider" ? (fieldError ?? undefined) : undefined}
            onChange={(v) => {
              setFieldError(null);
              setDraft((d) => ({ ...d, [field.key]: v }));
            }}
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
        isPending={query.isPending}
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
