import { BIBLE_AREAS, EMOTION_TO_TAG, EMOTIONS, NEED_TAGS, PRACTICES, SITUATION_TO_NEEDS } from "../taxonomy";
import type { SurveyAnswers, SurveyQuestion } from "../survey/questions";
import { UNSURE } from "../survey/questions";

export const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

/** Beta prior used to shrink quiz accuracy towards 0.5 when few questions were answered. */
export const BETA_PRIOR = { alpha: 1, beta: 1 };
export const QUIZ_WEIGHT = 0.7;
export const CONFIDENCE_WEIGHT = 0.3;
export const NEED_THRESHOLD = 0.5;

export interface MemberProfile {
  /** tag -> need in [0,1] */
  needs: Record<string, number>;
  /** bible_area -> mastery in [0,1] */
  mastery: Record<string, number>;
  /** mean mastery across bible areas */
  overallMastery: number;
  interests: string[];
  format?: string;
  depth?: number;
  prepMinutes?: number;
}

/** Shrunk accuracy: (correct + α) / (n + α + β). "I'm not sure" counts as answered but not correct. */
export function shrunkAccuracy(correct: number, answered: number, prior = BETA_PRIOR): number {
  return (correct + prior.alpha) / (answered + prior.alpha + prior.beta);
}

/** Confidence 1..5 -> [0,1]; missing -> 0.5. */
export function normaliseConfidence(c: number | undefined): number {
  if (c == null || !Number.isFinite(c)) return 0.5;
  return clamp01((c - 1) / 4);
}

export function computeMastery(answers: SurveyAnswers, quizQuestions: SurveyQuestion[]): Record<string, number> {
  const mastery: Record<string, number> = {};
  for (const area of BIBLE_AREAS) {
    const qs = quizQuestions.filter((q) => q.tag_key === area);
    let correct = 0;
    let answered = 0;
    for (const q of qs) {
      const a = answers.quiz[q.id];
      if (a == null) continue;
      answered += 1;
      if (a !== UNSURE && a === q.correct) correct += 1;
    }
    const acc = shrunkAccuracy(correct, answered);
    mastery[area] = clamp01(QUIZ_WEIGHT * acc + CONFIDENCE_WEIGHT * normaliseConfidence(answers.confidence[area]));
  }
  return mastery;
}

/** Extra tagged needs coming from free text (LLM/keyword tagger), tag -> [0,1]. */
export type FreeTextNeeds = Record<string, number>;

export function computeMemberProfile(
  answers: SurveyAnswers,
  quizQuestions: SurveyQuestion[],
  freeTextNeeds: FreeTextNeeds = {},
): MemberProfile {
  const needs: Record<string, number> = {};
  const bump = (tag: string, v: number) => {
    needs[tag] = Math.max(needs[tag] ?? 0, clamp01(v));
  };

  const mastery = computeMastery(answers, quizQuestions);
  for (const area of BIBLE_AREAS) bump(area, 1 - mastery[area]);

  for (const p of PRACTICES) {
    const f = answers.practice[p];
    if (f != null) bump(p, 1 - clamp01(f / 4));
  }

  for (const e of EMOTIONS) {
    const v = answers.emotions[e];
    if (v == null) continue;
    const { tag, inverted } = EMOTION_TO_TAG[e];
    const intensity = clamp01(v / 4);
    bump(tag, inverted ? 1 - intensity : intensity);
  }

  for (const ev of answers.events ?? []) {
    for (const tag of SITUATION_TO_NEEDS[ev] ?? []) bump(tag, 0.75);
  }

  for (const [tag, v] of Object.entries(freeTextNeeds)) {
    if (NEED_TAGS.includes(tag)) bump(tag, v);
  }

  const areaValues = BIBLE_AREAS.map((a) => mastery[a]);
  return {
    needs,
    mastery,
    overallMastery: areaValues.reduce((s, x) => s + x, 0) / areaValues.length,
    interests: (answers.interests ?? []).slice(0, 3),
    format: answers.format,
    depth: answers.depth,
    prepMinutes: answers.prepMinutes,
  };
}

export interface TagNeed {
  tag: string;
  /** 0.5·prevalence + 0.3·mean + 0.2·urgency */
  need: number;
  prevalence: number;
  mean: number;
  urgency: number;
  /** members with need > threshold */
  count: number;
  /** share of members who picked this as an interest */
  interestShare: number;
  interestCount: number;
  leaderEstimate?: number;
}

export interface HiddenNeed {
  tag: string;
  need: number;
  reason: "low_interest" | "leader_underestimate";
}

