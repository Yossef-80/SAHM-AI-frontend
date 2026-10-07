"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Small, dependency-free field wrapper shared by the login and register forms. */
export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: ReactNode;
  children: (id: string, invalid: boolean) => ReactNode;
}) {
  const id = useId();
  const invalid = Boolean(error);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children(id, invalid)}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Email shape check. Deliberately permissive — the server normalises and validates. */
export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export type AuthFormProps = {
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  pending: boolean;
  serverError: string | null;
  children: ReactNode;
  footer: ReactNode;
};

/** Shared card + form chrome so both auth routes look like one product. */
export function AuthFormShell({
  title,
  subtitle,
  onSubmit,
  serverError,
  children,
  footer,
}: AuthFormProps & { title: string; subtitle: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-1.5 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
          {serverError && (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </p>
          )}
          {children}
          {footer}
        </form>
      </div>
    </main>
  );
}

/** Submit button with a pending state, so double submits are impossible. */
export function AuthSubmit({ pending = false, label, pendingLabel }: { pending?: boolean; label: string; pendingLabel?: string }) {
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? (pendingLabel || label) : label}
    </Button>
  );
}

/** Password input with a reveal toggle — a login form that cannot be checked is a support ticket. */
export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  invalid,
  placeholder,
  showLabel,
  hideLabel,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  invalid: boolean;
  placeholder?: string;
  showLabel: string;
  hideLabel: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        autoComplete={autoComplete}
        aria-invalid={invalid}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="pe-16"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 end-0 px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        {visible ? hideLabel : showLabel}
      </button>
    </div>
  );
}
