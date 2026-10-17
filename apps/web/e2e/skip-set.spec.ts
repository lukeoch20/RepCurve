import { expect, test } from "@playwright/test";
import { onboard } from "./helpers";

const setsDone = (page: import("@playwright/test").Page) => page.getByText(/^\d+ of \d+ sets$/);

test("a set you're not feeling can be skipped, and taken back", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Start session" }).click();
  const total = Number((await setsDone(page).textContent())!.match(/of (\d+)/)![1]);
  const block = page.locator("article.block").first();

  // The set up next can be skipped from its editor: it drops out of the count and up next moves on.
  await block.getByRole("button", { name: "Skip set 1" }).click();
  await expect(block.getByRole("button", { name: "Set 1: skipped" })).toBeVisible();
  await expect(setsDone(page)).toHaveText(`0 of ${total - 1} sets`);
  await expect(block.getByRole("button", { name: /^Set 1: (up next|benchmark)$/ })).toHaveCount(0);

  // Tapping it explains, and Undo skip makes it the set up next again.
  await block.getByRole("button", { name: "Set 1: skipped" }).click();
  await expect(block).toContainText("It doesn't count against you");
  await block.getByRole("button", { name: "Undo skip" }).click();
  await expect(setsDone(page)).toHaveText(`0 of ${total} sets`);
  // (The very first set of a first workout is a benchmark.)
  await expect(block.getByRole("button", { name: /^Set 1: (up next|benchmark)$/ })).toBeVisible();
  await expect(block.getByRole("button", { name: "Skip set 1" })).toBeVisible();

  // Skipped, then the workout goes on: the next set is logged as usual.
  await block.getByRole("button", { name: "Skip set 1" }).click();
  await page.getByRole("button", { name: /^Done · set \d+$/ }).first().click();
  await expect(setsDone(page)).toHaveText(`1 of ${total - 1} sets`);
});
