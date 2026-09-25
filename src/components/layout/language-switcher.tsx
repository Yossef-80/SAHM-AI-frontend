"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { setLocale } from "@/i18n/actions";
import type { AppLocale } from "@/i18n/config";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const change = (next: AppLocale) => {
    if (next === locale) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size={compact ? "icon" : "sm"} disabled={pending} aria-label={t("language")}>
          <Languages className="h-4 w-4" />
          {!compact && <span className="ms-2">{locale === "ar" ? t("arabic") : t("english")}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => change("en")}>{t("english")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => change("ar")}>{t("arabic")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
