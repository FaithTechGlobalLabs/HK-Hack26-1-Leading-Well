import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ImportForm } from "@/components/import-form";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { getRepo } from "@/lib/data";
import { pageUser } from "@/lib/page-auth";
import { isZh, tagLabel } from "@/lib/taxonomy";
import { bulkAllowAction, updateCatalogEntryAction } from "./actions";

const PAGE_SIZE = 50;

type Search = { q?: string; source?: string; status?: string; tags?: string; page?: string };

export default async function PastorPage({ searchParams }: { searchParams: Promise<Search> }) {
  const repo = getRepo();
  const user = await pageUser(repo, "pastor");
  const sp = await searchParams;
  const t = await getTranslations("pastor");
  const locale = await getLocale();
  const zh = isZh(locale);
  const [church, resources, catalog] = await Promise.all([repo.getChurch(user.church_id), repo.listResources(user.church_id), repo.listCatalog(user.church_id)]);
  const entries = new Map(catalog.map((c) => [c.resource_id, c]));

  const q = (sp.q ?? "").trim().toLowerCase();
  const filtered = resources
    .filter((r) => !sp.source || r.source === sp.source)
    .filter((r) => !sp.tags || r.tag_status === sp.tags)
    .filter((r) => {
      if (!sp.status) return true;
      const e = entries.get(r.id);
      return sp.status === "none" ? !e : e?.status === sp.status;
    })
    .filter((r) => !q || `${r.title} ${r.title_zh ?? ""} ${r.description}`.toLowerCase().includes(q))
    .sort((a, b) => a.source.localeCompare(b.source) || a.title.localeCompare(b.title));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, parseInt(sp.page ?? "1", 10) || 1));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const notInCatalog = filtered.filter((r) => !entries.has(r.id));
  const stats = {
    total: resources.length,
    allowed: catalog.filter((c) => c.status === "allowed").length,
    blocked: catalog.filter((c) => c.status === "blocked").length,
    pendingReview: resources.filter((r) => r.tag_status !== "reviewed").length,
  };
  const pageHref = (p: number) => {
    const params = new URLSearchParams(Object.entries({ ...sp, page: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `/pastor?${params}`;
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        {church && (
          <div className="rounded-lg border bg-card px-4 py-2 text-sm">
            <p className="text-muted-foreground">{church.name}</p>
            <p>
              {t("inviteCode")}: <code className="font-mono font-semibold" data-testid="invite-code">{church.invite_code}</code>
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["total", stats.total],
            ["allowed", stats.allowed],
            ["blocked", stats.blocked],
            ["pendingReview", stats.pendingReview],
          ] as const
        ).map(([k, v]) => (
          <Card key={k}>
            <CardContent className="pt-4">
              <p className="text-2xl font-semibold tabular-nums">{v}</p>
              <p className="text-sm text-muted-foreground">{t(`stats.${k}`)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("importTitle")}</CardTitle>
          <CardDescription>{t("importHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ImportForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("catalogTitle")}</CardTitle>
          <CardDescription>{t("catalogHint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form className="flex flex-wrap items-center gap-2" method="get">
            <Input name="q" defaultValue={sp.q} placeholder={t("search")} className="w-56" aria-label={t("search")} />
            <Select name="source" defaultValue={sp.source ?? ""} className="w-auto" aria-label={t("source")}>
              <option value="">{t("allSources")}</option>
              <option value="bibleproject">BibleProject</option>
              <option value="rightnow">RightNow Media</option>
              <option value="custom">{t("sourceCustom")}</option>
            </Select>
            <Select name="status" defaultValue={sp.status ?? ""} className="w-auto" aria-label={t("statusLabel")}>
              <option value="">{t("allStatuses")}</option>
              <option value="allowed">{t("status.allowed")}</option>
              <option value="blocked">{t("status.blocked")}</option>
              <option value="none">{t("status.none")}</option>
            </Select>
            <Select name="tags" defaultValue={sp.tags ?? ""} className="w-auto" aria-label={t("tagStatusLabel")}>
              <option value="">{t("allTagStatuses")}</option>
              <option value="ai">{t("tagStatus.ai")}</option>
              <option value="pending">{t("tagStatus.pending")}</option>
              <option value="reviewed">{t("tagStatus.reviewed")}</option>
            </Select>
            <Button type="submit" variant="secondary">
              {t("filter")}
            </Button>
            <Link href="/pastor" className={buttonVariants({ variant: "ghost" })}>
              {t("clear")}
            </Link>
          </form>

          {notInCatalog.length > 0 && (
            <form action={bulkAllowAction} className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-3 text-sm">
              {notInCatalog.slice(0, 500).map((r) => (
                <input key={r.id} type="hidden" name="ids" value={r.id} />
              ))}
              <span>{t("notInCatalog", { n: notInCatalog.length })}</span>
              <SubmitButton size="sm" variant="outline">
                {t("allowAll")}
              </SubmitButton>
            </form>
          )}

          <p className="text-sm text-muted-foreground">{t("showing", { n: filtered.length })}</p>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm" data-testid="catalog-table">
              <thead className="bg-muted/60 text-left">
                <tr>
                  <th className="p-2 font-medium">{t("col.resource")}</th>
                  <th className="p-2 font-medium">{t("col.tags")}</th>
                  <th className="p-2 font-medium">{t("col.catalog")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => {
                  const e = entries.get(r.id);
                  return (
                    <tr key={r.id} className="align-top">
                      <td className="max-w-sm p-2">
                        <a href={r.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                          {zh && r.title_zh ? r.title_zh : r.title}
                        </a>
                        <p className="text-xs text-muted-foreground">
                          {r.source === "bibleproject" ? "BibleProject" : r.source === "rightnow" ? "RightNow Media" : t("sourceCustom")} · {r.units}×
                          {r.minutes_per_unit}′ · {r.language.join("/")} · {r.access === "subscription" ? t("subscription") : t("free")}
                        </p>
                        {r.url_verified === false && (
                          <Badge variant="warning" className="mt-1" data-testid="url-unverified">
                            {t("urlUnverified")}
                          </Badge>
                        )}
                      </td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          {r.tags.slice(0, 5).map((tg) => (
                            <Badge key={tg.tag} variant="outline">
                              {tagLabel(tg.tag, locale)}
                            </Badge>
                          ))}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge variant={r.tag_status === "reviewed" ? "success" : "warning"}>{t(`tagStatus.${r.tag_status}`)}</Badge>
                          <Link href={`/pastor/resources/${r.id}`} className="text-xs underline">
                            {t("reviewTags")}
                          </Link>
                        </div>
                      </td>
                      <td className="p-2">
                        <form action={updateCatalogEntryAction.bind(null, r.id)} className="flex flex-wrap items-center gap-1.5">
                          <Select name="status" defaultValue={e?.status ?? "allowed"} className="h-8 w-auto" aria-label={t("statusLabel")}>
                            <option value="allowed">{t("status.allowed")}</option>
                            <option value="blocked">{t("status.blocked")}</option>
                          </Select>
                          <Input
                            name="priority"
                            type="number"
                            min={0}
                            max={1}
                            step={0.1}
                            defaultValue={e?.priority ?? 0.5}
                            className="h-8 w-20"
                            aria-label={t("priority")}
                            title={t("priority")}
                          />
                          <Input name="notes" defaultValue={e?.notes ?? ""} placeholder={t("notes")} className="h-8 w-40" aria-label={t("notes")} />
                          <SubmitButton size="sm" variant={e ? "outline" : "default"}>
                            {e ? t("update") : t("add")}
                          </SubmitButton>
                        </form>
                        {!e && <p className="mt-1 text-xs text-muted-foreground">{t("status.none")}</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <nav className="flex items-center justify-center gap-2 text-sm" aria-label="Pagination">
              {page > 1 && (
                <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={pageHref(page - 1)}>
                  ←
                </Link>
              )}
              <span>
                {page} / {pages}
              </span>
              {page < pages && (
                <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={pageHref(page + 1)}>
                  →
                </Link>
              )}
            </nav>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
