export type TagFamily = "bible_area" | "practice" | "living" | "life_stage" | "situation";

export interface Tag {
  key: string;
  family: TagFamily;
  label_en: string;
  label_zh: string;
  /** Extra keywords (EN + ZH) used by the offline keyword tagger. */
  keywords?: string[];
}

export const TAGS: Tag[] = [
  // Bible knowledge areas
  { key: "big_story", family: "bible_area", label_en: "The Bible's big story", label_zh: "聖經整體故事", keywords: ["story of the bible", "tanak", "storyline", "covenant", "creation", "new creation", "整體", "故事"] },
  { key: "ot_narrative", family: "bible_area", label_en: "Old Testament story & law", label_zh: "舊約歷史與律法", keywords: ["genesis", "exodus", "leviticus", "numbers", "deuteronomy", "joshua", "judges", "ruth", "samuel", "kings", "chronicles", "ezra", "nehemiah", "esther", "torah", "old testament", "舊約", "律法", "創世記", "出埃及"] },
  { key: "wisdom_poetry", family: "bible_area", label_en: "Wisdom & poetry (Psalms, Proverbs…)", label_zh: "智慧書與詩歌（詩篇、箴言…）", keywords: ["job", "psalm", "psalms", "proverbs", "ecclesiastes", "song of songs", "wisdom", "poetry", "lament", "詩篇", "箴言", "智慧"] },
  { key: "prophets", family: "bible_area", label_en: "The Prophets", label_zh: "先知書", keywords: ["isaiah", "jeremiah", "lamentations", "ezekiel", "daniel", "hosea", "joel", "amos", "obadiah", "jonah", "micah", "nahum", "habakkuk", "zephaniah", "haggai", "zechariah", "malachi", "prophet", "prophets", "先知"] },
  { key: "gospels", family: "bible_area", label_en: "Jesus & the Gospels", label_zh: "耶穌與福音書", keywords: ["matthew", "mark", "luke", "gospel", "gospels", "jesus", "sermon on the mount", "parables", "福音", "耶穌"] },
  { key: "acts_early_church", family: "bible_area", label_en: "Acts & the early church", label_zh: "使徒行傳與初期教會", keywords: ["acts", "early church", "pentecost", "apostles", "使徒行傳", "初期教會"] },
  { key: "letters", family: "bible_area", label_en: "Paul's & other letters", label_zh: "保羅及其他書信", keywords: ["romans", "corinthians", "galatians", "ephesians", "philippians", "colossians", "thessalonians", "timothy", "titus", "philemon", "hebrews", "james", "peter", "jude", "epistle", "letters", "書信", "羅馬書"] },
  { key: "revelation_apocalyptic", family: "bible_area", label_en: "Revelation & end times", label_zh: "啟示錄與末世", keywords: ["revelation", "apocalyptic", "end times", "day of the lord", "啟示錄", "末世"] },

  // Spiritual practices
  { key: "bible_reading", family: "practice", label_en: "Reading the Bible", label_zh: "讀經", keywords: ["how to read", "reading the bible", "scripture", "bible study", "讀經", "查經"] },
  { key: "prayer", family: "practice", label_en: "Prayer", label_zh: "禱告", keywords: ["prayer", "pray", "lord's prayer", "禱告", "祈禱"] },
  { key: "community", family: "practice", label_en: "Christian community", label_zh: "群體生活", keywords: ["community", "fellowship", "belonging", "群體", "團契"] },
  { key: "serving", family: "practice", label_en: "Serving others", label_zh: "服侍", keywords: ["serve", "serving", "service", "volunteer", "gifts", "服侍", "事奉"] },
  { key: "sharing_faith", family: "practice", label_en: "Sharing your faith", label_zh: "分享信仰", keywords: ["evangelism", "witness", "share your faith", "mission", "傳福音", "見證"] },

  // Living / emotional & life themes
  { key: "anxiety", family: "living", label_en: "Anxiety & worry", label_zh: "焦慮與憂慮", keywords: ["anxiety", "anxious", "worry", "fear", "stress", "焦慮", "憂慮", "擔心", "壓力"] },
  { key: "loneliness", family: "living", label_en: "Loneliness", label_zh: "孤單", keywords: ["lonely", "loneliness", "isolation", "alone", "孤單", "寂寞"] },
  { key: "rest", family: "living", label_en: "Rest, tiredness & burnout", label_zh: "安息、疲累與耗盡", keywords: ["rest", "sabbath", "tired", "burnout", "exhausted", "安息", "疲累", "攰"] },
  { key: "peace", family: "living", label_en: "Peace (shalom)", label_zh: "平安（沙龍）", keywords: ["peace", "shalom", "平安"] },
  { key: "hope", family: "living", label_en: "Hope", label_zh: "盼望", keywords: ["hope", "despair", "future", "盼望", "希望"] },
  { key: "grief", family: "living", label_en: "Grief & loss", label_zh: "哀傷與失落", keywords: ["grief", "loss", "mourning", "death", "哀傷", "失落", "離世"] },
  { key: "suffering", family: "living", label_en: "Suffering & hardship", label_zh: "苦難", keywords: ["suffering", "pain", "hardship", "trial", "苦難", "痛苦"] },
  { key: "doubt", family: "living", label_en: "Doubt & hard questions", label_zh: "疑惑與難題", keywords: ["doubt", "questions", "faith crisis", "疑惑", "懷疑"] },
  { key: "identity", family: "living", label_en: "Identity in Christ", label_zh: "在基督裡的身份", keywords: ["identity", "image of god", "self-worth", "身份", "自我價值"] },
  { key: "relationships", family: "living", label_en: "Relationships & friendship", label_zh: "人際關係與友誼", keywords: ["relationships", "friendship", "dating", "關係", "友誼"] },
  { key: "marriage", family: "living", label_en: "Marriage", label_zh: "婚姻", keywords: ["marriage", "spouse", "husband", "wife", "婚姻", "夫妻"] },
  { key: "parenting", family: "living", label_en: "Parenting", label_zh: "育兒", keywords: ["parenting", "parents", "children", "kids", "育兒", "親子", "子女"] },
  { key: "work_purpose", family: "living", label_en: "Work & calling", label_zh: "工作與呼召", keywords: ["work", "calling", "vocation", "career", "purpose", "工作", "呼召"] },
  { key: "money", family: "living", label_en: "Money & generosity", label_zh: "金錢與慷慨", keywords: ["money", "generosity", "finances", "wealth", "giving", "金錢", "奉獻"] },
  { key: "forgiveness", family: "living", label_en: "Forgiveness & reconciliation", label_zh: "饒恕與和好", keywords: ["forgiveness", "forgive", "reconciliation", "atonement", "sacrifice", "饒恕", "和好"] },
  { key: "discipleship", family: "living", label_en: "Following Jesus (discipleship)", label_zh: "跟隨耶穌（門徒訓練）", keywords: ["discipleship", "holy spirit", "spiritual growth", "follow jesus", "門徒", "聖靈"] },
  { key: "justice", family: "living", label_en: "Justice & mercy", label_zh: "公義與憐憫", keywords: ["justice", "mercy", "poor", "oppression", "公義", "憐憫"] },
  { key: "character", family: "living", label_en: "Character & holiness", label_zh: "品格與聖潔", keywords: ["character", "holiness", "holy", "virtue", "fruit of the spirit", "品格", "聖潔"] },

  // Life stages
  { key: "student", family: "life_stage", label_en: "Student", label_zh: "學生" },
  { key: "young_adult", family: "life_stage", label_en: "Young working adult", label_zh: "在職青年" },
  { key: "married", family: "life_stage", label_en: "Married, no children", label_zh: "已婚，未有子女" },
  { key: "parent_young", family: "life_stage", label_en: "Parent of young children", label_zh: "年幼子女的家長" },
  { key: "parent_teen", family: "life_stage", label_en: "Parent of teens / adult children", label_zh: "青少年或成年子女的家長" },
  { key: "retired", family: "life_stage", label_en: "Retired", label_zh: "退休" },

  // Situations (life events)
  { key: "bereavement", family: "situation", label_en: "Death of someone close", label_zh: "親友離世" },
  { key: "job_change", family: "situation", label_en: "New job / job change", label_zh: "轉工／新工作" },
  { key: "job_loss", family: "situation", label_en: "Lost a job", label_zh: "失業" },
  { key: "illness", family: "situation", label_en: "Illness (self or family)", label_zh: "患病（自己或家人）" },
  { key: "caregiving", family: "situation", label_en: "Caring for a family member", label_zh: "照顧家人" },
  { key: "new_baby", family: "situation", label_en: "New baby", label_zh: "新生嬰兒" },
  { key: "moving", family: "situation", label_en: "Moved home / emigration", label_zh: "搬家／移民" },
  { key: "relationship_breakup", family: "situation", label_en: "Relationship ended", label_zh: "感情結束" },
  { key: "exams", family: "situation", label_en: "Exams / study pressure", label_zh: "考試／學業壓力" },
  { key: "financial_stress", family: "situation", label_en: "Financial pressure", label_zh: "經濟壓力" },
  { key: "conflict", family: "situation", label_en: "Conflict with someone", label_zh: "與人衝突" },
];

