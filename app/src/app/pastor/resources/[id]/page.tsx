import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/submit-button";
import { getRepo } from "@/lib/data";
import { pageUser } from "@/lib/page-auth";
import { BIBLE_AREAS, LIVING, PRACTICES, isZh, tagLabel } from "@/lib/taxonomy";
import { saveResourceTagsAction } from "../../actions";

export default async function ResourceTagsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = getRepo();
  await pageUser(repo, "pastor");
  const resource = await repo.getResource(id);
  if (!resource) notFound();
  const t = await getTranslations("pastor");
  const tl = await getTranslations("season");
  const locale = await getLocale();
  const current = new Map(resource.tags.map((x) => [x.tag, x.relevance]));
  const families = [
    ["familyBible", BIBLE_AREAS],
    ["familyPractice", PRACTICES],
    ["familyLiving", LIVING],
  ] as const;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <Link href="/pastor" className="text-sm underline">
        ← {t("backToCatalog")}
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>{isZh(locale) && resource.title_zh ? resource.title_zh : resource.title}</CardTitle>
          <CardDescription>{isZh(locale) && resource.description_zh ? resource.description_zh : resource.description}</CardDescription>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant={resource.tag_status === "reviewed" ? "success" : "warning"}>{t(`tagStatus.${resource.tag_status}`)}</Badge>
            <a href={resource.url} target="_blank" rel="noreferrer" className="text-sm underline">
              {resource.url}
            </a>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">{t("reviewHint")}</p>
          <form action={saveResourceTagsAction.bind(null, resource.id)} className="flex flex-col gap-6" data-testid="tag-review">
            {families.map(([fam, keys]) => (
              <fieldset key={fam}>
                <legend className="mb-2 font-medium">{tl(fam)}</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {keys.map((k) => (
                    <div key={k} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                      <input id={`tag_${k}`} type="checkbox" name={`tag_${k}`} defaultChecked={current.has(k)} />
                      <label htmlFor={`tag_${k}`} className="mr-auto">
                        {tagLabel(k, locale)}
                        {resource.tag_sources?.[k] === "ai" && <span className="ml-1 text-xs text-muted-foreground">(AI)</span>}
                      </label>
                      <input
                        type="range"
                        name={`rel_${k}`}
                        min={0.1}
                        max={1}
                        step={0.1}
                        defaultValue={current.get(k) ?? 0.7}
                        aria-label={`${t("relevance")}: ${tagLabel(k, locale)}`}
                        className="w-24"
                      />
                    </div>
                  ))}
                </div>
              </fieldset>
            ))}
            <SubmitButton className="self-start">{t("approveTags")}</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
