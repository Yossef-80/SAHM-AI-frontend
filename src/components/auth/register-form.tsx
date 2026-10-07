"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { checkPasswordPolicy, MIN_PASSWORD_LENGTH } from "@/types";
import { AuthFormShell, AuthSubmit, Field, PasswordInput, isEmail } from "@/components/auth/auth-form";

type Errors = { email?: string; password?: string; confirm?: string; workspaceName?: string; fullName?: string };

export function RegisterForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const authStatus = useAuthStore((s) => s.status);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fullName, setFullName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
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

    if (!fullName.trim()) nextErrors.fullName = t("fullNameRequired");

    const problem = checkPasswordPolicy(password);
    if (!password) nextErrors.password = t("passwordRequired");
    else if (problem === "length") nextErrors.password = t("passwordTooShort", { min: MIN_PASSWORD_LENGTH });
    else if (problem === "breached") nextErrors.password = t("passwordBreached");
    else if (problem === "whitespace") nextErrors.password = t("passwordWhitespace");

    if (!confirm) nextErrors.confirm = t("confirmRequired");
    else if (confirm !== password) nextErrors.confirm = t("confirmMismatch");

    if (!workspaceName.trim()) nextErrors.workspaceName = t("workspaceRequired");

    setErrors(nextErrors);
    setServerError(null);
    if (Object.keys(nextErrors).length) return;
    setPending(true);

    try {
      await api.register({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        workspaceName: workspaceName.trim(),
      });
      router.replace("/");
    } catch (error) {
      setServerError(error instanceof Error ? error.message : t("unexpectedError"));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthFormShell
      title={t("registerTitle")}
      subtitle={t("registerSubtitle")}
      onSubmit={submit}
      pending={pending}
      serverError={serverError}
      footer={
        <>
          <AuthSubmit pending={pending} label={t("submitRegister")} pendingLabel={t("working")} />
          <p className="text-center text-sm text-muted-foreground">
            {t("haveAccount")}{" "}
            <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
              {t("signIn")}
            </Link>
          </p>
        </>
      }
    >
      <Field label={t("email")} error={errors.email}>
        {(id, invalid) => (
          <Input
            id={id}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            aria-invalid={invalid}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
      </Field>
      <Field label={t("fullName")} error={errors.fullName} hint={t("fullNameHint")}>
        {(id, invalid) => (
          <Input
            id={id}
            autoComplete="name"
            value={fullName}
            aria-invalid={invalid}
            onChange={(e) => setFullName(e.target.value)}
          />
        )}
      </Field>
      <Field label={t("workspaceName")} error={errors.workspaceName} hint={t("workspaceHint")}>
        {(id, invalid) => (
          <Input
            id={id}
            value={workspaceName}
            aria-invalid={invalid}
            placeholder={t("workspacePlaceholder")}
            onChange={(e) => setWorkspaceName(e.target.value)}
          />
        )}
      </Field>
      <Field
        label={t("password")}
        error={errors.password}
        hint={t("passwordHint", { min: MIN_PASSWORD_LENGTH })}
      >
        {(id, invalid) => (
          <PasswordInput
            id={id}
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            invalid={invalid}
            showLabel={t("showPassword")}
            hideLabel={t("hidePassword")}
          />
        )}
      </Field>
      <Field label={t("confirmPassword")} error={errors.confirm}>
        {(id, invalid) => (
          <PasswordInput
            id={id}
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            invalid={invalid}
            showLabel={t("showPassword")}
            hideLabel={t("hidePassword")}
          />
        )}
      </Field>
    </AuthFormShell>
  );
}
