"use server";

import { revalidatePath } from "next/cache";
import { tagResource } from "@/lib/ai";
import { parseResourceCsv } from "@/lib/catalog/parse";
import { getRepo, type NewResource } from "@/lib/data";
import { AccessError, requireUser } from "@/lib/services";
import { NEED_TAGS } from "@/lib/taxonomy";

const MAX_IMPORT_ROWS = 200;
const MAX_CSV_BYTES = 512 * 1024;

async function requirePastor() {
  const repo = getRepo();
  const user = await requireUser(repo);
  if (user.role !== "pastor") throw new AccessError("Pastor role required");
  return { repo, user };
}

export interface ImportState {
  imported?: number;
  errors?: string[];
}

export async function importCsvAction(_prev: ImportState, form: FormData): Promise<ImportState> {
  const { repo, user } = await requirePastor();
  const file = form.get("file");
  let csv = String(form.get("csv") ?? "");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_CSV_BYTES) return { errors: ["File is too large (max 512 KB)."] };
    csv = await file.text();
  }
  if (!csv.trim()) return { errors: ["Paste CSV text or choose a file."] };
  const source = form.get("source") === "custom" ? "custom" : "rightnow";
  const { items, errors } = parseResourceCsv(csv, source);
  if (items.length > MAX_IMPORT_ROWS) return { errors: [`Too many rows (max ${MAX_IMPORT_ROWS}).`] };

  const resources: NewResource[] = [];
  for (const { hint_tags, ...seed } of items) {
    resources.push({ ...seed, church_id: user.church_id, tags: await tagResource(seed, hint_tags) });
  }
  const imported = resources.length ? await repo.createResources(user.church_id, resources) : 0;
  revalidatePath("/pastor");
  return { imported, errors };
}

export async function updateCatalogEntryAction(resourceId: string, form: FormData) {
  const { repo, user } = await requirePastor();
  const status = form.get("status") === "blocked" ? "blocked" : "allowed";
  const priority = Math.min(1, Math.max(0, Number(form.get("priority") ?? 0.5) || 0));
  const notes = String(form.get("notes") ?? "").trim().slice(0, 500) || null;
  await repo.upsertCatalogEntry(user.church_id, { resource_id: resourceId, status, priority, notes });
  revalidatePath("/pastor");
}

export async function bulkAllowAction(form: FormData) {
  const { repo, user } = await requirePastor();
  const ids = form.getAll("ids").map(String).slice(0, 500);
  const catalog = new Map((await repo.listCatalog(user.church_id)).map((c) => [c.resource_id, c]));
  for (const id of ids) {
    if (!catalog.has(id)) await repo.upsertCatalogEntry(user.church_id, { resource_id: id, status: "allowed", priority: 0.5, notes: null });
  }
  revalidatePath("/pastor");
}

export async function saveResourceTagsAction(resourceId: string, form: FormData) {
  const { repo } = await requirePastor();
  const tags = NEED_TAGS.filter((t) => form.get(`tag_${t}`) === "on")
    .map((tag) => ({ tag, relevance: Math.min(1, Math.max(0.1, Number(form.get(`rel_${tag}`) ?? 0.7) || 0.7)) }))
    .slice(0, 8);
  await repo.setResourceTags(resourceId, tags, "pastor");
  revalidatePath("/pastor");
  revalidatePath(`/pastor/resources/${resourceId}`);
}
