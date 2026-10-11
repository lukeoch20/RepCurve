import { expect, test, type Page } from "@playwright/test";
import { onboard } from "./helpers";

// A brand-new user: tips on (the other specs turn them off).
test.use({ storageState: { cookies: [], origins: [] } });

const tip = (page: Page) => page.getByRole("dialog");
async function expectTip(page: Page, title: string) {
  await expect(tip(page).getByRole("heading")).toHaveText(title);
}
async function gotIt(page: Page, title: string) {
  await expectTip(page, title);
  await tip(page).getByRole("button", { name: "Got it" }).click();
}

test("the first workout walks a newcomer through lifting basics and the app, one tip at a time", async ({ page }) => {
  await onboard(page);

  // Today, in tutorial order.
  await gotIt(page, "Welcome to RepCurve");
  await gotIt(page, "Your week");
  await gotIt(page, "You don't need to know your strength");
  await gotIt(page, "Supersets: exercises in pairs");
  await gotIt(page, "Sets and reps");
  await gotIt(page, "Not sure how to do one?");
  await gotIt(page, "Short on time, or have extra?");
  await expect(tip(page)).toHaveCount(0);

  // Tips are labelled as lifting basics or app features.
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(tip(page)).toContainText("Lifting basics");
  await gotIt(page, "Warm up first");
  await gotIt(page, "Log what you actually did");
  await gotIt(page, "Reps left in the tank");
  await gotIt(page, "Done moves you along");
  await expect(tip(page)).toHaveCount(0);

  // The superset switch is explained the moment it happens.
  await page.getByRole("button", { name: "Done · set 1" }).first().click();
  await gotIt(page, "Switch to the other exercise");
  await expect(tip(page)).toHaveCount(0);

  // Each tip shows once: after a reload, nothing repeats.
  await page.reload();
  await expect(page.getByRole("timer")).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(tip(page)).toHaveCount(0);
});

test("tips can be skipped, turned back on, and replayed from Settings", async ({ page }) => {
  await onboard(page);
  await expectTip(page, "Welcome to RepCurve");
  await tip(page).getByRole("button", { name: "Skip all tips" }).click();
  await expect(tip(page)).toHaveCount(0);

  await page.getByRole("button", { name: "Settings" }).click();
  const show = page.getByRole("switch", { name: /Show tips/ });
  await expect(show).not.toBeChecked();
  await page.getByRole("button", { name: "Show all tips again" }).click();
  await expect(show).toBeChecked();

  await page.getByRole("button", { name: "Today" }).click();
  await expectTip(page, "Welcome to RepCurve");
});

test("a tip can be closed with Escape, and focus starts on Got it", async ({ page }) => {
  await onboard(page);
  await expectTip(page, "Welcome to RepCurve");
  await expect(tip(page).getByRole("button", { name: "Got it" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expectTip(page, "Your week");
});
