import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { getRepo } from "@/lib/data";
import { pageUser } from "@/lib/page-auth";
import { createGroupAction, createSeasonAction, updateGroupAction } from "./actions";

export default async function LeaderPage() {
  const repo = getRepo();
  const user = await pageUser(repo);
  const t = await getTranslations("leader");
  const tc = await getTranslations("common");
  const groups = await repo.listGroups(user);
  const data = await Promise.all(
    groups.map(async (g) => {
      const seasons = await repo.listSeasons(g.id);
      const counts = await Promise.all(seasons.map(async (s) => (await repo.listResponses(s.id)).length));
      return { group: g, seasons: seasons.map((s, i) => ({ ...s, responses: counts[i] })) };
    }),
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {data.length === 0 && <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">{t("noGroups")}</p>}

      {data.map(({ group, seasons }) => (
        <Card key={group.id} data-testid="group-card">
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{group.name}</CardTitle>
              <CardDescription>
                {group.locale === "en" ? "English" : "繁體中文"} · {group.has_rightnow_access ? t("rightnowYes") : t("rightnowNo")}
              </CardDescription>
            </div>
            <form action={updateGroupAction.bind(null, group.id)} className="flex flex-wrap items-center gap-2 text-sm">
              <Select name="locale" defaultValue={group.locale} className="h-8 w-auto" aria-label={tc("language")}>
                <option value="zh-Hant">繁體中文</option>
                <option value="en">English</option>
              </Select>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" name="rightnow" defaultChecked={group.has_rightnow_access} />
                {t("rightnowAccess")}
              </label>
              <SubmitButton size="sm" variant="outline">
                {tc("save")}
              </SubmitButton>
            </form>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {seasons.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noSeasons")}</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {seasons.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 p-3">
                    <div className="mr-auto">
                      <p className="font-medium">{s.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {t("weeks", { n: s.target_weeks })} · {t("responses", { n: s.responses })}
                      </p>
                    </div>
                    <Badge variant={s.status === "open" ? "success" : s.status === "closed" ? "outline" : "secondary"}>{t(`status.${s.status}`)}</Badge>
                    <Link className={buttonVariants({ size: "sm" })} href={`/leader/seasons/${s.id}`}>
                      {t("openDashboard")}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <form action={createSeasonAction.bind(null, group.id)} className="flex flex-wrap items-end gap-2">
              <div className="flex min-w-48 flex-1 flex-col gap-1">
                <Label htmlFor={`season-${group.id}`}>{t("newSeason")}</Label>
                <Input id={`season-${group.id}`} name="name" placeholder={t("seasonPlaceholder")} required />
              </div>
              <div className="flex w-28 flex-col gap-1">
                <Label htmlFor={`weeks-${group.id}`}>{t("targetWeeks")}</Label>
                <Input id={`weeks-${group.id}`} name="weeks" type="number" min={1} max={52} defaultValue={6} />
              </div>
              <SubmitButton variant="secondary">{t("createSeason")}</SubmitButton>
            </form>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("newGroup")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createGroupAction} className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-56 flex-1 flex-col gap-1">
              <Label htmlFor="group-name">{t("groupName")}</Label>
              <Input id="group-name" name="name" required />
            </div>
            <Select name="locale" defaultValue="zh-Hant" className="w-auto" aria-label={tc("language")}>
              <option value="zh-Hant">繁體中文</option>
              <option value="en">English</option>
            </Select>
            <label className="flex h-10 items-center gap-1.5 text-sm">
              <input type="checkbox" name="rightnow" />
              {t("rightnowAccess")}
            </label>
            <SubmitButton>{t("createGroup")}</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
