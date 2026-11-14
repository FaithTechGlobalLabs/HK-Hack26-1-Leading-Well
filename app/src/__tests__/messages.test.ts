import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import zh from "../../messages/zh-Hant.json";

type Tree = { [k: string]: string | Tree };

function leaves(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([k, v]) => (typeof v === "string" ? [`${prefix}${k}`] : leaves(v, `${prefix}${k}.`)));
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === "__tests__" ? [] : sourceFiles(p);
    return /\.tsx?$/.test(f) ? [p] : [];
  });
}

/**
 * Keys passed as literals (template parts become wildcards) to translators bound to a namespace.
 * A file may bind the same variable name to several namespaces (one per component), so a key
 * matches if it exists under any of them.
 */
function usedKeys(): { keys: RegExp[]; raw: string }[] {
  const out: { keys: RegExp[]; raw: string }[] = [];
  for (const file of sourceFiles(join(__dirname, ".."))) {
    const src = readFileSync(file, "utf8");
    const namespaces = new Map<string, Set<string>>();
    for (const [, v, ns] of src.matchAll(/const (\w+) = (?:await )?(?:getTranslations|useTranslations)\(\s*"(\w+)"\s*\)/g)) {
      namespaces.set(v, (namespaces.get(v) ?? new Set()).add(ns));
    }
    for (const [v, nss] of namespaces) {
      for (const k of src.matchAll(new RegExp(`\\b${v}\\(\\s*([\`"])([^\`"]+)\\1`, "g"))) {
        const pattern = k[2]
          .split(/\$\{[^}]+\}/)
          .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join("[^.]+");
        out.push({ keys: [...nss].map((ns) => new RegExp(`^${ns}\\.${pattern}$`)), raw: `${[...nss].join("|")}.${k[2]}` });
      }
    }
  }
  return out;
}

describe("i18n messages", () => {
  const enKeys = leaves(en as Tree);
  const zhKeys = leaves(zh as Tree);

  it("has identical keys in en and zh-Hant", () => {
    expect(zhKeys.filter((k) => !enKeys.includes(k))).toEqual([]);
    expect(enKeys.filter((k) => !zhKeys.includes(k))).toEqual([]);
  });

  it("defines every key used in the source", () => {
    const used = usedKeys();
    expect(used.length).toBeGreaterThan(50);
    const missing = used.filter((u) => !enKeys.some((k) => u.keys.some((re) => re.test(k)))).map((u) => u.raw);
    expect([...new Set(missing)]).toEqual([]);
  });
});
