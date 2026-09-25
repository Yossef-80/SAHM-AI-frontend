"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUiStore } from "@/store/ui-store";
import { useCampaigns } from "@/hooks/use-api";
import { AsyncBoundary } from "./async-boundary";

/**
 * Mounted once in the app shell. Renders the human-in-the-loop dialogs requested
 * by the action registry: (1) before/after confirmation, (2) campaign picker.
 */
export function ActionDialogs() {
  return (
    <>
      <ConfirmDialog />
      <PickCampaignDialog />
    </>
  );
}

function ConfirmDialog() {
  const t = useTranslations("actions");
  const tc = useTranslations("common");
  const req = useUiStore((s) => s.confirm);
  const resolve = useUiStore((s) => s.resolveConfirm);

  return (
    <Dialog open={!!req} onOpenChange={(open) => !open && resolve(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{req?.title ?? t("confirmTitle")}</DialogTitle>
          <DialogDescription>{req?.description ?? t("confirmDescription")}</DialogDescription>
        </DialogHeader>
        {req && req.diff.length > 0 ? (
          <div className="overflow-hidden rounded-md border text-sm">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>{tc("before")}</span>
              <span />
              <span>{tc("after")}</span>
            </div>
            {req.diff.map((d) => (
              <div key={d.field} className="border-b px-3 py-2 last:border-b-0">
                <p className="mb-1 text-xs text-muted-foreground">{d.label}</p>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <span className="rounded bg-destructive/10 px-2 py-1 text-destructive line-through">{String(d.before ?? "—")}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
                  <span className="rounded bg-green-500/10 px-2 py-1 font-medium text-green-700 dark:text-green-400">{String(d.after ?? "—")}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("noChanges")}</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => resolve(false)}>
            {tc("cancel")}
          </Button>
          <Button onClick={() => resolve(true)}>{req?.confirmLabel ?? t("confirmApply")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PickCampaignDialog() {
  const t = useTranslations("actions");
  const tc = useTranslations("common");
  const req = useUiStore((s) => s.pickCampaign);
  const resolve = useUiStore((s) => s.resolvePickCampaign);
  const [selected, setSelected] = useState<string>("");
  const q = useCampaigns();

  return (
    <Dialog
      open={!!req}
      onOpenChange={(open) => {
        if (!open) {
          resolve(null);
          setSelected("");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{req?.title ?? t("pickCampaignTitle")}</DialogTitle>
          <DialogDescription>{t("pickCampaignDescription")}</DialogDescription>
        </DialogHeader>
        <AsyncBoundary {...q} onRetry={() => q.refetch()}>
          {(campaigns) => (
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger>
                <SelectValue placeholder={tc("select")} />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </AsyncBoundary>
        <DialogFooter>
          <Button variant="outline" onClick={() => resolve(null)}>
            {tc("cancel")}
          </Button>
          <Button
            disabled={!selected}
            onClick={() => {
              resolve(selected);
              setSelected("");
            }}
          >
            {tc("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
