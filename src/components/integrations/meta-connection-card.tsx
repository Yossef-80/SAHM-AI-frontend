"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, Loader2, PlugZap, XCircle, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { useMetaConnection } from "@/hooks/use-api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MetaConnection, MetaConnectionStatus } from "@/types";

const STATES: Record<MetaConnectionStatus, { icon: LucideIcon; tone: string; busy?: boolean }> = {
  not_connected: { icon: PlugZap, tone: "text-muted-foreground bg-muted" },
  connecting: { icon: Loader2, tone: "text-primary bg-primary/10", busy: true },
  connected: { icon: CheckCircle2, tone: "text-green-700 bg-green-500/15 dark:text-green-400" },
  needs_reauth: { icon: AlertTriangle, tone: "text-amber-700 bg-amber-500/15 dark:text-amber-400" },
  error: { icon: XCircle, tone: "text-destructive bg-destructive/15" },
};

/** Meta credentials are managed by a workspace owner in Settings → Connectors. */
export function MetaConnectionCard() {
  const t = useTranslations("integrations.meta");
  const q = useMetaConnection();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <CardDescription>{t("desc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <AsyncBoundary {...q} onRetry={() => q.refetch()} skeleton={<Skeleton className="h-32 w-full" />} isEmpty={() => false}>
          {(conn) => <StateView conn={conn} />}
        </AsyncBoundary>
      </CardContent>
    </Card>
  );
}

function StateView({ conn }: { conn: MetaConnection }) {
  const t = useTranslations("integrations.meta");
  const locale = useLocale();
  const s = STATES[conn.status];
  const Icon = s.icon;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", s.tone)}>
          <Icon className={cn("h-5 w-5", s.busy && "animate-spin")} />
        </span>
        <div className="flex-1">
          <p className="font-medium">{t(`states.${conn.status}.title`)}</p>
          <p className="text-sm text-muted-foreground">{conn.errorMessage ?? t(`states.${conn.status}.desc`)}</p>
        </div>
      </div>

      {(conn.status === "connected" || conn.status === "needs_reauth") && (
        <dl className="grid gap-3 rounded-md border p-3 text-sm sm:grid-cols-2">
          <Field label={t("account")}>{conn.accountName ?? conn.accountId ?? "—"}</Field>
          <Field label={t("page")}>
            <Badge variant={conn.pageConfigured ? "default" : "outline"}>
              {conn.pageConfigured ? t("pageConfigured") : t("pageMissing")}
            </Badge>
          </Field>
          <Field label={t("connectedAt")}>{conn.connectedAt ? formatDate(conn.connectedAt, locale) : "—"}</Field>
          <Field label={t("expiresAt")}>{conn.expiresAt ? formatDate(conn.expiresAt, locale) : "—"}</Field>
          <Field label={t("permissions")}>
            <div className="flex flex-wrap gap-1">
              {conn.permissions.length ? conn.permissions.map((p) => (
                <Badge key={p} variant="secondary" className="font-mono text-[11px]">{p}</Badge>
              )) : <span className="text-muted-foreground">—</span>}
            </div>
          </Field>
        </dl>
      )}

      <p className="text-xs text-muted-foreground">{t("adminManaged")}</p>
      <Button asChild variant={conn.campaignReady ? "outline" : "default"}>
        <Link href="/settings/connectors">{t("manageSettings")}</Link>
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
