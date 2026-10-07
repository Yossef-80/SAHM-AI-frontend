"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { useBusinessProfileForm, useUpdateBusinessProfile } from "@/hooks/use-api";
import { useAuthStore } from "@/store/auth-store";
import { describeError } from "@/lib/errors";
import type { BusinessProfileForm, BusinessProfileUpdateInput } from "@/types";

/** Editable state: scalars become `""` when cleared, lists stay arrays. */
type Draft = Omit<BusinessProfileForm, "monthlyBudget" | "dailyTokenBudget"> & {
  monthlyBudget: string;
  dailyTokenBudget: string;
};

function toDraft(profile: BusinessProfileForm): Draft {
  return {
    ...profile,
    monthlyBudget: profile.monthlyBudget === null ? "" : String(profile.monthlyBudget),
    dailyTokenBudget: profile.dailyTokenBudget === null ? "" : String(profile.dailyTokenBudget),
  };
}

const asText = (value: string | null) => value ?? "";
const asNumber = (value: string) => (value.trim() === "" ? null : Number(value));

/**
 * `PATCH /business/profile` is exclude-unset, so the patch is built by
 * **diffing against what was loaded**, not by sending the whole form. A field
 * the user never touched is absent from the body and therefore untouched
 * server-side. Sending the form wholesale would silently wipe every blank field
 * on every save.
 *
 * "Clear" means something different per column, and the difference is not
 * cosmetic — it is measured against the server:
 *
 * | column group | clear with | why |
 * | --- | --- | --- |
 * | `businesses` scalars (`name`, `industry`, `websiteUrl`, `country`, `currency`) | `null` | nullable columns, `setattr(business, f, None)` is correct |
 * | `brand_profiles` text (`brandVoice`, `visualStyle`, `targetAudience`) | `""` | **not `null`** |
 * | `brand_profiles` lists (`goals`, `keyOffers`, `competitors`) | `[]` | JSON columns, never NULL |
 * | budgets (`monthlyBudget`, `dailyTokenBudget`) | `null` | nullable numeric columns |
 *
 * The text row is the trap: `app/api/business.py:132` normalises `None` to `[]`
 * for every `_PROFILE_FIELDS` member — correct for the JSON list columns, but for
 * the text columns it binds a Python list into a `Text` column and SQLite answers
 * `type 'list' is not supported` → **HTTP 500**. Verified against the live
 * service. `""` is the instruction that actually clears a brand text field, and
 * since the adapter maps `""` back to `null` the form renders it as empty either
 * way.
 */
function buildPatch(original: BusinessProfileForm, draft: Draft): BusinessProfileUpdateInput {
  const patch: BusinessProfileUpdateInput = {};
  const assign = (key: string, value: unknown) => {
    (patch as Record<string, unknown>)[key] = value;
  };

  /** `businesses` row: nullable, so `null` is the clear instruction. */
  const nullable = (key: string, before: string | null, after: string | null) => {
    const trimmed = (after ?? "").trim();
    const next = trimmed === "" ? null : trimmed;
    if (next !== before) assign(key, next);
  };

  /** `brand_profiles` text column: must be `""`, never `null` (see above). */
  const textColumn = (key: string, before: string | null, after: string | null) => {
    const trimmed = (after ?? "").trim();
    if (trimmed !== (before ?? "").trim()) assign(key, trimmed);
  };

  nullable("name", original.name, draft.name);
  nullable("industry", original.industry, draft.industry);
  nullable("websiteUrl", original.websiteUrl, draft.websiteUrl);
  nullable("country", original.country, draft.country);
  nullable("language", original.language, draft.language);
  nullable("currency", original.currency, draft.currency);
  textColumn("brandVoice", original.brandVoice, draft.brandVoice);
  textColumn("visualStyle", original.visualStyle, draft.visualStyle);
  textColumn("targetAudience", original.targetAudience, draft.targetAudience);

  const monthly = asNumber(draft.monthlyBudget);
  if (monthly !== original.monthlyBudget) patch.monthlyBudget = monthly;
  const daily = asNumber(draft.dailyTokenBudget);
  if (daily !== original.dailyTokenBudget) patch.dailyTokenBudget = daily;

  const list: (key: "goals" | "keyOffers" | "competitors", before: string[], after: string[]) => void = (
    key,
    before,
    after,
  ) => {
    const next = after.map((v) => v.trim()).filter(Boolean);
    if (next.length !== before.length || next.some((v, i) => v !== before[i])) patch[key] = next;
  };
  list("goals", original.goals, draft.goals);
  list("keyOffers", original.keyOffers, draft.keyOffers);
  list("competitors", original.competitors, draft.competitors);

  return patch;
}

