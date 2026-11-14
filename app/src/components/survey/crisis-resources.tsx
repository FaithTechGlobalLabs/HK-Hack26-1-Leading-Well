import { useTranslations } from "next-intl";
import { Phone } from "lucide-react";

/** Hong Kong support lines shown after the survey (prominently when a crisis is detected). */
export const HELPLINES = [
  { name_en: "The Samaritan Befrienders Hong Kong (24h)", name_zh: "香港撒瑪利亞防止自殺會（24 小時）", phone: "2389 2222" },
  { name_en: "The Samaritans Hong Kong (24h, multilingual)", name_zh: "撒瑪利亞會（24 小時，多種語言）", phone: "2896 0000" },
  { name_en: "Suicide Prevention Services (24h)", name_zh: "生命熱線（24 小時）", phone: "2382 0000" },
  { name_en: "Emergency services", name_zh: "緊急服務", phone: "999" },
];

export function CrisisResources({ prominent, locale }: { prominent: boolean; locale: string }) {
  const t = useTranslations("survey");
  const zh = locale.startsWith("zh");
  return (
    <div
      role={prominent ? "alert" : undefined}
      data-testid={prominent ? "crisis-resources" : undefined}
      className={prominent ? "rounded-lg border-2 border-destructive/50 bg-destructive/10 p-4" : "rounded-lg border bg-muted/50 p-4"}
    >
      <p className="font-semibold">{prominent ? t("crisisTitle") : t("supportTitle")}</p>
      <p className="mt-1 text-sm">{prominent ? t("crisisBody") : t("supportBody")}</p>
      <ul className="mt-3 flex flex-col gap-2">
        {HELPLINES.map((h) => (
          <li key={h.phone}>
            <a href={`tel:${h.phone.replace(/\s/g, "")}`} className="flex items-center gap-2 text-sm hover:underline">
              <Phone className="size-4 shrink-0" aria-hidden />
              <span className="font-medium tabular-nums">{h.phone}</span>
              <span className="text-muted-foreground">{zh ? h.name_zh : h.name_en}</span>
            </a>
          </li>
        ))}
        <li className="text-sm">
          <a href="https://www.openup.hk" target="_blank" rel="noreferrer" className="hover:underline">
            Open Up — openup.hk · WhatsApp 9101 2012
          </a>
        </li>
      </ul>
    </div>
  );
}
