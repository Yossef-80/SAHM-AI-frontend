"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { useBrandProfile, useBusiness, useSettings, useUpdateSettings } from "@/hooks/use-api";
import type { Settings } from "@/types";

const useMocks = (process.env.NEXT_PUBLIC_USE_MOCKS ?? "true") !== "false";

export function SettingsView() {
  const t = useTranslations("settings");
  const settings = useSettings();
  const update = useUpdateSettings();
  const business = useBusiness();
  const brand = useBrandProfile();

  const save = (patch: Partial<Settings>) => update.mutate(patch, { onSuccess: () => toast.success(t("saved")), onError: (e) => toast.error(e.message) });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("title")} />
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("general")}</CardTitle>
          </CardHeader>
          <CardContent>
            <AsyncBoundary {...settings} onRetry={() => settings.refetch()} isEmpty={() => false}>
              {(s) => (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>{t("language")}</Label>
                    <div>
                      <LanguageSwitcher />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("currency")}</Label>
                    <Select value={s.currency} onValueChange={(currency) => save({ currency })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["EGP", "USD", "SAR", "AED", "EUR"].map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("timezone")}</Label>
                    <Select value={s.timezone} onValueChange={(timezone) => save({ timezone })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["Africa/Cairo", "Asia/Riyadh", "Asia/Dubai", "Europe/London", "UTC"].map((z) => (
                          <SelectItem key={z} value={z}>
                            {z}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("dataSource")}</Label>
                    <div>
                      <Badge variant={useMocks ? "secondary" : "default"}>{useMocks ? t("mock") : t("live")}</Badge>
                    </div>
                  </div>
                </div>
              )}
            </AsyncBoundary>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("notifications")}</CardTitle>
          </CardHeader>
          <CardContent>
            <AsyncBoundary {...settings} onRetry={() => settings.refetch()} isEmpty={() => false}>
              {(s) => (
                <div className="space-y-3">
                  {(["email", "criticalInsights", "weeklyDigest"] as const).map((k) => (
                    <div key={k} className="flex items-center justify-between">
                      <Label htmlFor={k}>{t(k)}</Label>
                      <Switch id={k} checked={s.notifications[k]} disabled={update.isPending} onCheckedChange={(v) => save({ notifications: { ...s.notifications, [k]: v } })} />
                    </div>
                  ))}
                </div>
              )}
            </AsyncBoundary>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("business")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <AsyncBoundary {...business} onRetry={() => business.refetch()} isEmpty={() => false}>
              {(b) => (
                <div>
                  <p className="font-medium">{b.name}</p>
                  <p className="text-muted-foreground">
                    {b.industry} · {b.country}
                  </p>
                  <p className="mt-1">{b.description}</p>
                </div>
              )}
            </AsyncBoundary>
            <AsyncBoundary {...brand} onRetry={() => brand.refetch()} isEmpty={() => false}>
              {(bp) => (
                <div className="space-y-2 border-t pt-3">
                  <p className="text-xs font-medium uppercase text-muted-foreground">{t("brand")}</p>
                  <Row label={t("tone")} items={bp.tone} />
                  <Row label={t("values")} items={bp.values} />
                  <Row label={t("doNotUse")} items={bp.doNotUse} />
                </div>
              )}
            </AsyncBoundary>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="me-1 text-xs text-muted-foreground">{label}:</span>
      {items.map((i) => (
        <Badge key={i} variant="outline">
          {i}
        </Badge>
      ))}
    </div>
  );
}
