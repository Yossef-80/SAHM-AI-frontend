"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";

export default function AuthCodeErrorPage() {
  const t = useTranslations("auth");

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-1.5 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{t("authErrorTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("authErrorDescription")}</p>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
          <p className="text-sm text-destructive">
            {t("authCodeError")}
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          >
            {t("tryAgain")}
          </Link>
        </div>
      </div>
    </main>
  );
}