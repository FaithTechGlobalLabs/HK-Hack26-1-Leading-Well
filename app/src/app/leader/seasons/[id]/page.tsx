import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getLocale, getTranslations } from "next-intl/server";
import { AlertTriangle, ExternalLink, EyeOff, Layers, Sparkles } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Bar } from "@/components/ui/bar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { getRepo, type CatalogResource, type RecommendationRow, type SessionPlanRow } from "@/lib/data";
import { canShowBreakdown, formatShare, MIN_RESPONSES, type GroupNeedProfile, type TagNeed } from "@/lib/engine/needs";
import { SCORE_WEIGHTS } from "@/lib/engine/recommend";
import { pageUser, siteOrigin } from "@/lib/page-auth";
import { AccessError, recomputeNeeds, requireSeason } from "@/lib/services";
import { BIBLE_AREAS, LIVING, PRACTICES, tagLabel } from "@/lib/taxonomy";
import {
  dismissRecommendationAction,
  generateRecommendationsAction,
  pickRecommendationAction,
  rateRecommendationAction,
  saveObservationsAction,
  setSeasonStatusAction,
  updateSeasonWeeksAction,
} from "../../actions";

type T = Awaited<ReturnType<typeof getTranslations>>;

export default async function SeasonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = getRepo();
  const user = await pageUser(repo);
  const ctx = await requireSeason(id, repo, user).catch((e) => {
    if (e instanceof AccessError) notFound();
    throw e;
  });
  const { season, group } = ctx;
  const locale = await getLocale();
  const t = await getTranslations("season");
  const tc = await getTranslations("common");

  const responses = await repo.listResponses(id);
  let profileRow = await repo.getNeedProfile(id);
  if (!profileRow || profileRow.profile.n !== responses.length) {
    const profile = await recomputeNeeds(id, repo);
    profileRow = { season_id: id, profile, computed_at: new Date().toISOString() };
  }
  const profile = profileRow.profile;
  const n = profile.n;
  const showBreakdown = canShowBreakdown(n);
  const [observations, recs, plans] = await Promise.all([repo.getObservations(id), repo.listRecommendations(id), repo.listSessionPlans(id)]);
  const resourceIds = [...new Set([...recs.map((r) => r.resource_id), ...plans.map((p) => p.resource_id)])];
  const resources = new Map(
    (await Promise.all(resourceIds.map((rid) => repo.getResource(rid)))).filter((r): r is CatalogResource => !!r).map((r) => [r.id, r]),
  );

  const surveyUrl = `${await siteOrigin()}/s/${season.survey_token}`;
  const qr = await QRCode.toDataURL(surveyUrl, { margin: 1, width: 220 });
  const crisisCount = responses.filter((r) => r.crisis_flag).length;
  const sharedNames = responses.filter((r) => r.share_with_leader && r.display_name).map((r) => r.display_name!);
  const comments = showBreakdown ? responses.map((r) => r.free_text_scrubbed).filter((x): x is string => !!x).sort() : [];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/leader" className="text-sm text-muted-foreground hover:underline">
            ← {group.name}
          </Link>
          <h1 className="text-2xl font-bold">{season.name}</h1>
          <p className="text-muted-foreground">
            {t("responsesCount", { n })} · {t("weeks", { n: season.target_weeks })}
          </p>
        </div>
        <Badge variant={season.status === "open" ? "success" : "secondary"} className="text-sm">
          {t(`status.${season.status}`)}
        </Badge>
      </div>

      {crisisCount > 0 && (
        <div role="alert" className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
          <div>
            <p className="font-medium">{t("crisisTitle", { n: crisisCount })}</p>
            <p className="text-sm">{t("crisisBody")}</p>
          </div>
        </div>
      )}

      {/* Share + status */}
      <Card>
        <CardHeader>
          <CardTitle>{t("shareTitle")}</CardTitle>
          <CardDescription>{t("shareHint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={t("qrAlt")} width={160} height={160} className="rounded-lg border bg-white p-1" />
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <code className="max-w-full truncate rounded bg-muted px-2 py-1 text-sm" data-testid="survey-url">
                {surveyUrl}
              </code>
              <CopyButton value={surveyUrl} label={tc("copy")} copiedLabel={tc("copied")} />
            </div>
            <div className="flex flex-wrap gap-2">
              {season.status !== "open" && (
                <form action={setSeasonStatusAction.bind(null, id, "open")}>
                  <SubmitButton size="sm">{t("openSurvey")}</SubmitButton>
                </form>
              )}
              {season.status === "open" && (
                <form action={setSeasonStatusAction.bind(null, id, "closed")}>
                  <SubmitButton size="sm" variant="outline">
                    {t("closeSurvey")}
                  </SubmitButton>
                </form>
              )}
              <form action={updateSeasonWeeksAction.bind(null, id)} className="flex items-center gap-2">
                <Label htmlFor="weeks" className="text-sm">
                  {t("targetWeeks")}
                </Label>
                <Input id="weeks" name="weeks" type="number" min={1} max={52} defaultValue={season.target_weeks} className="h-8 w-20" />
                <SubmitButton size="sm" variant="ghost">
                  {tc("save")}
                </SubmitButton>
              </form>
            </div>
            {season.status === "draft" && <p className="text-sm text-muted-foreground">{t("draftHint")}</p>}
            {sharedNames.length > 0 && (
              <p className="text-sm">
                <span className="text-muted-foreground">{t("sharedNames")}: </span>
                {sharedNames.join(", ")}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Needs dashboard */}
      <section className="flex flex-col gap-4" aria-labelledby="needs-heading">
        <h2 id="needs-heading" className="text-xl font-semibold">
          {t("needsTitle")}
        </h2>
        {!showBreakdown ? (
          <div className="flex gap-3 rounded-lg border border-dashed p-6" data-testid="k-guard">
            <EyeOff className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <p className="text-muted-foreground">{t("kGuard", { min: MIN_RESPONSES, n })}</p>
          </div>
        ) : (
          <NeedsDashboard profile={profile} locale={locale} t={t} />
        )}
        {comments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("commentsTitle")}</CardTitle>
              <CardDescription>{t("commentsHint")}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
                {comments.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Leader observations */}
      <details className="rounded-lg border bg-card p-5">
        <summary className="cursor-pointer font-semibold">{t("observationsTitle")}</summary>
        <p className="mt-2 text-sm text-muted-foreground">{t("observationsHint")}</p>
        <form action={saveObservationsAction.bind(null, id)} className="mt-4 flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {observationTags(profile, observations).map((tag) => (
              <label key={tag} className="flex items-center justify-between gap-2 text-sm">
                <span>{tagLabel(tag, locale)}</span>
                <Select
                  name={`obs_${tag}`}
                  defaultValue={observations[tag] != null ? String(Math.round(observations[tag] * 4)) : ""}
                  className="h-8 w-36"
                >
                  <option value="">{t("obsUnset")}</option>
                  {[0, 1, 2, 3, 4].map((v) => (
                    <option key={v} value={v}>
                      {t(`obs.${v}`)}
                    </option>
                  ))}
                </Select>
              </label>
            ))}
          </div>
          <SubmitButton className="self-start" variant="secondary">
            {t("saveObservations")}
          </SubmitButton>
        </form>
      </details>

      {/* Recommendations */}
      <section className="flex flex-col gap-4" aria-labelledby="recs-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="recs-heading" className="text-xl font-semibold">
            {t("recsTitle")}
          </h2>
          <form action={generateRecommendationsAction.bind(null, id)}>
            <SubmitButton disabled={!showBreakdown} pendingText={t("generating")}>
              <Sparkles className="size-4" aria-hidden />
              {recs.length ? t("regenerate") : t("generate")}
            </SubmitButton>
          </form>
        </div>
        {!showBreakdown && <p className="text-sm text-muted-foreground">{t("recsNeedResponses", { min: MIN_RESPONSES })}</p>}
        {showBreakdown && recs.length === 0 && <p className="text-sm text-muted-foreground">{t("recsEmpty")}</p>}
        <div className="grid gap-4 lg:grid-cols-2">
          {recs.map((rec) => (
            <RecommendationCard key={rec.id} rec={rec} resource={resources.get(rec.resource_id)} n={n} locale={locale} seasonId={id} t={t} />
          ))}
        </div>
      </section>

      {/* Session plans */}
      <section id="plans" className="flex flex-col gap-4" aria-labelledby="plans-heading">
        <h2 id="plans-heading" className="text-xl font-semibold">
          {t("plansTitle")}
        </h2>
        {plans.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("plansEmpty")}</p>
        ) : (
          plans.map((p) => <SessionPlanCard key={p.id} plan={p} resource={resources.get(p.resource_id)} tiered={profile.tieredQuestions} t={t} />)
        )}
      </section>
    </div>
  );
}

