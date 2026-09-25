"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { ArrowUp, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ContextChips } from "./context-chips";

export function Composer({ onSend, onStop, disabled }: { onSend: (text: string) => void; onStop: () => void; disabled: boolean }) {
  const t = useTranslations("assistant");
  const [value, setValue] = useState("");

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2 rounded-lg border bg-card p-3">
      <ContextChips />
      <div className="flex items-end gap-2">
        <Textarea value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={onKey} placeholder={t("placeholder")} rows={2} className="min-h-[44px] resize-none" aria-label={t("placeholder")} />
        {disabled ? (
          <Button type="button" variant="outline" size="icon" onClick={onStop} aria-label={t("stop")}>
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="submit" size="icon" disabled={!value.trim()} aria-label={t("send")}>
            <ArrowUp className="h-4 w-4" />
          </Button>
        )}
      </div>
    </form>
  );
}
