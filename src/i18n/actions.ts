"use server";

import { cookies } from "next/headers";
import { LOCALE_COOKIE, locales, type AppLocale } from "./config";

export async function setLocale(locale: AppLocale) {
  if (!locales.includes(locale)) return;
  cookies().set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
}
