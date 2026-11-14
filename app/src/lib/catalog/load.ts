import fs from "node:fs";
import path from "node:path";
import { parseBibleProject, parseResourceCsv, type CatalogSeed } from "./parse";

/** Directory holding bibleproject.json and rightnow-sample.csv. */
export function dataDir(): string {
  const candidates = [path.join(process.cwd(), "data"), path.join(process.cwd(), "app", "data")];
  return candidates.find((d) => fs.existsSync(path.join(d, "bibleproject.json"))) ?? candidates[0];
}

export function loadCatalogSeeds(): CatalogSeed[] {
  const dir = dataDir();
  const seeds: CatalogSeed[] = [];
  const bp = path.join(dir, "bibleproject.json");
  if (fs.existsSync(bp)) seeds.push(...parseBibleProject(JSON.parse(fs.readFileSync(bp, "utf8"))));
  const rn = path.join(dir, "rightnow-sample.csv");
  if (fs.existsSync(rn)) seeds.push(...parseResourceCsv(fs.readFileSync(rn, "utf8"), "rightnow").items);
  return seeds;
}
