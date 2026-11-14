import { expect, test } from "@playwright/test";

const SURVEY_STEPS = 7; // A, B1, B2, C, D, E, F after the intro

test("survey submit → leader dashboard → recommendations → session plan", async ({ page, context }) => {
  await context.addCookies([{ name: "locale", value: "en", url: "http://localhost" }]);

  // Member: anonymous survey via the capability link (demo season token "demo").
  await page.goto("/s/demo");
  await expect(page.getByTestId("survey-intro")).toBeVisible();
  await page.getByTestId("survey-next").click();

  const answers = ["opt-b1_big_story-2", "opt-emo-anxiety-4", "opt-emo-tiredness-3"];
  for (let step = 0; step < SURVEY_STEPS - 1; step++) {
    for (const id of answers) {
      const opt = page.getByTestId(id);
      if (await opt.isVisible()) await opt.click();
    }
    await page.getByTestId("survey-next").click();
  }
  await page.getByTestId("free-text").fill("Work has been stressful; I'd like to learn how to pray when anxious.");
  await page.getByTestId("survey-submit").click();
  await expect(page.getByTestId("survey-thanks")).toBeVisible();

  // Leader: demo sign-in, then the season dashboard.
  await page.goto("/");
  await page.getByTestId("demo-leader").click();
  await page.waitForURL(/\/leader/);
  await page.goto("/leader/seasons/season-demo");
  await expect(page.getByTestId("response-count")).toContainText("9");
  await expect(page.getByTestId("needs-dashboard")).toBeVisible();

  // Recommendations (mock AI rationale).
  await page.getByTestId("generate-recs").click();
  await expect(page.getByTestId("recommendation-card").first()).toBeVisible();
  expect(await page.getByTestId("recommendation-card").count()).toBeGreaterThanOrEqual(3);

  // Pick one → session plan with tiered questions.
  await page.getByTestId("pick-rec").first().click();
  const plan = page.getByTestId("session-plan").first();
  await expect(plan).toBeVisible();
  await expect(plan).not.toBeEmpty();
});
