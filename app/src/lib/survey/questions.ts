import { BIBLE_AREAS, EMOTIONS, LIFE_STAGES, PRACTICES, SITUATIONS, TAG_BY_KEY, type Emotion } from "../taxonomy";

export type Section = "A" | "B1" | "B2" | "C" | "D" | "E" | "F";
export type QuestionType = "single" | "multi" | "scale" | "quiz" | "frequency" | "emotion" | "text";

export interface Option {
  value: string;
  en: string;
  zh: string;
}

export interface SurveyQuestion {
  id: string;
  section: Section;
  type: QuestionType;
  tag_key?: string;
  /** Quiz difficulty 1 (easy) – 3 (hard). */
  difficulty?: number;
  options?: Option[];
  correct?: string;
  text_en: string;
  text_zh: string;
  max?: number;
  optional?: boolean;
}

/** Structured answers produced by the survey UI. */
export interface SurveyAnswers {
  context: { lifeStage?: string; years?: string; involvement?: string; language?: string };
  /** bible_area -> 1..5 */
  confidence: Record<string, number>;
  /** quiz question id -> option value or "unsure" */
  quiz: Record<string, string>;
  /** practice tag -> 0 (never) .. 4 (daily) */
  practice: Record<string, number>;
  /** situation tag keys */
  events: string[];
  /** emotion -> 0 (not at all) .. 4 (very much) over the past month */
  emotions: Partial<Record<Emotion, number>>;
  /** up to 3 tag keys */
  interests: string[];
  format?: string;
  depth?: number;
  prepMinutes?: number;
}

export const UNSURE = "unsure";

const tagOpt = (key: string): Option => ({ value: key, en: TAG_BY_KEY[key].label_en, zh: TAG_BY_KEY[key].label_zh });

export const FREQUENCY_LABELS: Option[] = [
  { value: "0", en: "Rarely / never", zh: "很少／從不" },
  { value: "1", en: "A few times a year", zh: "一年幾次" },
  { value: "2", en: "Monthly", zh: "每月" },
  { value: "3", en: "Weekly", zh: "每週" },
  { value: "4", en: "Most days", zh: "幾乎每天" },
];

export const INTENSITY_LABELS: Option[] = [
  { value: "0", en: "Not at all", zh: "完全沒有" },
  { value: "1", en: "A little", zh: "少許" },
  { value: "2", en: "Some", zh: "一些" },
  { value: "3", en: "Quite a lot", zh: "頗多" },
  { value: "4", en: "Very much", zh: "非常多" },
];

export const EMOTION_LABELS: Record<Emotion, { en: string; zh: string }> = {
  peace: { en: "Peace", zh: "平安" },
  anxiety: { en: "Anxiety or worry", zh: "焦慮或擔心" },
  loneliness: { en: "Loneliness", zh: "孤單" },
  hope: { en: "Hope", zh: "盼望" },
  tiredness: { en: "Tiredness", zh: "疲累" },
};

const AREA_PROMPTS: Record<string, { en: string; zh: string }> = {
  big_story: { en: "the Bible's overall story from creation to new creation", zh: "聖經由創造到新創造的整體故事" },
  ot_narrative: { en: "the Old Testament stories and law (Genesis–Esther)", zh: "舊約的歷史與律法（創世記至以斯帖記）" },
  wisdom_poetry: { en: "Psalms, Proverbs and the wisdom books", zh: "詩篇、箴言等智慧書" },
  prophets: { en: "the Prophets (Isaiah–Malachi)", zh: "先知書（以賽亞書至瑪拉基書）" },
  gospels: { en: "Jesus' life and teaching in the Gospels", zh: "福音書中耶穌的生平與教導" },
  acts_early_church: { en: "Acts and the early church", zh: "使徒行傳與初期教會" },
  letters: { en: "Paul's letters and the other New Testament letters", zh: "保羅書信及其他新約書信" },
  revelation_apocalyptic: { en: "Revelation", zh: "啟示錄" },
};

