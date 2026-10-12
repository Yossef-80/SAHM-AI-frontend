import { LoginForm } from "@/components/auth/login-form";

/**
 * `next` is written by `middleware.ts` when it bounces an anonymous visitor, so
 * the user lands back where they were aiming after signing in. Only a single
 * path segment is accepted — anything else falls back to `/` in the form.
 */
export default function LoginPage({ searchParams }: { searchParams?: { next?: string } }) {
  const next = typeof searchParams?.next === "string" && searchParams?.next.startsWith("/") ? searchParams.next : "/";
  return <LoginForm next={next} />;
}
