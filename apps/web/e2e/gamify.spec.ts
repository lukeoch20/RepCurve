import { expect, test } from "@playwright/test";
import { onboard } from "./helpers";

test("a first workout earns a badge, starts the monthly challenge, and fills Progress", async ({ page }) => {
  await onboard(page);
  // Nothing to count yet, so no challenge on Today.
  await expect(page.getByRole("region", { name: /challenge$/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Start session" }).click();
  await page.getByRole("button", { name: "Done · set 1" }).first().click();
  await page.getByRole("button", { name: "End" }).click();
  await page.getByRole("button", { name: "Finish and save" }).click();
  await expect(page.getByRole("heading", { name: "New badge!" })).toBeVisible();
  await expect(page.getByText("First workout", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();

  // Today: this month's challenge, one workout in.
  const challenge = page.getByRole("region", { name: /challenge$/ });
  await expect(challenge).toBeVisible();
  await expect(challenge.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");

  await page.getByRole("button", { name: "Progress" }).click();
  await expect(page.getByRole("heading", { name: "Trophies" })).toBeVisible();
  await expect(page.getByText(/^1 of \d+ earned$/)).toBeVisible();
  await page.getByRole("button", { name: /^First workout: earned/ }).click();
  await expect(page.getByRole("dialog", { name: "First workout" })).toContainText("Finish your first workout");
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("heading", { name: "Personal records" })).toBeVisible();
  await expect(page.getByText(/^Lv \d+$/).first()).toBeVisible();
  await expect(page.getByRole("img", { name: /: 1 days? with a workout$/ })).toBeVisible();
});

test("no screen is wider than the phone (nothing scrolls sideways)", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Start session" }).click();
  await page.getByRole("button", { name: "Done · set 1" }).first().click();
  await page.getByRole("button", { name: "End" }).click();
  await page.getByRole("button", { name: "Finish and save" }).click();
  const width = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(await width()).toBe(0);
  await page.getByRole("button", { name: "Done" }).click();
  for (const tab of ["Today", "Plan", "Progress", "Settings"]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    expect(await width(), tab).toBe(0);
  }
});