export interface GroupNeedProfile {
  n: number;
  needs: TagNeed[];
  hiddenNeeds: HiddenNeed[];
  depthTarget: 1 | 2 | 3;
  masterySpread: number;
  tieredQuestions: boolean;
  formatShare: Record<string, number>;
  medianPrepMinutes: number | null;
}

export const GROUP_WEIGHTS = { prevalence: 0.5, mean: 0.3, urgency: 0.2 };

export function groupTagNeed(values: number[]): Pick<TagNeed, "need" | "prevalence" | "mean" | "urgency" | "count"> {
  const n = values.length;
  if (n === 0) return { need: 0, prevalence: 0, mean: 0, urgency: 0, count: 0 };
  const count = values.filter((v) => v > NEED_THRESHOLD).length;
  const prevalence = count / n;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const urgency = Math.max(...values);
  const need = GROUP_WEIGHTS.prevalence * prevalence + GROUP_WEIGHTS.mean * mean + GROUP_WEIGHTS.urgency * urgency;
  return { need: clamp01(need), prevalence, mean, urgency, count };
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length);
}

export function masteryToDepth(m: number): 1 | 2 | 3 {
  if (m < 0.45) return 1;
  if (m < 0.7) return 2;
  return 3;
}

export const HIDDEN_NEED_MIN = 0.45;
export const LOW_INTEREST_SHARE = 0.2;
export const LEADER_GAP = 0.3;
export const TIERED_SPREAD = 0.35;

/**
 * Aggregate member profiles into a group profile.
 * `leaderObservations` maps tag -> leader's estimate of the group's need in [0,1].
 */
export function computeGroupProfile(
  members: MemberProfile[],
  leaderObservations: Record<string, number> = {},
): GroupNeedProfile {
  const n = members.length;
  const needs: TagNeed[] = NEED_TAGS.map((tag) => {
    const values = members.map((m) => m.needs[tag] ?? 0);
    const interestCount = members.filter((m) => m.interests.includes(tag)).length;
    return {
      tag,
      ...groupTagNeed(values),
      interestShare: n ? interestCount / n : 0,
      interestCount,
      leaderEstimate: leaderObservations[tag],
    };
  }).sort((a, b) => b.need - a.need);

  const hiddenNeeds: HiddenNeed[] = [];
  for (const t of needs) {
    if (t.need < HIDDEN_NEED_MIN) continue;
    if (t.leaderEstimate != null && t.leaderEstimate < t.need - LEADER_GAP) {
      hiddenNeeds.push({ tag: t.tag, need: t.need, reason: "leader_underestimate" });
    } else if (t.interestShare < LOW_INTEREST_SHARE) {
      hiddenNeeds.push({ tag: t.tag, need: t.need, reason: "low_interest" });
    }
  }

  const masteries = members.map((m) => m.overallMastery);
  const med = median(masteries) ?? 0.5;
  const prefDepths = members.map((m) => m.depth).filter((d): d is number => d != null);
  const prefMean = prefDepths.length ? prefDepths.reduce((s, d) => s + d, 0) / prefDepths.length : null;
  const masteryDepth = masteryToDepth(med);
  const blended = prefMean == null ? masteryDepth : 0.7 * masteryDepth + 0.3 * prefMean;
  const depthTarget = Math.min(3, Math.max(1, Math.round(blended))) as 1 | 2 | 3;

  const spread = masteries.length ? Math.max(...masteries) - Math.min(...masteries) : 0;
  const tieredQuestions = spread >= TIERED_SPREAD || stddev(masteries) > 0.15;

  const formatShare: Record<string, number> = {};
  const withFormat = members.filter((m) => m.format);
  for (const m of withFormat) formatShare[m.format!] = (formatShare[m.format!] ?? 0) + 1 / withFormat.length;

  return {
    n,
    needs,
    hiddenNeeds,
    depthTarget,
    masterySpread: spread,
    tieredQuestions,
    formatShare,
    medianPrepMinutes: median(members.map((m) => m.prepMinutes).filter((x): x is number => x != null)),
  };
}

/** Privacy: group breakdowns are hidden below this many responses. */
export const MIN_RESPONSES = 3;
/** Below this many responses, show counts rather than percentages. */
export const PERCENT_MIN_RESPONSES = 5;

export function canShowBreakdown(n: number): boolean {
  return n >= MIN_RESPONSES;
}

export function formatShare(count: number, n: number, locale: string): string {
  if (n < PERCENT_MIN_RESPONSES) return locale.startsWith("zh") ? `${n} 人中 ${count} 人` : `${count} of ${n}`;
  return `${Math.round((count / n) * 100)}%`;
}
