"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAssistantStore } from "@/store/assistant-store";

export function AskAiHero() {
  const t = useTranslations("home");
  const ta = useTranslations("app");
  const router = useRouter();
  const setPendingPrompt = useAssistantStore((s) => s.setPendingPrompt);
  const [value, setValue] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = value.trim();
    if (!text) return;
    setPendingPrompt({ text, context: [] });
    router.push("/assistant");
  };

  return (
    <section className="rounded-xl border bg-gradient-to-br from-primary/10 via-background to-background p-6 md:p-10">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Sparkles className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{t("heroTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{ta("tagline")}</p>
        <form onSubmit={submit} className="mt-6 flex gap-2">
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={t("heroPlaceholder")} className="h-11 bg-background" aria-label={t("ask")} />
          <Button type="submit" size="lg" className="h-11" disabled={!value.trim()}>
            <ArrowUp className="h-4 w-4 sm:me-2" />
            <span className="hidden sm:inline">{t("ask")}</span>
          </Button>
        </form>
      </div>
    </section>
  );
}