export const TAG_BY_KEY: Record<string, Tag> = Object.fromEntries(TAGS.map((t) => [t.key, t]));

const keysOf = (family: TagFamily) => TAGS.filter((t) => t.family === family).map((t) => t.key);
export const BIBLE_AREAS = keysOf("bible_area");
export const PRACTICES = keysOf("practice");
export const LIVING = keysOf("living");
export const SITUATIONS = keysOf("situation");
export const LIFE_STAGES = keysOf("life_stage");

/** Tags that resources are tagged with and that a group can "need". */
export const NEED_TAGS = [...BIBLE_AREAS, ...PRACTICES, ...LIVING];

/** Life events imply underlying living/practice needs. */
export const SITUATION_TO_NEEDS: Record<string, string[]> = {
  bereavement: ["grief", "hope"],
  job_change: ["work_purpose"],
  job_loss: ["work_purpose", "money", "anxiety"],
  illness: ["suffering", "hope"],
  caregiving: ["rest", "suffering"],
  new_baby: ["parenting", "rest"],
  moving: ["community", "loneliness"],
  relationship_breakup: ["relationships", "identity"],
  exams: ["anxiety", "rest"],
  financial_stress: ["money", "anxiety"],
  conflict: ["forgiveness", "relationships"],
};

export type Emotion = "peace" | "anxiety" | "loneliness" | "hope" | "tiredness";
export const EMOTIONS: Emotion[] = ["peace", "anxiety", "loneliness", "hope", "tiredness"];
/** Emotion -> need tag; `inverted` means high intensity is good (low = need). */
export const EMOTION_TO_TAG: Record<Emotion, { tag: string; inverted: boolean }> = {
  peace: { tag: "peace", inverted: true },
  anxiety: { tag: "anxiety", inverted: false },
  loneliness: { tag: "loneliness", inverted: false },
  hope: { tag: "hope", inverted: true },
  tiredness: { tag: "rest", inverted: false },
};

export function isZh(locale: string | undefined | null): boolean {
  return !!locale && locale.toLowerCase().startsWith("zh");
}

export function tagLabel(key: string, locale: string): string {
  const t = TAG_BY_KEY[key];
  if (!t) return key;
  return isZh(locale) ? t.label_zh : t.label_en;
}
