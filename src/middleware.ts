import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, LOCALE_COOKIE, locales, type AppLocale } from "@/i18n/config";

/**
 * Route protection + locale persistence.
 *
 * 1. **Locale.** `next-intl@4` is installed and its plugin is wired
 *    (`next.config.mjs` → `createNextIntlPlugin`), which is what makes
 *    `getRequestConfig` and `useTranslations` work at all. What is *not* wired,
 *    deliberately, is next-intl's routing middleware (`createIntlMiddleware`):
 *    that handler is built for an app with a `[locale]` route segment and
 *    prefixed hrefs (`/en/campaigns`). This app has neither — every href in
 *    `nav-config.ts`, every `<Link>` and every `router.push` is prefix-free, and
 *    `src/i18n/request.ts` reads the locale from the `NEXT_LOCALE` cookie.
 *    Wiring `createIntlMiddleware` here therefore rewrites `/login` to
 *    `/en/login`, which does not exist, and the route 404s.
 *
 *    So the locale half of the job is done the way this app consumes it:
 *    negotiate a locale, persist it in `NEXT_LOCALE`, leave the path alone. Same
 *    contract as next-intl, no prefix fight. When this app ever adopts
 *    `[locale]`, swap this block for `createIntlMiddleware({locales, defaultLocale})`.
 *
 * 2. **Auth gate.** Middleware runs on every request, including static assets, so
 *    it must not call FastAPI. It does a cheap *presence* check — the
 *    non-secret `sahm_session` marker cookie written by `auth-store.ts`, or an
 *    `Authorization` header — and redirects anonymous users to
 *    `/login?next=…`. That is redirect UX, not authentication: a forged marker
 *    gets the request as far as a spinner, and the first API call answers `401`,
 *    at which point `HttpApi.raw()` performs one silent refresh and, failing
 *    that, clears the session and sends the user to `/login`.
 */

/** Routes reachable without a session. */
const PUBLIC_ROUTES = ["/login", "/register", "/auth"];

/** Non-secret presence marker, mirrored from `SESSION_MARKER_COOKIE` in `auth-store.ts`. */
const SESSION_MARKER_COOKIE = "sahm_session";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** `ar` (or `ar-EG`) wins over everything else; `en` is the fallback. */
function negotiateLocale(request: NextRequest): AppLocale {
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (cookie && (locales as readonly string[]).includes(cookie)) return cookie as AppLocale;

  const header = request.headers.get("accept-language") ?? "";
  for (const part of header.split(",")) {
    const tag = part.split(";")[0]?.trim().slice(0, 2).toLowerCase();
    if (tag && (locales as readonly string[]).includes(tag)) return tag as AppLocale;
  }
  return defaultLocale;
}

export default function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const hasSession =
    Boolean(request.cookies.get(SESSION_MARKER_COOKIE)?.value) || Boolean(request.headers.get("authorization"));
  const isPublic = PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  if (!hasSession && !isPublic) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  const response = NextResponse.next();
  const locale = negotiateLocale(request);
  if (request.cookies.get(LOCALE_COOKIE)?.value !== locale) {
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: ONE_YEAR,
      sameSite: "lax",
    });
  }
  return response;
}

export const config = {
  /**
   * Everything except Next's build output and static files. next-intl's own
   * matcher also excludes `.well-known`; this one keeps favicons, source maps
   * and RSC payloads out of the hot path.
   */
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
