"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ActionButton } from "@/components/shared/action-button";
import type { Creative } from "@/types";

interface Props {
  creative: Creative | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Editing saved ad copy.
 *
 * The edit is not just a text change: the backend diffs it against what was
 * stored and keeps the before/after pair as brand-voice memory. That is why this
 * goes through the UPDATE_CREATIVE_TEXT action rather than a local mutation — a
 * save that only updated the row would lose the lesson.
 */
export function EditCopyDialog({ creative, onOpenChange }: Props) {
  const t = useTranslations("creatives.textTools");
  const tc = useTranslations("common");
  const [text, setText] = useState("");

  useEffect(() => {
    setText(creative?.prompt ?? creative?.primaryText ?? "");
  }, [creative]);

  const open = creative !== null;
  const changed = text.trim().length > 0 && text.trim() !== (creative?.prompt ?? "").trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("editCopyTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="edit-copy-text">{t("editCopyLabel")}</Label>
          <Textarea
            id="edit-copy-text"
            rows={10}
            value={text}
            onChange={(event) => setText(event.target.value)}
            dir="auto"
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">{t("editCopyHint")}</p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("close")}
          </Button>
          <ActionButton
            disabled={!changed}
            onDone={(ok) => ok && onOpenChange(false)}
            action={{
              type: "UPDATE_CREATIVE_TEXT",
              payload: { creativeId: creative?.id ?? "", text: text.trim() },
            }}
          >
            {t("saveCopyEdit")}
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
