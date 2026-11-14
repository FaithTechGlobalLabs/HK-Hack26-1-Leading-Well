import { describe, expect, it } from "vitest";
import { keywordCrisis, scrubPII } from "../pii";
import { keywordTags } from "../text";

describe("PII scrub", () => {
  it("removes emails, HK phones, international phones and HKID", () => {
    const { text, redactions } = scrubPII(
      "Email me at john.doe+x@gmail.com or call 9123 4567 / +852 2345-6789 / +44 20 7946 0958. HKID A123456(7).",
    );
    expect(text).not.toMatch(/gmail|9123|2345|7946|A123456/);
    expect(text).toContain("[email]");
    expect(text).toContain("[phone]");
    expect(text).toContain("[id]");
    expect(redactions).toBeGreaterThanOrEqual(5);
  });

  it("removes English names after titles, introductions and relations", () => {
    const { text } = scrubPII("My name is Peter Chan. Pastor David prayed with my wife Mary.");
    expect(text).not.toMatch(/Peter|David|Mary/);
    expect(text).toContain("my wife [name]");
  });

  it("removes Chinese names with honorifics and introductions", () => {
    const { text } = scrubPII("我叫陳大文，陳先生同李姑娘都好幫得手，阿明，電話 6123 4567");
    expect(text).not.toMatch(/大文|陳先生|李姑娘|阿明|6123/);
    expect(text).toContain("先生");
    expect(text).toContain("[姓名]");
  });

  it("leaves ordinary text alone", () => {
    const s = "I have been anxious about work. 最近工作好大壓力。Romans 8:28 helps.";
    expect(scrubPII(s)).toEqual({ text: s, redactions: 0 });
  });
});

describe("crisis keywords", () => {
  it("detects EN and ZH crisis language", () => {
    expect(keywordCrisis("Sometimes I don't want to live anymore")).toBe(true);
    expect(keywordCrisis("最近成日想死")).toBe(true);
    expect(keywordCrisis("I'm tired but okay")).toBe(false);
  });
});

describe("keyword tagger", () => {
  it("maps EN and ZH text to taxonomy tags", () => {
    expect(keywordTags("I worry a lot about work").map((t) => t.tag)).toEqual(expect.arrayContaining(["anxiety", "work_purpose"]));
    expect(keywordTags("想學點樣禱告").map((t) => t.tag)).toContain("prayer");
  });
});
