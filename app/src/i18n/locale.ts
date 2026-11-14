import { cookies, headers } from "next/headers";
import type { Locale } from "@/lib/data/types";

export const LOCALES: Locale[] = ["en", "zh-Hant"];
export const LOCALE_COOKIE = "locale";

export function normaliseLocale(v: string | null | undefined): Locale | null {
  if (!v) return null;
  if (v === "en" || v.startsWith("en")) return "en";
  if (/^zh/i.test(v)) return "zh-Hant";
  return null;
}

/** Locale from cookie, then Accept-Language, else English. */
export async function getLocale(): Promise<Locale> {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  const fromCookie = normaliseLocale(c);
  if (fromCookie) return fromCookie;
  const accept = (await headers()).get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const l = normaliseLocale(part.split(";")[0].trim());
    if (l) return l;
  }
  return "en";
}
