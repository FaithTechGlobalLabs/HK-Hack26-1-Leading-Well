import { getTranslations } from "next-intl/server";
import { SurveyForm } from "@/components/survey/survey-form";
import { getRepo } from "@/lib/data";

export const metadata = { robots: { index: false, follow: false } };

export default async function SurveyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations("survey");
  const info = /^[A-Za-z0-9_-]{1,64}$/.test(token) ? await getRepo().getSurveyByToken(token) : null;

  if (!info || info.status !== "open") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">{info ? t("closedTitle") : t("notFoundTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{info ? t("closedBody") : t("notFoundBody")}</p>
      </div>
    );
  }
  return <SurveyForm token={token} groupName={info.group_name} seasonName={info.season_name} />;
}
