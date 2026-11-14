import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { OnboardingForms } from "@/components/onboarding-forms";
import { getRepo } from "@/lib/data";
import { createSupabaseServerClient, supabaseConfigured } from "@/lib/supabase/server";

export default async function OnboardingPage() {
  if (!supabaseConfigured()) redirect("/");
  const sb = await createSupabaseServerClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) redirect("/");
  if (await getRepo().getCurrentUser()) redirect("/leader");
  const t = await getTranslations("onboarding");
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <OnboardingForms />
    </div>
  );
}
