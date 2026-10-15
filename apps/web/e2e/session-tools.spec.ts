import { expect, test } from "@playwright/test";
import { onboard } from "./helpers";

const setsDone = (page: import("@playwright/test").Page) => page.getByText(/^\d+ of \d+ sets$/);
const total = async (page: import("@playwright/test").Page) => Number((await setsDone(page).textContent())!.match(/of (\d+)/)![1]);

test("a set can be added to an exercise, logged like the others, and taken back until it is", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Start session" }).click();
  const block = page.locator("article.block").first();
  const name = (await block.locator(".exercise-link").textContent())!;
  const planned = await block.locator(".set").count();
  const before = await total(page);

  await block.getByRole("button", { name: `Add a set of ${name}` }).click();
  await expect(setsDone(page)).toHaveText(`0 of ${before + 1} sets`);
  await expect(block.locator(".set")).toHaveCount(planned + 1);
  await expect(block.locator(".block-target").first()).toContainText(`${planned} sets + 1 added`);

  // Not logged yet: it can go again.
  await block.getByRole("button", { name: `Remove set ${planned + 1}` }).click();
  await expect(setsDone(page)).toHaveText(`0 of ${before} sets`);
  await expect(block.locator(".set")).toHaveCount(planned);

  // Added and logged: it counts and stays.
  await block.getByRole("button", { name: `Add a set of ${name}` }).click();
  await block.getByRole("button", { name: `Set ${planned + 1}: to do` }).click();
  await block.getByRole("button", { name: `Done · set ${planned + 1}` }).click();
  await expect(setsDone(page)).toHaveText(`1 of ${before + 1} sets`);
  await expect(block.getByRole("button", { name: `Remove set ${planned + 1}` })).toHaveCount(0);
});

test("each exercise says why it has this weight", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Start session" }).click();
  const block = page.locator("article.block").first();
  const why = block.getByRole("button", { name: /^Why this (weight|target)\?$/ });
  await expect(why).toHaveAttribute("aria-expanded", "false");
  await why.click();
  await expect(why).toHaveAttribute("aria-expanded", "true");
  // Week one starts with a benchmark set.
  await expect(block.locator(".why-panel")).toContainText("Benchmark");
  await why.click();
  await expect(block.locator(".why-panel")).toHaveCount(0);
});

test("the end of a switch is announced, not just beeped", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Start session" }).click();
  await page.getByRole("button", { name: "Done · set 1" }).first().click();
  const dock = page.getByRole("timer");
  await expect(dock).toContainText("Switch");
  // Shorten the 20-second switch so it runs out.
  await dock.getByRole("button", { name: "−15 s" }).click();
  await expect(page.getByRole("alert")).toHaveText(/^Switch now\. Next: A2 .+, set 1 of \d+$/, { timeout: 10_000 });
});
