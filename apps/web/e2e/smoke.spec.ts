import { expect, test, type Page } from "@playwright/test";

async function onboard(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Set up my plan" }).click();
  await page.getByRole("group", { name: "Sex" }).getByRole("button", { name: "Male", exact: true }).click();
  await page.getByLabel("Age").fill("33");
  await page.getByLabel("Weight (lb)").fill("185");
  await page.getByLabel("Height (ft)").fill("5");
  await page.getByLabel("(in)").fill("10");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: /New to it/ }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("80 minutes")).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  const weights = page.getByRole("group", { name: "Dumbbell weights" });
  for (const w of ["10", "15", "20", "25", "30"]) await weights.getByRole("button", { name: w, exact: true }).click();
  await page.getByRole("switch", { name: "Treadmill" }).check();
  await page.getByRole("switch", { name: "Ab roller" }).check();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText(/First session/)).toBeVisible();
  await page.getByRole("button", { name: "Start training" }).click();
}

test("a new user sets up, logs sets with the rest timer, finishes, and keeps progress after reload", async ({ page }) => {
  await onboard(page);

  await expect(page.getByRole("heading", { name: "Full body A" })).toBeVisible();
  await expect(page.getByText("Benchmark session")).toBeVisible();
  await page.getByRole("button", { name: "Start session" }).click();

  // First set of the first exercise is the benchmark: log it and get coaching plus a switch timer.
  await page.getByRole("button", { name: "Done · set 1" }).first().click();
  await expect(page.getByRole("status").filter({ hasText: "Benchmark logged" }).first()).toBeVisible();
  const dock = page.getByRole("timer");
  await expect(dock).toContainText("Switch");
  await dock.getByRole("button", { name: "+15 s" }).click();

  // Second exercise of the pair, then a full rest.
  await page.getByRole("button", { name: "Done · set 1" }).first().click();
  await expect(dock).toContainText("Rest");
  await dock.getByRole("button", { name: "Skip" }).click();
  await expect(page.getByText(/^2 of \d+ sets$/)).toBeVisible();

  await page.getByRole("button", { name: "End" }).click();
  await page.getByRole("button", { name: "Finish and save" }).click();
  await expect(page.getByText("Next time")).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();

  await expect(page.getByText("Week 1 · session 2")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Week 1 · session 2")).toBeVisible();

  await page.getByRole("button", { name: "Progress" }).click();
  await expect(page.getByRole("heading", { name: "Your curve so far" })).toBeVisible();
  await expect(page.locator(".stat").first()).toContainText("1");
});

test("rest length can be set from settings and the plan adapts", async ({ page }) => {
  await onboard(page);
  // The header summarises the session: estimated minutes, supersets and finisher.
  const summary = page.locator("header .meta.num").first();
  const before = (await summary.innerText()) + (await page.locator(".dose").allInnerTexts()).join("|");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("group", { name: "Rest after each round" }).getByRole("button", { name: "2:00" }).click();
  await expect(page.getByRole("group", { name: "Rest after each round" }).getByRole("button", { name: "2:00" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Today" }).click();
  await expect(page.getByRole("button", { name: "Start session" })).toBeVisible();
  // Two-minute rests take more of the time budget, so the session is re-planned.
  const after = (await summary.innerText()) + (await page.locator(".dose").allInnerTexts()).join("|");
  expect(after).not.toEqual(before);
});