/** Add/remove rows for a list field. Removing the last row sends `[]` = clear. */
function ListField({
  label,
  description,
  items,
  disabled,
  onChange,
  addLabel,
  removeLabel,
  rowLabel,
}: {
  label: string;
  description: string;
  items: string[];
  disabled: boolean;
  onChange: (next: string[]) => void;
  addLabel: string;
  removeLabel: string;
  rowLabel: string;
}) {
  const rows = items.length ? items : [""];
  return (
    <div className="space-y-2">
      <div>
        <Label>{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              aria-label={`${label} ${index + 1}`}
              value={row}
              disabled={disabled}
              onChange={(e) => {
                const next = [...rows];
                next[index] = e.target.value;
                onChange(next.filter((v, i) => v !== "" || i < rows.length - 1 || rows.length > 1));
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`${removeLabel} ${index + 1}`}
              disabled={disabled || (rows.length === 1 && row === "")}
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => onChange(rows.length === 1 && rows[0] === "" ? [""] : [...rows.filter(Boolean), ""])}
      >
        <Plus className="me-2 h-4 w-4" />
        {addLabel}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        {rowLabel}
      </p>
    </div>
  );
}

function TextField({
  label,
  hint,
  value,
  disabled,
  multiline,
  onChange,
  onClear,
  clearLabel,
}: {
  label: string;
  hint: string;
  value: string;
  disabled: boolean;
  multiline: boolean;
  onChange: (v: string) => void;
  onClear: () => void;
  clearLabel: string;
}): ReactNode {
  const id = `field-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onClear} className="h-7 px-2 text-xs">
          <RotateCcw className="me-1.5 h-3 w-3" />
          {clearLabel}
        </Button>
      </div>
      {multiline ? (
        <Textarea id={id} rows={4} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      )}
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function BusinessProfileForm() {
  const t = useTranslations("settings.profile");
  const te = useTranslations("errors");
  const query = useBusinessProfileForm();
  const save = useUpdateBusinessProfile();
  const role = useAuthStore((s) => s.activeRole);
  // The backend requires owner or member for any profile write (P1.7 role matrix).
  const canEdit = role === null || role === "owner" || role === "member";

  const [draft, setDraft] = useState<Draft | null>(null);
  const [base, setBase] = useState<BusinessProfileForm | null>(null);

  useEffect(() => {
    if (query.data && base === null) {
      setDraft(toDraft(query.data));
      setBase(query.data);
    }
  }, [query.data, base]);

  const patch = useMemo(() => (base && draft ? buildPatch(base, draft) : {}), [base, draft]);
  const dirty = Object.keys(patch).length > 0;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));
  const listSet = (key: "goals" | "keyOffers" | "competitors", next: string[]) => setDraft((d) => (d ? { ...d, [key]: next } : d));

  const submit = async () => {
    try {
      await save.mutateAsync(patch);
      toast.success(t("saved"));
    } catch (error) {
      toast.error(describeError(error, te));
    }
  };

  return (
    <AsyncBoundary
      isLoading={query.isLoading}
      isError={query.isError}
      error={query.error}
      data={query.data}
      isEmpty={() => false}
      onRetry={() => void query.refetch()}
      skeleton={<div className="h-64" />}
    >
      {() =>
        draft && base ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("title")}</CardTitle>
              <CardDescription>{t("description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!canEdit && (
                <p className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  {t("readOnlyRole")}
                </p>
              )}

              <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                <p className="mb-1 font-medium text-foreground">{t("semanticsTitle")}</p>
                <ul className="list-inside list-disc space-y-0.5">
                  <li>{t("semanticsOmit")}</li>
                  <li>{t("semanticsClear")}</li>
                  <li>{t("semanticsList")}</li>
                </ul>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label={t("name")}
                  hint={t("nameHint")}
                  value={draft.name}
                  disabled={!canEdit || save.isPending}
                  multiline={false}
                  onChange={(v) => set("name", v)}
                  onClear={() => set("name", "")}
                  clearLabel={t("clear")}
                />
                <TextField
                  label={t("industry")}
                  hint={t("industryHint")}
                  value={asText(draft.industry)}
                  disabled={!canEdit || save.isPending}
                  multiline={false}
                  onChange={(v) => set("industry", v)}
                  onClear={() => set("industry", null)}
                  clearLabel={t("clear")}
                />
                <TextField
                  label={t("website")}
                  hint={t("websiteHint")}
                  value={asText(draft.websiteUrl)}
                  disabled={!canEdit || save.isPending}
                  multiline={false}
                  onChange={(v) => set("websiteUrl", v)}
                  onClear={() => set("websiteUrl", null)}
                  clearLabel={t("clear")}
                />
                <TextField
                  label={t("country")}
                  hint={t("countryHint")}
                  value={asText(draft.country)}
                  disabled={!canEdit || save.isPending}
                  multiline={false}
                  onChange={(v) => set("country", v.slice(0, 2))}
                  onClear={() => set("country", null)}
                  clearLabel={t("clear")}
                />

                <div className="space-y-1.5">
                  <Label>{t("language")}</Label>
                  <Select value={draft.language || "en"} onValueChange={(v) => set("language", v)} disabled={!canEdit || save.isPending}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ar">العربية</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{t("languageHint")}</p>
                </div>

                <div className="space-y-1.5">
                  <Label>{t("currency")}</Label>
                  <Select
                    value={draft.currency ?? "__none"}
                    onValueChange={(v) => set("currency", v === "__none" ? null : v)}
                    disabled={!canEdit || save.isPending}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">{t("inherit")}</SelectItem>
                      {["EGP", "USD", "SAR", "AED", "EUR", "GBP"].map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{t("currencyHint")}</p>
                </div>

                <TextField
                  label={t("monthlyBudget")}
                  hint={t("monthlyBudgetHint")}
                  value={draft.monthlyBudget}
                  disabled={!canEdit || save.isPending}
                  multiline={false}
                  onChange={(v) => set("monthlyBudget", v)}
                  onClear={() => set("monthlyBudget", "")}
                  clearLabel={t("clear")}
                />
                <TextField
                  label={t("dailyTokenBudget")}
                  hint={t("dailyTokenBudgetHint")}
                  value={draft.dailyTokenBudget}
                  disabled={!canEdit || save.isPending}
                  multiline={false}
                  onChange={(v) => set("dailyTokenBudget", v)}
                  onClear={() => set("dailyTokenBudget", "")}
                  clearLabel={t("clear")}
                />
              </div>

              <div className="space-y-4">
                <TextField
                  label={t("brandVoice")}
                  hint={t("brandVoiceHint")}
                  value={asText(draft.brandVoice)}
                  disabled={!canEdit || save.isPending}
                  multiline
                  onChange={(v) => set("brandVoice", v)}
                  onClear={() => set("brandVoice", "")}
                  clearLabel={t("clear")}
                />
                <TextField
                  label={t("visualStyle")}
                  hint={t("visualStyleHint")}
                  value={asText(draft.visualStyle)}
                  disabled={!canEdit || save.isPending}
                  multiline
                  onChange={(v) => set("visualStyle", v)}
                  onClear={() => set("visualStyle", "")}
                  clearLabel={t("clear")}
                />
                <TextField
                  label={t("targetAudience")}
                  hint={t("targetAudienceHint")}
                  value={asText(draft.targetAudience)}
                  disabled={!canEdit || save.isPending}
                  multiline
                  onChange={(v) => set("targetAudience", v)}
                  onClear={() => set("targetAudience", "")}
                  clearLabel={t("clear")}
                />
              </div>

              <div className="grid gap-6 sm:grid-cols-3">
                <ListField
                  label={t("goals")}
                  description={t("goalsHint")}
                  items={draft.goals}
                  disabled={!canEdit || save.isPending}
                  onChange={(next) => listSet("goals", next)}
                  addLabel={t("addItem")}
                  removeLabel={t("removeItem")}
                  rowLabel={t("listClearHint")}
                />
                <ListField
                  label={t("keyOffers")}
                  description={t("keyOffersHint")}
                  items={draft.keyOffers}
                  disabled={!canEdit || save.isPending}
                  onChange={(next) => listSet("keyOffers", next)}
                  addLabel={t("addItem")}
                  removeLabel={t("removeItem")}
                  rowLabel={t("listClearHint")}
                />
                <ListField
                  label={t("competitors")}
                  description={t("competitorsHint")}
                  items={draft.competitors}
                  disabled={!canEdit || save.isPending}
                  onChange={(next) => listSet("competitors", next)}
                  addLabel={t("addItem")}
                  removeLabel={t("removeItem")}
                  rowLabel={t("listClearHint")}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t pt-4">
                <Button onClick={() => void submit()} disabled={!dirty || !canEdit || save.isPending}>
                  {save.isPending ? t("saving") : t("save")}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDraft(toDraft(base));
                  }}
                  disabled={!dirty || save.isPending}
                >
                  {t("revert")}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {dirty ? t("unsaved", { count: Object.keys(patch).length }) : t("upToDate")}
                </span>
              </div>
            </CardContent>
          </Card>
        ) : null
      }
    </AsyncBoundary>
  );
}