function observationTags(profile: GroupNeedProfile, obs: Record<string, number>): string[] {
  const top = profile.needs.slice(0, 12).map((x) => x.tag);
  return [...new Set([...top, ...Object.keys(obs)])];
}

function NeedRow({ need, n, locale, t }: { need: TagNeed; n: number; locale: string; t: T }) {
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{tagLabel(need.tag, locale)}</span>
        <span className="text-muted-foreground">
          {t("needCount", { share: formatShare(need.count, n, locale) })}
          {need.interestCount > 0 && ` · ${t("interestCount", { share: formatShare(need.interestCount, n, locale) })}`}
        </span>
      </div>
      <Bar value={need.need} tone={need.need >= 0.6 ? "warning" : "primary"} />
    </li>
  );
}

function NeedsDashboard({ profile, locale, t }: { profile: GroupNeedProfile; locale: string; t: T }) {
  const n = profile.n;
  const byFamily = (keys: string[], limit: number) => profile.needs.filter((x) => keys.includes(x.tag)).slice(0, limit);
  const families: { title: string; items: TagNeed[] }[] = [
    { title: t("familyBible"), items: byFamily(BIBLE_AREAS, 8) },
    { title: t("familyPractice"), items: byFamily(PRACTICES, 5) },
    { title: t("familyLiving"), items: byFamily(LIVING, 8) },
  ];
  const formats = Object.entries(profile.formatShare).sort((a, b) => b[1] - a[1]);
  return (
    <div className="grid gap-4 lg:grid-cols-3" data-testid="needs-dashboard">
      <Card className="lg:col-span-3">
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={t("depthTarget")} value={t(`depth.${profile.depthTarget}`)} />
          <Stat
            label={t("spread")}
            value={profile.tieredQuestions ? t("spreadWide") : t("spreadNarrow")}
            icon={profile.tieredQuestions ? <Layers className="size-4 text-primary" aria-hidden /> : null}
          />
          <Stat label={t("formatPref")} value={formats.length ? formats.map(([f, s]) => `${t(`format.${f}`)} ${formatShare(Math.round(s * n), n, locale)}`).join(" · ") : "—"} />
          <Stat label={t("prepTime")} value={profile.medianPrepMinutes != null ? t("minutes", { n: profile.medianPrepMinutes }) : "—"} />
        </CardContent>
      </Card>

      {profile.hiddenNeeds.length > 0 && (
        <Card className="border-warning/60 lg:col-span-3" data-testid="hidden-needs">
          <CardHeader>
            <CardTitle className="text-base">{t("hiddenTitle")}</CardTitle>
            <CardDescription>{t("hiddenHint")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {profile.hiddenNeeds.map((h) => (
              <Badge key={h.tag} variant="warning" title={t(`hiddenReason.${h.reason}`)}>
                {tagLabel(h.tag, locale)} · {t(`hiddenReason.${h.reason}`)}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {families.map((f) => (
        <Card key={f.title}>
          <CardHeader>
            <CardTitle className="text-base">{f.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {f.items.map((need) => (
                <NeedRow key={need.tag} need={need} n={n} locale={locale} t={t} />
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="flex items-center gap-1.5 font-medium">
        {icon}
        {value}
      </p>
    </div>
  );
}

function localized(r: CatalogResource, locale: string) {
  const zh = locale.startsWith("zh");
  return { title: (zh && r.title_zh) || r.title, description: (zh && r.description_zh) || r.description };
}

function RecommendationCard({
  rec,
  resource,
  n,
  locale,
  seasonId,
  t,
}: {
  rec: RecommendationRow;
  resource?: CatalogResource;
  n: number;
  locale: string;
  seasonId: string;
  t: T;
}) {
  if (!resource) return null;
  const { title, description } = localized(resource, locale);
  const rationale = (locale.startsWith("zh") ? rec.rationale_zh : rec.rationale_en) ?? rec.rationale_en;
  const b = rec.breakdown;
  const parts: [string, number, number][] = [
    [t("score.coverage"), b.coverage, SCORE_WEIGHTS.coverage],
    [t("score.depthFit"), b.depthFit, SCORE_WEIGHTS.depthFit],
    [t("score.interest"), b.interest, SCORE_WEIGHTS.interest],
    [t("score.priority"), b.priority, SCORE_WEIGHTS.priority],
    [t("score.formatFit"), b.formatFit, SCORE_WEIGHTS.formatFit],
    [t("score.repetition"), b.repetition, -SCORE_WEIGHTS.repetition],
  ];
  const fb = rec.feedback;
  return (
    <Card data-testid="recommendation-card" className={fb?.action === "dismissed" ? "opacity-60" : undefined}>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">#{rec.rank}</Badge>
          <Badge variant="outline">{resource.source === "bibleproject" ? "BibleProject" : resource.source === "rightnow" ? "RightNow Media" : t("custom")}</Badge>
          {resource.access === "subscription" && <Badge variant="outline">{t("subscription")}</Badge>}
          {fb && <Badge variant={fb.action === "picked" ? "success" : "outline"}>{t(`feedback.${fb.action}`)}</Badge>}
          <span className="ml-auto text-sm font-semibold">{Math.round(rec.score * 100)}</span>
        </div>
        <CardTitle className="mt-1">
          <a href={resource.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
            {title}
            <ExternalLink className="size-4" aria-hidden />
          </a>
        </CardTitle>
        <CardDescription>
          {t("units", { units: resource.units, minutes: resource.minutes_per_unit })} · {t(`depth.${resource.depth}`)} · {t(`format.${resource.format}`)}
          {resource.has_guide && ` · ${t("hasGuide")}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm">{description}</p>
        {rationale && <p className="rounded-lg bg-accent/60 p-3 text-sm">{rationale}</p>}
        {b.coveredTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {b.coveredTags.slice(0, 5).map((c) => (
              <Badge key={c.tag} variant="outline">
                {tagLabel(c.tag, locale)} · {formatShare(c.count, n, locale)}
              </Badge>
            ))}
          </div>
        )}
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">{t("whyScore")}</summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {parts.map(([label, v, w]) => (
              <li key={label} className="grid grid-cols-[8rem_1fr_3.5rem] items-center gap-2">
                <span>{label}</span>
                <Bar value={v} tone={w < 0 ? "muted" : "primary"} />
                <span className="text-right tabular-nums text-muted-foreground">
                  {w < 0 ? "−" : "×"}
                  {Math.abs(w).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </details>
        {resource.attribution && <p className="text-xs text-muted-foreground">{resource.attribution}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <form action={pickRecommendationAction.bind(null, seasonId, rec.id)}>
            <input type="hidden" name="locale" value={locale} />
            <SubmitButton size="sm" pendingText={t("drafting")}>
              {t("pick")}
            </SubmitButton>
          </form>
          {fb?.action !== "dismissed" && (
            <form action={dismissRecommendationAction.bind(null, seasonId, rec.id)}>
              <SubmitButton size="sm" variant="ghost">
                {t("dismiss")}
              </SubmitButton>
            </form>
          )}
        </div>
        {fb && (
          <form action={rateRecommendationAction.bind(null, seasonId, rec.id)} className="flex flex-wrap items-end gap-2 border-t pt-3">
            <Select name="rating" defaultValue={fb.rating ? String(fb.rating) : ""} className="h-8 w-28" aria-label={t("rating")}>
              <option value="">{t("rating")}</option>
              {[5, 4, 3, 2, 1].map((r) => (
                <option key={r} value={r}>
                  {"★".repeat(r)}
                </option>
              ))}
            </Select>
            <Textarea name="comment" defaultValue={fb.comment ?? ""} placeholder={t("commentPlaceholder")} className="min-h-8 flex-1 py-1" rows={1} />
            <SubmitButton size="sm" variant="outline">
              {t("sendFeedback")}
            </SubmitButton>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function SessionPlanCard({ plan, resource, tiered, t }: { plan: SessionPlanRow; resource?: CatalogResource; tiered: boolean; t: T }) {
  const c = plan.content;
  const tiers = ["beginner", "growing", "mature"] as const;
  return (
    <Card data-testid="session-plan">
      <CardHeader>
        <CardTitle>{c.title}</CardTitle>
        <CardDescription>
          {resource && (
            <a href={resource.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
              {resource.title}
            </a>
          )}
          {" · "}
          {plan.locale === "en" ? "English" : "繁體中文"}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <PlanBlock title={t("plan.opener")}>{c.opener}</PlanBlock>
          <PlanBlock title={t("plan.scripture")}>
            <ul className="flex flex-col gap-1">
              {c.scripture.map((s) => (
                <li key={s.reference}>
                  <span className="font-medium">{s.reference}</span> — {s.note}
                </li>
              ))}
            </ul>
          </PlanBlock>
          <PlanBlock title={t("plan.application")}>{c.application}</PlanBlock>
          <PlanBlock title={t("plan.prayer")}>{c.prayer_focus}</PlanBlock>
        </div>
        <div className="flex flex-col gap-3">
          <p className="font-semibold">
            {t("plan.questions")}
            {tiered && <span className="ml-2 text-xs font-normal text-muted-foreground">{t("plan.tieredHint")}</span>}
          </p>
          {tiers.map((tier) => (
            <PlanBlock key={tier} title={t(`plan.${tier}`)}>
              <ol className="list-decimal pl-5">
                {c.questions[tier].map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ol>
            </PlanBlock>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PlanBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 font-semibold">{title}</p>
      <div>{children}</div>
    </div>
  );
}
