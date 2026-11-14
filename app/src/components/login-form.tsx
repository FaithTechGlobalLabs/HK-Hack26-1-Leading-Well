"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { signInWithEmail, type FormState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function LoginForm() {
  const t = useTranslations("landing");
  const [state, action, pending] = useActionState<FormState, FormData>(signInWithEmail, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <Label htmlFor="email">{t("email")}</Label>
      <Input id="email" name="email" type="email" required autoComplete="email" placeholder="you@church.org" />
      <Button type="submit" disabled={pending}>
        {t("sendLink")}
      </Button>
      {state.message === "check_email" && <p className="text-sm text-success">{t("checkEmail")}</p>}
      {state.error && <p className="text-sm text-destructive">{state.error === "invalid_email" ? t("invalidEmail") : state.error}</p>}
    </form>
  );
}
