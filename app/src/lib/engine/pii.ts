/**
 * Regex PII scrubber for free-text survey answers (English + Traditional Chinese, Hong Kong formats).
 * Runs before anything is stored or sent to an LLM.
 */

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
// HKID e.g. A123456(7), AB987654(A), A1234567
const HKID = /\b[A-Z]{1,2}\d{6}\s?(?:\(\s?[0-9A]\s?\)|[0-9A])/gi;
// HK phone: optional +852 / 852, 8 digits starting 2-9, optional space/dash in the middle
const HK_PHONE = /(?:\+?852[\s-]?)?(?<!\d)[2-9]\d{3}[\s-]?\d{4}(?!\d)/g;
// Generic international phone numbers (at least 8 digits)
const INTL_PHONE = /\+\d{1,3}[\s-]?(?:\(?\d+\)?[\s-]?){2,}\d+/g;
const URL_WITH_HANDLE = /(?:wa\.me|t\.me|instagram\.com|facebook\.com)\/[\w.]+/gi;

// English names: titles, "my name is X", relation + Name
const EN_TITLE_NAME = /\b(Mr|Mrs|Ms|Miss|Dr|Pastor|Rev|Brother|Sister|Bro|Sis|Auntie|Uncle)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/g;
const EN_INTRO_NAME = /\b(my name is|i am called|i'm called|call me|name's)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/gi;
const EN_RELATION_NAME =
  /\b(my|our)\s+(wife|husband|son|daughter|friend|boss|colleague|mum|mom|dad|father|mother|brother|sister|boyfriend|girlfriend|partner|cousin|grandma|grandpa|neighbour|neighbor)\s+[A-Z][a-z]+/g;

// Chinese names
const ZH_SURNAMES =
  "陳李張黃何林梁劉吳郭王鄭謝羅曾周蔡許朱馮葉潘彭蘇呂盧袁蔣楊胡鄧余趙鍾徐孫馬高溫江麥莫譚歐方唐韓姚區石文伍麥嚴";
const ZH_HONORIFIC = "先生|小姐|太太|女士|姊妹|姐妹|弟兄|牧師|傳道|姑娘|老師|醫生|伯伯|姨姨|婆婆|伯母";
const ZH_SURNAME_NAME = new RegExp(`[${ZH_SURNAMES}][\\u4e00-\\u9fff]{0,2}(?=${ZH_HONORIFIC})`, "g");
const ZH_INTRO_NAME = /(我叫|我的名字是|名叫|叫做|我係)\s*[\u4e00-\u9fff]{2,3}/g;
const ZH_AH_NAME = /阿[\u4e00-\u9fff](?=[，。,.\s]|$|說|話|佢|他|她)/g;

export interface ScrubResult {
  text: string;
  redactions: number;
}

export function scrubPII(input: string): ScrubResult {
  let redactions = 0;
  const rep = (label: string) => () => {
    redactions++;
    return label;
  };
  let text = input ?? "";
  text = text.replace(EMAIL, rep("[email]"));
  text = text.replace(URL_WITH_HANDLE, rep("[contact]"));
  text = text.replace(HKID, rep("[id]"));
  text = text.replace(INTL_PHONE, rep("[phone]"));
  text = text.replace(HK_PHONE, rep("[phone]"));
  text = text.replace(EN_INTRO_NAME, (_m, intro: string) => {
    redactions++;
    return `${intro} [name]`;
  });
  text = text.replace(EN_TITLE_NAME, (_m, title: string) => {
    redactions++;
    return `${title} [name]`;
  });
  text = text.replace(EN_RELATION_NAME, (_m, my: string, rel: string) => {
    redactions++;
    return `${my} ${rel} [name]`;
  });
  text = text.replace(ZH_INTRO_NAME, (_m, intro: string) => {
    redactions++;
    return `${intro}[姓名]`;
  });
  text = text.replace(ZH_SURNAME_NAME, rep("[姓名]"));
  text = text.replace(ZH_AH_NAME, rep("[姓名]"));
  return { text, redactions };
}

/** Keyword fallback for the crisis classifier (used when no LLM is available, and as a safety net). */
const CRISIS_PATTERNS: RegExp[] = [
  /\bsuicid/i,
  /\bkill(ing)?\s+my\s*self\b/i,
  /\bend(ing)?\s+(it\s+all|my\s+life)\b/i,
  /\b(self[-\s]?harm|hurt(ing)?\s+myself|cut(ting)?\s+myself)\b/i,
  /\b(don'?t|do not)\s+want\s+to\s+(live|be alive|wake up)\b/i,
  /\bno\s+reason\s+to\s+live\b/i,
  /\b(he|she|they)\s+(hits?|beats?)\s+me\b/i,
  /自殺|輕生|想死|唔想生存|不想活|唔想活|自殘|傷害自己|結束生命|了結自己|家暴|被打/,
];

export function keywordCrisis(text: string): boolean {
  return CRISIS_PATTERNS.some((p) => p.test(text ?? ""));
}
