"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export default function ResetPasswordPage() {
  const t = useTranslations("auth");
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-4 rounded-xl border bg-card p-6 text-center shadow-sm">
        <h1 className="text-2xl font-semibold">{t("resetPasswordTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("passwordResetDeferred")}</p>
        <Link href="/login" className="inline-block text-sm text-primary underline">{t("signIn")}</Link>
      </div>
    </main>
  );
}
