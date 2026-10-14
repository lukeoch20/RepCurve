import { expect, test, type Page } from "@playwright/test";

async function setUp(page: Page, split?: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Set up my plan" }).click();
  await page.getByRole("group", { name: "Sex" }).getByRole("button", { name: "Female", exact: true }).click();
  await page.getByLabel("Age").fill("29");
  await page.getByLabel("Weight (lb)").fill("140");
  await page.getByLabel("Height (ft)").fill("5");
  await page.getByLabel("(in)").fill("6");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: /New to it/ }).click();
  await page.getByRole("button", { name: "Next" }).click();
  // Schedule: the split choice explains itself, with push/pull picked to start.
  const choice = page.getByRole("group", { name: "Split" });
  await expect(choice.getByRole("button", { name: /^Push \/ Pull Push day/ })).toHaveAttribute("aria-pressed", "true");
  await expect(choice).toContainText("Upper day: chest, back, shoulders and arms");
  if (split) await choice.getByRole("button", { name: new RegExp(`^${split}`) }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  const weights = page.getByRole("group", { name: "Dumbbell weights" });
  for (const w of ["10", "15", "20"]) await weights.getByRole("button", { name: w, exact: true }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Start training" }).click();
}

test("push/pull is the default split", async ({ page }) => {
  await setUp(page);
  await expect(page.getByRole("heading", { name: "Push day" })).toBeVisible();
  await page.getByRole("button", { name: "Plan" }).click();
  await expect(page.getByText("Pull day").first()).toBeVisible();
});

test("full body and upper/lower can be chosen instead, and changed later", async ({ page }) => {
  await setUp(page, "Full body");
  await expect(page.getByRole("heading", { name: "Full body A" })).toBeVisible();

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Edit profile, schedule and equipment" }).click();
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("group", { name: "Split" }).getByRole("button", { name: /^Upper \/ Lower/ }).click();
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("button", { name: "Today" }).click();
  await expect(page.getByRole("heading", { name: "Upper body" })).toBeVisible();
});

test("push/pull/legs needs three lifting days, and says so", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Set up my plan" }).click();
  await page.getByRole("group", { name: "Sex" }).getByRole("button", { name: "Female", exact: true }).click();
  await page.getByLabel("Age").fill("29");
  await page.getByLabel("Weight (lb)").fill("140");
  await page.getByLabel("Height (ft)").fill("5");
  await page.getByLabel("(in)").fill("6");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: /New to it/ }).click();
  await page.getByRole("button", { name: "Next" }).click();
  const choice = page.getByRole("group", { name: "Split" });
  const ppl = choice.getByRole("button", { name: /^Push \/ Pull \/ Legs/ });
  // Four days with the default goal is three lifting days: push/pull/legs can be chosen.
  await ppl.click();
  await expect(ppl).toHaveAttribute("aria-pressed", "true");
  // Three days is two lifting days and a cardio day: it can't, the plan falls back to full body, and the reason shows.
  await page.getByRole("group", { name: "Days a week" }).getByRole("button", { name: "3", exact: true }).click();
  await expect(ppl).toBeDisabled();
  await expect(ppl).toContainText("your schedule has 2");
  await expect(choice.getByRole("button", { name: /^Full body/ })).toHaveAttribute("aria-pressed", "true");
});
