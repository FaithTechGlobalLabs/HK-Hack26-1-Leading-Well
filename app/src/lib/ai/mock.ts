import { tagLabel } from "../taxonomy";
import type { Recommendation, Resource } from "../engine/recommend";
import type { GroupNeedProfile } from "../engine/needs";

export interface SessionPlan {
  title: string;
  opener: string;
  scripture: { reference: string; note: string }[];
  questions: { beginner: string[]; growing: string[]; mature: string[] };
  application: string;
  prayer_focus: string;
}

export interface Rationale {
  resource_id: string;
  rationale_en: string;
  rationale_zh: string;
}

export const SCRIPTURE_BY_TAG: Record<string, string> = {
  big_story: "Genesis 1:26–31; Revelation 21:1–5",
  ot_narrative: "Exodus 3:1–15",
  wisdom_poetry: "Psalm 13",
  prophets: "Micah 6:6–8",
  gospels: "Mark 1:14–20",
  acts_early_church: "Acts 2:42–47",
  letters: "Ephesians 2:1–10",
  revelation_apocalyptic: "Revelation 21:1–7",
  bible_reading: "Psalm 1; 2 Timothy 3:14–17",
  prayer: "Matthew 6:5–15",
  community: "Hebrews 10:23–25",
  serving: "Mark 10:42–45",
  sharing_faith: "1 Peter 3:13–16",
  anxiety: "Philippians 4:4–9; Matthew 6:25–34",
  loneliness: "Psalm 68:4–6; John 15:12–17",
  rest: "Matthew 11:28–30",
  peace: "John 14:25–27",
  hope: "Romans 5:1–5",
  grief: "John 11:17–44",
  suffering: "Romans 8:18–28",
  doubt: "Mark 9:14–29",
  identity: "Ephesians 1:3–14",
  relationships: "Romans 12:9–18",
  marriage: "Ephesians 5:21–33",
  parenting: "Deuteronomy 6:4–9",
  work_purpose: "Colossians 3:17, 23–24",
  money: "1 Timothy 6:6–19",
  forgiveness: "Matthew 18:21–35",
  discipleship: "Luke 9:23–27",
  justice: "Amos 5:21–24",
  character: "Galatians 5:16–26",
};

function joinList(items: string[], zh: boolean): string {
  if (zh) return items.join("、");
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Deterministic, stats-grounded rationale (used offline and as LLM fallback). */
export function mockRationale(rec: Recommendation, profile: GroupNeedProfile): Rationale {
  const covered = rec.breakdown.coveredTags.slice(0, 2);
  const n = profile.n;
  const en = covered.map((t) => `${tagLabel(t.tag, "en").toLowerCase()} (${t.count} of ${n} members)`);
  const zh = covered.map((t) => `${tagLabel(t.tag, "zh-Hant")}（${n} 人中 ${t.count} 人）`);
  const depthEn = ["", "beginner-friendly", "a moderate depth", "in-depth"][rec.resource.depth];
  const depthZh = ["", "適合初學者", "具一定深度", "較深入"][rec.resource.depth];
  return {
    resource_id: rec.resource.id,
    rationale_en: covered.length
      ? `Covers ${joinList(en, false)}. ${rec.resource.units} session${rec.resource.units > 1 ? "s" : ""}, ${depthEn}.`
      : `A ${depthEn} option that fits your group's format and timeframe.`,
    rationale_zh: covered.length
      ? `涵蓋${joinList(zh, true)}。共 ${rec.resource.units} 次聚會，${depthZh}。`
      : `${depthZh}的選擇，配合小組的形式及時間。`,
  };
}

export function mockSessionPlan(resource: Resource, profile: GroupNeedProfile, locale: string): SessionPlan {
  const zh = locale.startsWith("zh");
  const resourceTags = resource.tags.map((t) => t.tag);
  const groupTop = profile.needs.filter((t) => resourceTags.includes(t.tag)).slice(0, 2).map((t) => t.tag);
  const focus = groupTop.length ? groupTop : resourceTags.slice(0, 2);
  const focusLabel = joinList(focus.map((t) => tagLabel(t, locale)), zh);
  const scripture = (focus.length ? focus : ["big_story"]).map((t) => ({
    reference: SCRIPTURE_BY_TAG[t] ?? "Psalm 23",
    note: zh ? `與「${tagLabel(t, locale)}」相關的經文` : `A passage on ${tagLabel(t, "en").toLowerCase()}`,
  }));
  const title = zh ? resource.title_zh || resource.title : resource.title;
  if (zh) {
    return {
      title,
      opener: `用一個字形容你這星期的狀態。在「${focusLabel}」方面，最近有甚麼經歷？`,
      scripture,
      questions: {
        beginner: [`看完「${title}」後，哪一點令你印象最深？`, "這段經文中，神做了甚麼？人又做了甚麼？"],
        growing: [`這段經文如何改變你對「${focusLabel}」的看法？`, "經文中有甚麼地方挑戰你現時的生活方式？"],
        mature: ["這段經文如何融入聖經的整體故事？", "如果要向未信的朋友解釋這個主題，你會怎樣說？"],
      },
      application: `這星期，揀選一個具體的小步驟，在「${focusLabel}」上回應今次所學，下次聚會時分享。`,
      prayer_focus: `兩人一組，為彼此在「${focusLabel}」上的需要禱告。`,
    };
  }
  return {
    title,
    opener: `Describe your week in one word. Where have you noticed ${focusLabel.toLowerCase()} in your life recently?`,
    scripture,
    questions: {
      beginner: [`What stood out to you most from "${title}"?`, "In this passage, what does God do? What do people do?"],
      growing: [`How does this passage reshape the way you think about ${focusLabel.toLowerCase()}?`, "Where does this passage challenge how you live right now?"],
      mature: ["How does this passage fit into the Bible's big story?", "How would you explain this theme to a friend who doesn't follow Jesus?"],
    },
    application: `Choose one concrete step this week to respond to what you've learned about ${focusLabel.toLowerCase()}, and share how it went next time.`,
    prayer_focus: `In pairs, pray for each other's needs around ${focusLabel.toLowerCase()}.`,
  };
}
