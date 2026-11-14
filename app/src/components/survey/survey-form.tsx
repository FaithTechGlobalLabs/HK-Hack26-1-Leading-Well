"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { submitSurveyAction } from "@/app/s/[token]/actions";
import { LanguageToggle } from "@/components/language-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { CrisisResources } from "@/components/survey/crisis-resources";
import {
  INTENSITY_LABELS,
  QUESTIONS,
  SECTIONS,
  emptyAnswers,
  type Option,
  type Section,
  type SurveyAnswers,
  type SurveyQuestion,
} from "@/lib/survey/questions";
import { cn } from "@/lib/utils";

const CONTEXT_KEY: Record<string, keyof SurveyAnswers["context"]> = {
  a_life_stage: "lifeStage",
  a_years: "years",
  a_involvement: "involvement",
  a_language: "language",
};

type Step = "intro" | Section;
const STEPS: Step[] = ["intro", ...SECTIONS];

function Choice({ selected, onClick, children, testId }: { selected: boolean; onClick: () => void; children: React.ReactNode; testId?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      data-testid={testId}
      className={cn(
        "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
        selected ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

export function SurveyForm({ token, groupName, seasonName }: { token: string; groupName: string; seasonName: string }) {
  const t = useTranslations("survey");
  const locale = useLocale();
  const zh = locale.startsWith("zh");
  const [stepIdx, setStepIdx] = useState(0);
  const [answers, setAnswers] = useState<SurveyAnswers>(emptyAnswers);
  const [formatChoice, setFormatChoice] = useState<string>();
  const [freeText, setFreeText] = useState("");
  const [share, setShare] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [result, setResult] = useState<{ crisis: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const step = STEPS[stepIdx];
  const label = (o: { en: string; zh: string }) => (zh ? o.zh : o.en);
  const qText = (q: SurveyQuestion) => (zh ? q.text_zh : q.text_en);
  const update = (fn: (a: SurveyAnswers) => SurveyAnswers) => setAnswers((a) => fn(structuredClone(a)));

  function valueOf(q: SurveyQuestion): string | string[] | undefined {
    switch (q.section) {
      case "A":
        return answers.context[CONTEXT_KEY[q.id]];
      case "B1":
        return answers.confidence[q.tag_key!]?.toString();
      case "B2":
        return answers.quiz[q.id];
      case "C":
        return answers.practice[q.tag_key!]?.toString();
      case "D":
        return q.type === "multi" ? answers.events : undefined;
      case "E":
        if (q.id === "e_interests") return answers.interests;
        if (q.id === "e_format") return formatChoice;
        if (q.id === "e_depth") return answers.depth?.toString();
        if (q.id === "e_prep") return answers.prepMinutes?.toString();
    }
    return undefined;
  }

  function setSingle(q: SurveyQuestion, v: string) {
    if (q.id === "e_format") setFormatChoice(v);
    update((a) => {
      switch (q.section) {
        case "A":
          a.context[CONTEXT_KEY[q.id]] = v;
          break;
        case "B1":
          a.confidence[q.tag_key!] = Number(v);
          break;
        case "B2":
          a.quiz[q.id] = v;
          break;
        case "C":
          a.practice[q.tag_key!] = Number(v);
          break;
        case "E":
          if (q.id === "e_format") a.format = v === "mixed" ? undefined : v;
          if (q.id === "e_depth") a.depth = Number(v);
          if (q.id === "e_prep") a.prepMinutes = Number(v);
          break;
      }
      return a;
    });
  }

  function toggleMulti(q: SurveyQuestion, v: string) {
    update((a) => {
      const key = q.id === "e_interests" ? "interests" : "events";
      const list = a[key];
      if (list.includes(v)) a[key] = list.filter((x) => x !== v);
      else if (!q.max || list.length < q.max) a[key] = [...list, v];
      return a;
    });
  }

  function renderOptions(q: SurveyQuestion, options: Option[]) {
    const current = valueOf(q);
    const multi = q.type === "multi";
    return (
      <div className={cn("grid gap-2", options.length > 6 ? "grid-cols-2" : "grid-cols-1")}>
        {options.map((o) => (
          <Choice
            key={o.value}
            testId={`opt-${q.id}-${o.value}`}
            selected={multi ? (current as string[]).includes(o.value) : current === o.value}
            onClick={() => (multi ? toggleMulti(q, o.value) : setSingle(q, o.value))}
          >
            {label(o)}
          </Choice>
        ))}
      </div>
    );
  }

  function renderQuestion(q: SurveyQuestion) {
    let body: React.ReactNode = null;
    if (q.type === "scale") {
      const current = valueOf(q);
      body = (
        <div>
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: q.max ?? 5 }, (_, i) => String(i + 1)).map((v) => (
              <Choice key={v} testId={`opt-${q.id}-${v}`} selected={current === v} onClick={() => setSingle(q, v)}>
                <span className="block text-center">{v}</span>
              </Choice>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>{t("scaleLow")}</span>
            <span>{t("scaleHigh")}</span>
          </div>
        </div>
      );
    } else if (q.type === "emotion") {
      body = (
        <div className="flex flex-col gap-4">
          {q.options!.map((emo) => (
            <div key={emo.value}>
              <p className="mb-1.5 text-sm font-medium">{label(emo)}</p>
              <div className="grid grid-cols-5 gap-1.5">
                {INTENSITY_LABELS.map((lvl) => {
                  const selected = answers.emotions[emo.value as keyof SurveyAnswers["emotions"]] === Number(lvl.value);
                  return (
                    <Choice
                      key={lvl.value}
                      testId={`opt-emo-${emo.value}-${lvl.value}`}
                      selected={selected}
                      onClick={() =>
                        update((a) => {
                          a.emotions[emo.value as keyof SurveyAnswers["emotions"]] = Number(lvl.value);
                          return a;
                        })
                      }
                    >
                      <span className="block text-center text-xs leading-tight">{label(lvl)}</span>
                    </Choice>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      );
    } else if (q.type === "text") {
      body = (
        <Textarea
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          maxLength={2000}
          rows={5}
          data-testid="free-text"
          aria-label={qText(q)}
        />
      );
    } else if (q.options) {
      body = renderOptions(q, q.options);
    }
    return (
      <fieldset key={q.id} className="flex flex-col gap-3">
        <legend className="mb-3 font-medium">
          {qText(q)}
          {q.max && q.type === "multi" ? <span className="ml-1 text-sm font-normal text-muted-foreground">({t("pickUpTo", { n: q.max })})</span> : null}
        </legend>
        {body}
      </fieldset>
    );
  }

  function submit() {
    setError(null);
    start(async () => {
      const res = await submitSurveyAction(token, {
        locale: zh ? "zh-Hant" : "en",
        answers,
        freeText,
        shareWithLeader: share,
        displayName: share ? displayName : "",
      });
      if (res.ok) {
        setResult({ crisis: res.crisis });
        window.scrollTo({ top: 0 });
      } else setError(res.error === "closed" ? t("errorClosed") : t("errorInvalid"));
    });
  }

  const go = (d: number) => {
    setStepIdx((i) => Math.min(STEPS.length - 1, Math.max(0, i + d)));
    window.scrollTo({ top: 0 });
  };

  if (result) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-10" data-testid="survey-thanks">
        <h1 className="text-2xl font-semibold">{t("thanksTitle")}</h1>
        <p className="text-muted-foreground">{t("thanksBody")}</p>
        <CrisisResources prominent={result.crisis} locale={locale} />
      </div>
    );
  }

  const isLast = stepIdx === STEPS.length - 1;
  const questions = step === "intro" ? [] : QUESTIONS.filter((q) => q.section === step);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{groupName}</p>
          <p className="truncate font-semibold">{seasonName}</p>
        </div>
        <LanguageToggle />
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full bg-primary transition-all" style={{ width: `${(stepIdx / (STEPS.length - 1)) * 100}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{t("progress", { n: stepIdx + 1, total: STEPS.length })}</p>

      <Card>
        <CardContent className="flex flex-col gap-6 pt-6">
          {step === "intro" ? (
            <div className="flex flex-col gap-3" data-testid="survey-intro">
              <h1 className="text-xl font-semibold">{t("introTitle")}</h1>
              <p>{t("introBody")}</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>{t("introNotTest")}</li>
                <li>{t("introAnonymous")}</li>
                <li>{t("introTime")}</li>
              </ul>
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-lg font-semibold">{t(`section.${step}.title`)}</h2>
                <p className="text-sm text-muted-foreground">{t(`section.${step}.hint`)}</p>
              </div>
              {questions.map(renderQuestion)}
              {step === "F" && (
                <div className="flex flex-col gap-3 rounded-lg border p-4">
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={share}
                      onChange={(e) => setShare(e.target.checked)}
                      data-testid="share-name"
                    />
                    <span>{t("shareName")}</span>
                  </label>
                  {share && (
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="displayName">{t("displayName")}</Label>
                      <Input id="displayName" value={displayName} maxLength={60} onChange={(e) => setDisplayName(e.target.value)} />
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">{t("privacyNote")}</p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex justify-between gap-2 pb-8">
        <Button type="button" variant="outline" onClick={() => go(-1)} disabled={stepIdx === 0 || pending}>
          {t("back")}
        </Button>
        {isLast ? (
          <Button type="button" onClick={submit} disabled={pending || (share && !displayName.trim())} data-testid="survey-submit">
            {pending ? t("submitting") : t("submit")}
          </Button>
        ) : (
          <Button type="button" onClick={() => go(1)} data-testid="survey-next">
            {stepIdx === 0 ? t("start") : t("next")}
          </Button>
        )}
      </div>
    </div>
  );
}
