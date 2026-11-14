"use server";

import { submitSurvey, type SubmitResult } from "@/lib/services";

export async function submitSurveyAction(token: string, input: unknown): Promise<SubmitResult> {
  try {
    return await submitSurvey(token, input);
  } catch (e) {
    console.error("survey submit failed", e instanceof Error ? e.message : e);
    return { ok: false, crisis: false, error: "invalid" };
  }
}
