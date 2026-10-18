import { expect, test, type Page } from "@playwright/test";
import { onboard } from "./helpers";

const regenerate = (page: Page) => page.getByRole("button", { name: "Regenerate" });
const todayCard = (page: Page) => page.locator("section.card", { has: regenerate(page) });

test("not feeling today's session: Regenerate swaps in other exercises, kept until it's done, with a way back", async ({ page }) => {
  await onboard(page);
  const original = await todayCard(page).textContent();
  await expect(page.getByRole("button", { name: "Back to the original" })).toHaveCount(0);

  await regenerate(page).click();
  await expect(page.getByText("New exercises, same muscles.")).toBeVisible();
  const regenerated = await todayCard(page).textContent();
  expect(regenerated).not.toBe(original);

  // Kept after a reload.
  await page.reload();
  await expect(page.getByText("New exercises, same muscles.")).toBeVisible();
  expect(await todayCard(page).textContent()).toBe(regenerated);

  // Again: something different from what's on screen.
  await regenerate(page).click();
  await expect.poll(() => todayCard(page).textContent()).not.toBe(regenerated);

  // And back.
  await page.getByRole("button", { name: "Back to the original" }).click();
  await expect(page.getByText("New exercises, same muscles.")).toHaveCount(0);
  expect(await todayCard(page).textContent()).toBe(original);

  // A started session runs the regenerated plan.
  await regenerate(page).click();
  const first = (await todayCard(page).locator(".lineup-item .what").first().textContent())!.trim();
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(page.getByText(first, { exact: true }).first()).toBeVisible();
});
