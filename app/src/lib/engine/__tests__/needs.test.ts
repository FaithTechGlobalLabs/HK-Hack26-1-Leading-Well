import { describe, expect, it } from "vitest";
import {
  computeGroupProfile,
  computeMastery,
  computeMemberProfile,
  formatShare,
  groupTagNeed,
  shrunkAccuracy,
  type MemberProfile,
} from "../needs";
import { emptyAnswers, QUIZ_QUESTIONS, UNSURE } from "../../survey/questions";
import { syntheticAnswers } from "../synthetic";

const allCorrect = () => {
  const a = emptyAnswers();
  for (const q of QUIZ_QUESTIONS) a.quiz[q.id] = q.correct!;
  return a;
};

describe("member needs", () => {
  it("shrinks quiz accuracy towards 0.5 with a Beta(1,1) prior", () => {
    expect(shrunkAccuracy(0, 0)).toBe(0.5);
    expect(shrunkAccuracy(1, 1)).toBeCloseTo(2 / 3);
    expect(shrunkAccuracy(0, 1)).toBeCloseTo(1 / 3);
    expect(shrunkAccuracy(10, 10)).toBeCloseTo(11 / 12);
  });

  it("combines 0.7·quiz + 0.3·confidence into mastery", () => {
    const a = allCorrect();
    a.confidence.gospels = 5; // gospels has 2 quiz items -> (2+1)/(2+2)=0.75
    const m = computeMastery(a, QUIZ_QUESTIONS);
    expect(m.gospels).toBeCloseTo(0.7 * 0.75 + 0.3 * 1);
    // one quiz item, no confidence given -> 0.5
    expect(m.prophets).toBeCloseTo(0.7 * (2 / 3) + 0.3 * 0.5);
  });

  it("treats 'I'm not sure' as answered but not correct", () => {
    const a = emptyAnswers();
    a.quiz.b2_exodus = UNSURE;
    a.confidence.ot_narrative = 1;
    const m = computeMastery(a, QUIZ_QUESTIONS);
    expect(m.ot_narrative).toBeCloseTo(0.7 * (1 / 3));
  });

  it("derives practice, emotion (incl. inverted) and life-event needs", () => {
    const a = emptyAnswers();
    a.practice.prayer = 4;
    a.practice.bible_reading = 0;
    a.emotions = { anxiety: 4, peace: 0, hope: 4 };
    a.events = ["bereavement"];
    const p = computeMemberProfile(a, QUIZ_QUESTIONS, { doubt: 0.6 });
    expect(p.needs.prayer).toBe(0);
    expect(p.needs.bible_reading).toBe(1);
    expect(p.needs.anxiety).toBe(1);
    expect(p.needs.peace).toBe(1);
    expect(p.needs.hope).toBe(0.75); // from bereavement; the hope emotion itself was high
    expect(p.needs.grief).toBe(0.75);
    expect(p.needs.doubt).toBe(0.6);
  });

  it("keeps at most 3 interests", () => {
    const a = emptyAnswers();
    a.interests = ["prayer", "anxiety", "hope", "grief"];
    expect(computeMemberProfile(a, QUIZ_QUESTIONS).interests).toEqual(["prayer", "anxiety", "hope"]);
  });
});

describe("group needs", () => {
  it("weights prevalence, mean and urgency 0.5/0.3/0.2", () => {
    const r = groupTagNeed([1, 0.6, 0.2, 0]);
    expect(r.count).toBe(2);
    expect(r.prevalence).toBe(0.5);
    expect(r.mean).toBeCloseTo(0.45);
    expect(r.urgency).toBe(1);
    expect(r.need).toBeCloseTo(0.5 * 0.5 + 0.3 * 0.45 + 0.2 * 1);
  });

  const member = (needs: Record<string, number>, mastery = 0.5, interests: string[] = []): MemberProfile => ({
    needs,
    mastery: {},
    overallMastery: mastery,
    interests,
  });

  it("flags hidden needs: high need but low interest or leader underestimate", () => {
    const members = [
      member({ grief: 0.9, anxiety: 0.9 }, 0.5, ["anxiety"]),
      member({ grief: 0.8, anxiety: 0.8 }, 0.5, ["anxiety"]),
      member({ grief: 0.7, anxiety: 0.7 }, 0.5, ["anxiety"]),
    ];
    const g = computeGroupProfile(members, { anxiety: 0.1 });
    const hidden = Object.fromEntries(g.hiddenNeeds.map((h) => [h.tag, h.reason]));
    expect(hidden.grief).toBe("low_interest");
    expect(hidden.anxiety).toBe("leader_underestimate");
    expect(g.needs[0].need).toBeGreaterThan(0.7);
  });

  it("sets depth target from mastery and a tiered flag for wide spread", () => {
    const narrow = computeGroupProfile([member({}, 0.8), member({}, 0.85), member({}, 0.82)]);
    expect(narrow.depthTarget).toBe(3);
    expect(narrow.tieredQuestions).toBe(false);
    const wide = computeGroupProfile([member({}, 0.1), member({}, 0.5), member({}, 0.9)]);
    expect(wide.depthTarget).toBe(2);
    expect(wide.tieredQuestions).toBe(true);
  });

  it("produces a sensible profile from synthetic responses", () => {
    const members = syntheticAnswers(8, { seed: 7, knowledge: 0.3, themes: ["anxiety", "rest"] }).map((s) =>
      computeMemberProfile(s.answers, QUIZ_QUESTIONS),
    );
    const g = computeGroupProfile(members);
    expect(g.n).toBe(8);
    expect(g.needs.slice(0, 10).map((t) => t.tag)).toContain("anxiety");
    expect(g.needs.every((t) => t.need >= 0 && t.need <= 1)).toBe(true);
  });

  it("shows counts instead of percentages below 5 responses", () => {
    expect(formatShare(2, 4, "en")).toBe("2 of 4");
    expect(formatShare(2, 4, "zh-Hant")).toBe("4 人中 2 人");
    expect(formatShare(3, 6, "en")).toBe("50%");
  });
});
