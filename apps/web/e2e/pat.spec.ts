import { expect, test, type Page } from "@playwright/test";
import { onboard } from "./helpers";

// The other specs turn the pat on the back off for this device (playwright.config.ts); these turn it back on.
async function patsOn(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem("repcurve.pats");
  });
}

const pat = (page: Page) => page.getByRole("dialog");
const nextDone = (page: Page) => page.getByRole("button", { name: /^Done · set \d+$/ }).first();

const progress = (page: Page) => page.getByText(/^\d+ of \d+ sets$/);

/**
 * Log sets in order until a pat on the back appears (or the sets run out). Each set is seen to
 * register, and the pat given a moment to open, before the next tap: otherwise a tap can land
 * just as a pat opens and log a set of the next exercise once the pat steps aside.
 */
async function logUntilPat(page: Page) {
  for (let i = 0; i < 40; i++) {
    if (await pat(page).isVisible()) return;
    if ((await nextDone(page).count()) === 0) return;
    const before = await progress(page).textContent();
    await nextDone(page).click();
    await expect(progress(page)).not.toHaveText(before!);
    await pat(page).waitFor({ state: "visible", timeout: 300 }).catch(() => undefined);
  }
}

test("finishing an exercise gets a pat on the back: a cheer, something fun and a number to be proud of", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-05T07:00:00") });
  await onboard(page);
  await patsOn(page);
  await page.getByRole("button", { name: "Start session" }).click();

  // The first exercise's last set brings it up, with focus on the way to carry on.
  await logUntilPat(page);
  await expect(pat(page)).toBeVisible();
  await expect(pat(page)).toContainText(/ done\./);
  await expect(pat(page)).toContainText(/lifted|reps in the bank|holding strong/);
  const keepGoing = pat(page).getByRole("button", { name: "Keep going" });
  await expect(keepGoing).toBeFocused();
  await keepGoing.click();
  await expect(pat(page)).toHaveCount(0);

  // The next one gets out of the way by itself after a few seconds.
  await logUntilPat(page);
  await expect(pat(page)).toBeVisible();
  await page.clock.fastForward("00:07");
  await expect(pat(page)).toHaveCount(0);

  // The last exercise offers to finish the workout.
  for (let i = 0; i < 20; i++) {
    await logUntilPat(page);
    if (await pat(page).getByRole("button", { name: "Finish workout" }).isVisible()) break;
    if (await pat(page).isVisible()) await pat(page).getByRole("button", { name: "Keep going" }).click();
  }
  await expect(pat(page).getByRole("heading")).toHaveText("Every exercise done!");
  await pat(page).getByRole("button", { name: "Finish workout" }).click();
  await expect(page.getByRole("heading", { name: "First workout done!" })).toBeVisible();
  await expect(pat(page)).toHaveCount(0);
});

test("the pat on the back can be turned off in Settings, for this device", async ({ page }) => {
  await onboard(page);
  await patsOn(page);
  await page.getByRole("button", { name: "Settings" }).click();
  const toggle = page.getByRole("switch", { name: /Pat on the back after each exercise/ });
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await page.getByRole("button", { name: "Today" }).click();
  await page.getByRole("button", { name: "Start session" }).click();
  const before = await page.getByText(/^\d+ of \d+ sets$/).textContent();
  // A whole superset's worth of sets, and nothing pops up.
  for (let i = 0; i < 6; i++) await nextDone(page).click();
  await expect(page.getByText(/^\d+ of \d+ sets$/)).not.toHaveText(before!);
  await expect(pat(page)).toHaveCount(0);
});
