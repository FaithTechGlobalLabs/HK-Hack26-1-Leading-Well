import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getRepo } from "@/lib/data";
import { signOut } from "@/app/auth/actions";
import { LanguageToggle } from "./language-toggle";
import { Button } from "./ui/button";

export async function SiteHeader() {
  const t = await getTranslations("nav");
  const repo = getRepo();
  const user = await repo.getCurrentUser();
  return (
    <header className="border-b bg-card/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <Link href="/" className="mr-auto font-semibold">
          {t("appName")}
          {repo.kind === "demo" && <span className="ml-2 rounded bg-warning/30 px-1.5 py-0.5 text-xs font-medium">{t("demoMode")}</span>}
        </Link>
        {user && (
          <nav className="flex items-center gap-1 text-sm">
            <Link className="rounded-md px-3 py-1.5 hover:bg-muted" href="/leader">
              {t("groups")}
            </Link>
            {user.role === "pastor" && (
              <Link className="rounded-md px-3 py-1.5 hover:bg-muted" href="/pastor">
                {t("catalog")}
              </Link>
            )}
          </nav>
        )}
        <LanguageToggle />
        {user && (
          <form action={signOut}>
            <Button variant="ghost" size="sm" type="submit">
              {t("signOut")}
            </Button>
          </form>
        )}
      </div>
    </header>
  );
}