const quiz = (
  id: string,
  tag_key: string,
  difficulty: number,
  text_en: string,
  text_zh: string,
  options: [string, string, string][],
  correct: string,
): SurveyQuestion => ({
  id,
  section: "B2",
  type: "quiz",
  tag_key,
  difficulty,
  text_en,
  text_zh,
  options: [...options.map(([value, en, zh]) => ({ value, en, zh })), { value: UNSURE, en: "I'm not sure", zh: "我不肯定" }],
  correct,
});

/** Topics members can pick as interests (section E). */
export const INTEREST_TOPICS = [
  "big_story", "gospels", "prophets", "wisdom_poetry", "letters", "revelation_apocalyptic",
  "prayer", "bible_reading", "sharing_faith", "serving",
  "anxiety", "rest", "hope", "grief", "suffering", "doubt", "identity", "relationships",
  "marriage", "parenting", "work_purpose", "money", "forgiveness", "discipleship", "justice",
];

export const QUESTIONS: SurveyQuestion[] = [
  // A — context
  { id: "a_life_stage", section: "A", type: "single", text_en: "Which best describes your stage of life?", text_zh: "以下哪項最能描述你現時的人生階段？", options: LIFE_STAGES.map(tagOpt) },
  {
    id: "a_years", section: "A", type: "single", text_en: "How long have you been following Jesus?", text_zh: "你跟隨耶穌多久了？",
    options: [
      { value: "exploring", en: "Still exploring", zh: "仍在探索" },
      { value: "lt1", en: "Less than 1 year", zh: "少於 1 年" },
      { value: "1to5", en: "1–5 years", zh: "1–5 年" },
      { value: "5to15", en: "5–15 years", zh: "5–15 年" },
      { value: "gt15", en: "More than 15 years", zh: "超過 15 年" },
    ],
  },
  {
    id: "a_involvement", section: "A", type: "single", text_en: "How involved are you in church at the moment?", text_zh: "你現時在教會的參與程度如何？",
    options: [
      { value: "new", en: "New / visiting", zh: "新來／探訪" },
      { value: "sometimes", en: "Attend sometimes", zh: "間中出席" },
      { value: "regular", en: "Attend regularly", zh: "定期出席" },
      { value: "serving", en: "Attend and serve", zh: "出席並有事奉" },
    ],
  },
  {
    id: "a_language", section: "A", type: "single", text_en: "Which language do you prefer for study material?", text_zh: "你較喜歡用哪種語言的查經材料？",
    options: [
      { value: "en", en: "English", zh: "英文" },
      { value: "zh-Hant", en: "Traditional Chinese", zh: "繁體中文" },
      { value: "either", en: "Either is fine", zh: "兩者皆可" },
    ],
  },

  // B1 — confidence per Bible area
  ...BIBLE_AREAS.map<SurveyQuestion>((area) => ({
    id: `b1_${area}`,
    section: "B1",
    type: "scale",
    tag_key: area,
    text_en: `How confident would you feel explaining ${AREA_PROMPTS[area].en} to a friend?`,
    text_zh: `如果要向朋友解釋${AREA_PROMPTS[area].zh}，你有幾大信心？`,
    max: 5,
  })),

  // B2 — knowledge check
  quiz("b2_exodus", "ot_narrative", 1, "Who led the Israelites out of slavery in Egypt?", "誰帶領以色列人離開埃及的奴役？",
    [["moses", "Moses", "摩西"], ["abraham", "Abraham", "亞伯拉罕"], ["david", "David", "大衛"], ["elijah", "Elijah", "以利亞"]], "moses"),
  quiz("b2_abraham", "big_story", 2, "What did God promise Abraham in Genesis 12?", "在創世記 12 章，神應許亞伯拉罕甚麼？",
    [["nations", "Through his family all nations would be blessed", "地上萬族必因他的家族得福"], ["king", "His family would rule Egypt", "他的家族會統治埃及"], ["law", "He would receive the law on stone tablets", "他會領受刻在石版上的律法"], ["temple", "He would build the temple", "他會建造聖殿"]], "nations"),
  quiz("b2_psalms", "wisdom_poetry", 1, "Which book is mainly a collection of prayers and songs, including laments?", "哪一卷書主要收集了禱告和詩歌，包括哀歌？",
    [["psalms", "Psalms", "詩篇"], ["proverbs", "Proverbs", "箴言"], ["leviticus", "Leviticus", "利未記"], ["romans", "Romans", "羅馬書"]], "psalms"),
  quiz("b2_ecclesiastes", "wisdom_poetry", 3, "Which book repeatedly says life 'under the sun' is hevel (vapour / meaningless)?", "哪一卷書多次說「日光之下」的人生是虛空（如煙霧）？",
    [["ecclesiastes", "Ecclesiastes", "傳道書"], ["job", "Job", "約伯記"], ["lamentations", "Lamentations", "耶利米哀歌"], ["james", "James", "雅各書"]], "ecclesiastes"),
  quiz("b2_prophets", "prophets", 2, "What was a major concern of prophets like Amos and Micah?", "阿摩司和彌迦等先知最關注的其中一件事是甚麼？",
    [["injustice", "Injustice to the poor alongside empty worship", "欺壓窮人，同時敬拜流於空洞"], ["rome", "Defeating the Roman empire", "打敗羅馬帝國"], ["temple_build", "Raising money to build the first temple", "籌款建造第一座聖殿"], ["circumcision", "Whether Gentiles must be circumcised", "外邦人是否要受割禮"]], "injustice"),
  quiz("b2_bethlehem", "gospels", 1, "In which town was Jesus born?", "耶穌在哪個城鎮出生？",
    [["bethlehem", "Bethlehem", "伯利恆"], ["nazareth", "Nazareth", "拿撒勒"], ["jerusalem", "Jerusalem", "耶路撒冷"], ["capernaum", "Capernaum", "迦百農"]], "bethlehem"),
  quiz("b2_kingdom", "gospels", 2, "What central message did Jesus announce at the start of his ministry (Mark 1:15)?", "耶穌開始傳道時宣講的核心信息是甚麼（馬可福音 1:15）？",
    [["kingdom", "The kingdom of God has come near", "神的國近了"], ["sabbath", "Keep the Sabbath more strictly", "要更嚴格守安息日"], ["temple", "Rebuild the temple", "重建聖殿"], ["wilderness", "Flee to the wilderness", "逃到曠野"]], "kingdom"),
  quiz("b2_pentecost", "acts_early_church", 2, "What happened at Pentecost in Acts 2?", "使徒行傳 2 章的五旬節發生了甚麼事？",
    [["spirit", "The Holy Spirit came upon the disciples", "聖靈降臨在門徒身上"], ["baptism", "Jesus was baptised", "耶穌受洗"], ["paul", "Paul met Jesus on the road to Damascus", "保羅在大馬士革路上遇見耶穌"], ["fall", "The temple was destroyed", "聖殿被毀"]], "spirit"),
  quiz("b2_grace", "letters", 2, "According to Ephesians 2:8–9, how are people saved?", "根據以弗所書 2:8–9，人是怎樣得救的？",
    [["grace", "By grace through faith", "本乎恩，也因著信"], ["law", "By keeping the law", "靠遵守律法"], ["works", "By doing enough good deeds", "靠行足夠的善事"], ["birth", "By being born into a believing family", "靠出生於信徒家庭"]], "grace"),
  quiz("b2_revelation", "revelation_apocalyptic", 3, "How does the book of Revelation end?", "啟示錄是如何結束的？",
    [["new_creation", "A new heaven and new earth where God lives with his people", "新天新地，神與祂的子民同住"], ["escape", "Believers leave the earth behind forever", "信徒永遠離開地球"], ["destroyed", "All of creation is destroyed with nothing after", "整個受造界被毀滅，之後一無所有"], ["egypt", "Israel returns to Egypt", "以色列回到埃及"]], "new_creation"),

  // C — practices
  ...PRACTICES.map<SurveyQuestion>((p) => ({
    id: `c_${p}`,
    section: "C",
    type: "frequency",
    tag_key: p,
    text_en: {
      bible_reading: "How often do you read the Bible on your own?",
      prayer: "How often do you spend time in prayer?",
      community: "How often do you connect with other Christians outside Sunday service?",
      serving: "How often do you serve others (church or community)?",
      sharing_faith: "How often do you talk about your faith with non-Christians?",
    }[p]!,
    text_zh: {
      bible_reading: "你多久會自己讀一次聖經？",
      prayer: "你多久會花時間禱告？",
      community: "主日崇拜以外，你多久會與其他基督徒相聚？",
      serving: "你多久會服侍他人（教會或社區）？",
      sharing_faith: "你多久會與未信者談及你的信仰？",
    }[p]!,
    options: FREQUENCY_LABELS,
  })),

  // D — life events and emotions
  {
    id: "d_events", section: "D", type: "multi", optional: true,
    text_en: "Has anything like this happened in the past 6 months? (optional, choose any)",
    text_zh: "過去六個月有沒有發生以下事情？（可選，可選多項）",
    options: SITUATIONS.map(tagOpt),
  },
  {
    id: "d_emotions", section: "D", type: "emotion",
    text_en: "Over the past month, how much have you felt…",
    text_zh: "過去一個月，你有多少感到……",
    options: EMOTIONS.map((e) => ({ value: e, ...EMOTION_LABELS[e] })),
  },

  // E — preferences
  { id: "e_interests", section: "E", type: "multi", max: 3, text_en: "Pick up to 3 topics you'd love the group to explore", text_zh: "揀選最多 3 個你希望小組探討的題目", options: INTEREST_TOPICS.map(tagOpt) },
  {
    id: "e_format", section: "E", type: "single", text_en: "What kind of study helps you most?", text_zh: "哪種查經形式對你最有幫助？",
    options: [
      { value: "video", en: "Short video + discussion", zh: "短片 + 討論" },
      { value: "discussion", en: "Discussion of a Bible passage", zh: "討論經文" },
      { value: "reading", en: "Reading a book / guide together", zh: "一起閱讀書籍／指引" },
      { value: "mixed", en: "A mix is fine", zh: "混合都可以" },
    ],
  },
  {
    id: "e_depth", section: "E", type: "single", text_en: "How deep would you like to go?", text_zh: "你希望探討得有多深入？",
    options: [
      { value: "1", en: "Keep it simple", zh: "簡單易明" },
      { value: "2", en: "Some depth", zh: "有一定深度" },
      { value: "3", en: "Go deep", zh: "深入探討" },
    ],
  },
  {
    id: "e_prep", section: "E", type: "single", text_en: "How much time could you prepare each week?", text_zh: "你每星期可以花多少時間預備？",
    options: [
      { value: "0", en: "None", zh: "沒有時間" },
      { value: "15", en: "About 15 minutes", zh: "大約 15 分鐘" },
      { value: "30", en: "About 30 minutes", zh: "大約 30 分鐘" },
      { value: "60", en: "An hour or more", zh: "一小時或以上" },
    ],
  },

  // F — free text
  {
    id: "f_text", section: "F", type: "text", optional: true,
    text_en: "Anything else you'd like your leader to know or pray about? (optional — please don't include names or contact details)",
    text_zh: "還有甚麼想讓組長知道或為你代禱嗎？（可選——請不要寫上姓名或聯絡資料）",
  },
];

export const QUIZ_QUESTIONS = QUESTIONS.filter((q) => q.type === "quiz");
export const SECTIONS: Section[] = ["A", "B1", "B2", "C", "D", "E", "F"];

export function emptyAnswers(): SurveyAnswers {
  return { context: {}, confidence: {}, quiz: {}, practice: {}, events: [], emotions: {}, interests: [] };
}
