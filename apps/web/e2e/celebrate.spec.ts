import { expect, test } from "@playwright/test";
import { onboard } from "./helpers";

// Record vibrations instead of making them.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __buzz: unknown[] };
    w.__buzz = [];
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: (p: unknown) => (w.__buzz.push(p), true) });
  });
});
const buzzes = (page: import("@playwright/test").Page) => page.evaluate(() => (window as unknown as { __buzz: unknown[] }).__buzz);

test("each set gets a buzz, and finishing gets a celebration: stats, calories, the week and why it matters", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Start session" }).click();
  await page.getByRole("button", { name: "Done · set 1" }).first().click();
  expect(await buzzes(page)).toEqual([30]);
  await page.getByRole("button", { name: "Done · set 1" }).first().click();
  expect(await buzzes(page)).toEqual([30, 30]);

  await page.getByRole("button", { name: "End" }).click();
  await page.getByRole("button", { name: "Finish and save" }).click();
  expect((await buzzes(page)).length).toBe(3);

  await expect(page.getByRole("heading", { name: "First workout done!" })).toBeVisible();
  const stats = page.getByRole("region", { name: "This session" });
  await expect(stats).toContainText("sets");
  // Calories show once a session is long enough to count (this one takes seconds).
  await expect(stats).toContainText("lb moved");
  await expect(page.getByRole("img", { name: "1 of 4 sessions done this week" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Why it matters" })).toBeVisible();
  await expect(page.getByText("Next time")).toBeVisible();
});

test("the buzz can be turned off in Settings", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("switch", { name: /Vibrate when you finish a set/ }).uncheck();
  await page.getByRole("button", { name: "Today" }).click();
  await page.getByRole("button", { name: "Start session" }).click();
  await page.getByRole("button", { name: "Done · set 1" }).first().click();
  expect(await buzzes(page)).toEqual([]);
});
