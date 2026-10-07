"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { AsyncBoundary } from "@/components/shared/async-boundary";
import { useAudit } from "@/hooks/use-api";
import { useAuthStore } from "@/store/auth-store";
import type { AuditFilters } from "@/types";

function Json({ label, value }: { label: string; value: Record<string, unknown> | null }) {
  if (!value || Object.keys(value).length === 0) return null;
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <pre className="max-h-40 overflow-auto rounded bg-muted/50 p-2 text-[11px] leading-relaxed" dir="ltr">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

export function AuditView() {
  const t = useTranslations("audit");
  const role = useAuthStore((s) => s.activeRole);
  // The server enforces owner-only on /audit; the screen says so instead of
  // rendering an empty table that looks like "no activity".
  const isOwner = role === null || role === "owner";

  const [draft, setDraft] = useState<AuditFilters>({ entityType: "", entityId: "", actor: "", action: "" });
  const [applied, setApplied] = useState<AuditFilters>({ limit: 50 });
  const query = useAudit(applied);

  const apply = () =>
    setApplied({
      entityType: draft.entityType?.trim() || undefined,
      entityId: draft.entityId?.trim() || undefined,
      actor: draft.actor?.trim() || undefined,
      action: draft.action?.trim() || undefined,
      limit: 50,
    });

  const reset = () => {
    setDraft({ entityType: "", entityId: "", actor: "", action: "" });
    setApplied({ limit: 50 });
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t("title")} description={t("description")} />

      {!isOwner ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Lock className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">{t("ownerOnlyTitle")}</p>
            <p className="max-w-md text-sm text-muted-foreground">{t("ownerOnlyDescription")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <form
            className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              apply();
            }}
          >
            {(
              [
                ["entityType", t("filterEntityType")],
                ["entityId", t("filterEntityId")],
                ["actor", t("filterActor")],
                ["action", t("filterAction")],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`audit-${key}`}>{label}</Label>
                <Input
                  id={`audit-${key}`}
                  value={draft[key] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                  className="font-mono text-xs"
                />
              </div>
            ))}
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
              <Button type="submit" size="sm">
                {t("applyFilters")}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={reset}>
                {t("clearFilters")}
              </Button>
            </div>
          </form>

          <AsyncBoundary
            isLoading={query.isLoading}
            isError={query.isError}
            error={query.error}
            data={query.data}
            isEmpty={(d) => d.entries.length === 0}
            onRetry={() => void query.refetch()}
            emptyTitle={t("emptyTitle")}
            emptyDescription={t("emptyDescription")}
            skeleton={<div className="h-96" />}
          >
            {(data) => (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">{t("total", { shown: data.entries.length, total: data.total })}</p>
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("when")}</TableHead>
                          <TableHead>{t("actor")}</TableHead>
                          <TableHead>{t("action")}</TableHead>
                          <TableHead>{t("entity")}</TableHead>
                          <TableHead>{t("diff")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.entries.map((entry) => (
                          <TableRow key={entry.id} className="align-top">
                            <TableCell className="whitespace-nowrap text-xs tabular-nums">
                              {entry.createdAt ? entry.createdAt.slice(0, 16).replace("T", " ") : "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={entry.actor === "system" ? "secondary" : "outline"} className="font-mono text-[10px]">
                                {entry.actor}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs font-medium">{entry.action}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {entry.entityType}
                              {entry.entityId ? ` · ${entry.entityId}` : ""}
                            </TableCell>
                            <TableCell>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <Json label={t("before")} value={entry.before} />
                                <Json label={t("after")} value={entry.after} />
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
                <p className="text-[11px] text-muted-foreground">{t("redactionNote")}</p>
              </div>
            )}
          </AsyncBoundary>
        </>
      )}
    </div>
  );
}
