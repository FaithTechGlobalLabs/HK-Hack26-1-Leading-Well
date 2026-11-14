"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { setLocaleAction } from "@/i18n/actions";
import { cn } from "@/lib/utils";

export function LanguageToggle({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const choose = (l: string) =>
    start(async () => {
      await setLocaleAction(l);
      router.refresh();
    });
  return (
    <div className={cn("inline-flex rounded-lg border bg-card p-0.5 text-sm", className)} role="group" aria-label="Language">
      {[
        ["en", "EN"],
        ["zh-Hant", "繁中"],
      ].map(([l, label]) => (
        <button
          key={l}
          type="button"
          disabled={pending}
          onClick={() => choose(l)}
          aria-pressed={locale === l}
          className={cn("rounded-md px-2.5 py-1", locale === l ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
