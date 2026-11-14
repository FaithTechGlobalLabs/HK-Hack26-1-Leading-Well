import { BIBLE_AREAS, EMOTIONS, LIFE_STAGES, PRACTICES, SITUATIONS } from "../taxonomy";
import { INTEREST_TOPICS, QUIZ_QUESTIONS, UNSURE, type SurveyAnswers } from "../survey/questions";

/** Small seeded PRNG (mulberry32) so demo data is reproducible. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SyntheticOptions {
  seed?: number;
  /** Overall knowledge level 0..1 of the group; members vary around it. */
  knowledge?: number;
  /** Tags that are "hot" in this group (raised emotions / interests). */
  themes?: string[];
}

const FREE_TEXTS = [
  "Work has been really stressful and I worry about the future.",
  "I'd love to understand the Old Testament better, I get lost after Genesis.",
  "最近照顧屋企人好攰，希望大家為我禱告。",
  "Feeling a bit lonely since moving here.",
  "想更明白點樣禱告。",
  "",
  "",
];

export function syntheticAnswers(count: number, opts: SyntheticOptions = {}): { answers: SurveyAnswers; freeText: string; locale: string }[] {
  const r = rng(opts.seed ?? 42);
  const base = opts.knowledge ?? 0.5;
  const themes = opts.themes ?? ["anxiety", "rest", "ot_narrative"];
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const out: { answers: SurveyAnswers; freeText: string; locale: string }[] = [];

  for (let i = 0; i < count; i++) {
    const k = Math.min(0.95, Math.max(0.05, base + (r() - 0.5) * 0.6));
    const confidence: Record<string, number> = {};
    for (const a of BIBLE_AREAS) confidence[a] = Math.max(1, Math.min(5, Math.round(1 + 4 * k + (r() - 0.5) * 2)));
    const quiz: Record<string, string> = {};
    for (const q of QUIZ_QUESTIONS) {
      const pCorrect = Math.max(0.05, k - (q.difficulty! - 2) * 0.15);
      const roll = r();
      if (roll < pCorrect) quiz[q.id] = q.correct!;
      else if (roll < pCorrect + 0.5 * (1 - pCorrect)) quiz[q.id] = UNSURE;
      else quiz[q.id] = q.options!.find((o) => o.value !== q.correct && o.value !== UNSURE)!.value;
    }
    const practice: Record<string, number> = {};
    for (const p of PRACTICES) practice[p] = Math.max(0, Math.min(4, Math.round(4 * k + (r() - 0.5) * 3)));
    const emotions: SurveyAnswers["emotions"] = {};
    for (const e of EMOTIONS) {
      const themed = (e === "anxiety" && themes.includes("anxiety")) || (e === "tiredness" && themes.includes("rest")) || (e === "loneliness" && themes.includes("loneliness"));
      const positive = e === "peace" || e === "hope";
      emotions[e] = Math.max(0, Math.min(4, Math.round((themed ? 2.8 : positive ? 2.3 : 1.2) + (r() - 0.5) * 2.5)));
    }
    const events = SITUATIONS.filter(() => r() < 0.08);
    const interestPool = [...themes.filter((t) => INTEREST_TOPICS.includes(t)), ...INTEREST_TOPICS];
    const interests = Array.from(new Set([pick(interestPool), pick(interestPool), pick(INTEREST_TOPICS)])).slice(0, 3);
    const locale = r() < 0.4 ? "zh-Hant" : "en";
    out.push({
      locale,
      freeText: pick(FREE_TEXTS),
      answers: {
        context: { lifeStage: pick(LIFE_STAGES), years: pick(["lt1", "1to5", "5to15", "gt15"]), involvement: pick(["sometimes", "regular", "serving"]), language: locale },
        confidence,
        quiz,
        practice,
        events,
        emotions,
        interests,
        format: pick(["video", "video", "discussion", "mixed", "reading"]),
        depth: Math.max(1, Math.min(3, Math.round(1 + 2 * k))),
        prepMinutes: pick([0, 15, 15, 30, 60]),
      },
    });
  }
  return out;
}
