"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Lock, Save } from "lucide-react";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLlmSettings, useUpdateLlmSettings } from "@/hooks/use-api";
import type { LlmProvider, LlmTierSettings, LlmTierUpdateInput } from "@/types";

type TierName = "fast" | "strong";
type Draft = { provider: LlmProvider; model: string; baseUrl: string; apiKey: string; headers: string; clearKey: boolean; clearHeaders: boolean };

function createDraft(value: LlmTierSettings): Draft {
  return { provider: value.provider, model: value.model, baseUrl: value.baseUrl ?? "", apiKey: "", headers: "", clearKey: false, clearHeaders: false };
}

function TierCard({ name, value, onSave, busy }: { name: TierName; value: LlmTierSettings; onSave: (patch: LlmTierUpdateInput) => Promise<void>; busy: boolean }) {
  const t = useTranslations("llm");
  const [draft, setDraft] = useState(() => createDraft(value));
  useEffect(() => setDraft(createDraft(value)), [value]);
  const dirty = draft.provider !== value.provider || draft.model !== value.model || draft.baseUrl !== (value.baseUrl ?? "") || Boolean(draft.apiKey) || draft.clearKey || Boolean(draft.headers) || draft.clearHeaders;
  const patch = async () => {
    if (!draft.model.trim()) {
      toast.error(t("modelRequired"));
      return;
    }
    if (draft.provider !== "mock" && !draft.apiKey && !value.keyConfigured) {
      toast.error(t("apiKeyRequired"));
      return;
    }
    if (draft.provider === "custom" && !draft.baseUrl.trim()) {
      toast.error(t("customBaseUrlRequired"));
      return;
    }
    let extraHeaders: Record<string, string> | null | undefined;
    if (draft.clearHeaders) extraHeaders = null;
    else if (draft.headers.trim()) {
      try {
        const parsed: unknown = JSON.parse(draft.headers);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || Object.values(parsed).some((v) => typeof v !== "string")) throw new Error();
        extraHeaders = parsed as Record<string, string>;
      } catch {
        toast.error(t("headersInvalid"));
        return;
      }
    }
    const body: LlmTierUpdateInput = {
      provider: draft.provider,
      model: draft.model.trim(),
      baseUrl: draft.baseUrl.trim() || null,
      ...(draft.apiKey ? { apiKey: draft.apiKey } : {}),
      ...(draft.clearKey ? { apiKey: null } : {}),
      ...(extraHeaders !== undefined ? { extraHeaders } : {}),
    };
    await onSave(body);
  };

  const providerLabels: Record<LlmProvider, string> = {
    mock: t("mock"), openai: t("openai"), claude: t("claude"), groq: t("groq"),
    gemini: t("gemini"), deepseek: t("deepseek"), mistral: t("mistral"),
    openrouter: t("openrouter"), together: t("together"), fireworks: t("fireworks"),
    perplexity: t("perplexity"), xai: t("xai"), custom: t("custom"),
  };
  const keySourceLabel = value.keySource === "workspace" ? t("workspaceKey") : value.keySource === "environment" ? t("environmentKey") : t("noKey");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{name === "fast" ? t("fastTier") : t("strongTier")}</CardTitle>
          <Badge variant={value.provider === "mock" ? "secondary" : "default"}>{providerLabels[value.provider]}</Badge>
        </div>
        <CardDescription>{name === "fast" ? t("fastDescription") : t("strongDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t("provider")}</Label>
          <Select value={draft.provider} onValueChange={(provider) => setDraft((d) => ({ ...d, provider: provider as LlmProvider }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["mock", "openai", "claude", "groq", "gemini", "deepseek", "mistral", "openrouter", "together", "fireworks", "perplexity", "xai", "custom"] as const).map((provider) => <SelectItem key={provider} value={provider}>{providerLabels[provider]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{t("model")}</Label>
          <Input value={draft.model} onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))} placeholder={t("modelPlaceholder")} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="flex items-center gap-1.5">{t("apiKey")} <Lock className="h-3 w-3 text-muted-foreground" /></Label>
          <Input type="password" autoComplete="new-password" value={draft.apiKey} onChange={(e) => setDraft((d) => ({ ...d, apiKey: e.target.value, clearKey: false }))} placeholder={value.keySource === "workspace" ? t("keyAlreadySet") : t("keyPlaceholder")} />
          <p className="text-xs text-muted-foreground">{keySourceLabel}. {t("keyStorage")}</p>
          {value.keySource === "workspace" && <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => setDraft((d) => ({ ...d, apiKey: "", clearKey: true }))}>{draft.clearKey ? t("keyWillClear") : t("clearKey")}</Button>}
        </div>
        {draft.provider !== "mock" && (
          <>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("baseUrl")}</Label>
              <Input value={draft.baseUrl} onChange={(e) => setDraft((d) => ({ ...d, baseUrl: e.target.value }))} placeholder={draft.provider === "claude" ? t("anthropicBaseUrlPlaceholder") : t("providerBaseUrlPlaceholder")} />
              <p className="text-xs text-muted-foreground">{t("baseUrlHint")}</p>
            </div>
            {draft.provider !== "claude" && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{t("extraHeaders")}</Label>
                <textarea className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={draft.headers} onChange={(e) => setDraft((d) => ({ ...d, headers: e.target.value, clearHeaders: false }))} placeholder='{"HTTP-Referer":"https://your-site.example"}' />
                <p className="text-xs text-muted-foreground">{value.extraHeadersSource === "workspace" ? t("headersAlreadySet") : value.extraHeadersSource === "environment" ? t("headersFromEnvironment") : t("headersHint")}</p>
                {value.extraHeadersSource === "workspace" && <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => setDraft((d) => ({ ...d, headers: "", clearHeaders: true }))}>{draft.clearHeaders ? t("headersWillClear") : t("clearHeaders")}</Button>}
              </div>
            )}
          </>
        )}
      </CardContent>
      <CardFooter>
        <Button size="sm" onClick={() => void patch()} disabled={!dirty || busy}>
          <Save className="me-2 h-4 w-4" />{busy ? t("saving") : t("save")}
        </Button>
      </CardFooter>
    </Card>
  );
}

export function LlmSettingsView() {
  const t = useTranslations("llm");
  const query = useLlmSettings();
  const update = useUpdateLlmSettings();
  const save = async (tier: TierName, patch: LlmTierUpdateInput) => {
    try {
      await update.mutateAsync({ [tier]: patch });
      toast.success(t("saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("saveFailed"));
    }
  };
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title={t("title")} description={t("description")} />
      <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">{t("workspaceNotice")}</div>
      <AsyncBoundary {...query} onRetry={() => query.refetch()} isEmpty={() => false}>
        {(settings) => <div className="space-y-4">
          {!settings.encryptionKeyConfigured && <p className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{t("devEncryptionNotice")}</p>}
          <TierCard name="fast" value={settings.fast} busy={update.isPending} onSave={(patch) => save("fast", patch)} />
          <TierCard name="strong" value={settings.strong} busy={update.isPending} onSave={(patch) => save("strong", patch)} />
        </div>}
      </AsyncBoundary>
    </div>
  );
}
