"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createChurch, joinChurch, type FormState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";

function LocaleSelect() {
  const t = useTranslations("common");
  return (
    <Select name="locale" defaultValue="zh-Hant" aria-label={t("language")}>
      <option value="zh-Hant">繁體中文</option>
      <option value="en">English</option>
    </Select>
  );
}

export function OnboardingForms() {
  const t = useTranslations("onboarding");
  const [cState, cAction, cPending] = useActionState<FormState, FormData>(createChurch, {});
  const [jState, jAction, jPending] = useActionState<FormState, FormData>(joinChurch, {});
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t("pastorTitle")}</CardTitle>
          <CardDescription>{t("pastorHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={cAction} className="flex flex-col gap-3">
            <Label htmlFor="church-name">{t("churchName")}</Label>
            <Input id="church-name" name="name" required />
            <LocaleSelect />
            <Button type="submit" disabled={cPending}>
              {t("createChurch")}
            </Button>
            {cState.error && <p className="text-sm text-destructive">{cState.error}</p>}
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("leaderTitle")}</CardTitle>
          <CardDescription>{t("leaderHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={jAction} className="flex flex-col gap-3">
            <Label htmlFor="invite">{t("inviteCode")}</Label>
            <Input id="invite" name="code" required />
            <LocaleSelect />
            <Button type="submit" disabled={jPending}>
              {t("joinChurch")}
            </Button>
            {jState.error && <p className="text-sm text-destructive">{jState.error}</p>}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
