import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BookOpen, HeartHandshake, ListChecks, ShieldCheck } from "lucide-react";
import { demoSignIn, resetDemo } from "@/app/auth/actions";
import { LoginForm } from "@/components/login-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getRepo } from "@/lib/data";
import { DEMO_TOKEN } from "@/lib/data/demo";

export default async function Home() {
  const t = await getTranslations("landing");
  const repo = getRepo();
  const user = await repo.getCurrentUser();
  const features = [
    { icon: ListChecks, title: t("f1Title"), body: t("f1Body") },
    { icon: HeartHandshake, title: t("f2Title"), body: t("f2Body") },
    { icon: BookOpen, title: t("f3Title"), body: t("f3Body") },
    { icon: ShieldCheck, title: t("f4Title"), body: t("f4Body") },
  ];

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[1.4fr_1fr]">
      <section className="flex flex-col gap-6">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h1>
        <p className="text-lg text-muted-foreground">{t("subtitle")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="flex gap-3 rounded-lg border bg-card p-4">
              <f.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="font-medium">{f.title}</p>
                <p className="text-sm text-muted-foreground">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        {user ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("welcomeBack")}</CardTitle>
              <CardDescription>{user.email ?? user.display_name}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Link className={buttonVariants()} href="/leader">
                {t("goGroups")}
              </Link>
              {user.role === "pastor" && (
                <Link className={buttonVariants({ variant: "outline" })} href="/pastor">
                  {t("goCatalog")}
                </Link>
              )}
            </CardContent>
          </Card>
        ) : repo.kind === "supabase" ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("signIn")}</CardTitle>
              <CardDescription>{t("signInHint")}</CardDescription>
            </CardHeader>
            <CardContent>
              <LoginForm />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{t("demoTitle")}</CardTitle>
              <CardDescription>{t("demoHint")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <form action={demoSignIn.bind(null, "leader")}>
                <Button className="w-full" type="submit" data-testid="demo-leader">
                  {t("demoLeader")}
                </Button>
              </form>
              <form action={demoSignIn.bind(null, "pastor")}>
                <Button className="w-full" variant="outline" type="submit">
                  {t("demoPastor")}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
        {repo.kind === "demo" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("demoSurveyTitle")}</CardTitle>
              <CardDescription>{t("demoSurveyHint")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Link className={buttonVariants({ variant: "secondary" })} href={`/s/${DEMO_TOKEN}`}>
                {t("openSurvey")}
              </Link>
              <form action={resetDemo}>
                <Button variant="ghost" type="submit">
                  {t("resetDemo")}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
