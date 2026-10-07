"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { AuthFormShell, AuthSubmit, Field, PasswordInput, isEmail } from "@/components/auth/auth-form";

type Errors = { email?: string; password?: string };

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const authStatus = useAuthStore((s) => s.status);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (authStatus === "authenticated") router.replace("/");
  }, [authStatus, router]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Errors = {};
    if (!email.trim()) nextErrors.email = t("emailRequired");
    else if (!isEmail(email)) nextErrors.email = t("emailInvalid");
    if (!password) nextErrors.password = t("passwordRequired");
    setErrors(nextErrors);
    setServerError(null);
    if (Object.keys(nextErrors).length) return;

    setPending(true);
    try {
      await api.login({ email: email.trim(), password });
      const target = next.startsWith("/") && !next.startsWith("//") ? next : "/";
      router.replace(target);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : t("unexpectedError"));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthFormShell
      title={t("loginTitle")}
      subtitle={t("loginSubtitle")}
      onSubmit={submit}
      pending={pending}
      serverError={serverError}
      footer={
        <>
          <AuthSubmit pending={pending} label={t("submitLogin")} pendingLabel={t("working")} />
          <p className="text-center text-xs text-muted-foreground">{t("oauthDeferred")}</p>
          <p className="text-center text-sm">
            <span className="text-muted-foreground">{t("passwordResetDeferred")}</span>
          </p>
          <p className="text-center text-sm text-muted-foreground">
            {t("noAccount")}{" "}
            <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
              {t("createAccount")}
            </Link>
          </p>
        </>
      }
    >
      <Field label={t("email")} error={errors.email}>
        {(id, invalid) => (
          <input
            id={id}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            aria-invalid={invalid}
            onChange={(e) => setEmail(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 aria-[invalid=true]:border-destructive"
          />
        )}
      </Field>
      <Field label={t("password")} error={errors.password}>
        {(id, invalid) => (
          <PasswordInput
            id={id}
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            invalid={invalid}
            showLabel={t("showPassword")}
            hideLabel={t("hidePassword")}
          />
        )}
      </Field>
    </AuthFormShell>
  );
}
