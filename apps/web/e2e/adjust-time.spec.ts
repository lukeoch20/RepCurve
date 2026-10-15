import { expect, test } from "@playwright/test";
import { onboard } from "./helpers";

const time = (page: import("@playwright/test").Page) => page.getByRole("group", { name: "Time" });
const exercisesInHeader = async (page: import("@playwright/test").Page) =>
  Number((await page.getByText(/min · \d+ exercises/).textContent())!.match(/(\d+) exercises/)![1]);

test("today's time goes from 10 minutes up: more time adds work, less takes exercises away", async ({ page }) => {
  await onboard(page);
  await expect(time(page)).toContainText("20");
  await expect(page.getByText("Your usual length")).toBeVisible();
  const usual = await exercisesInHeader(page);

  // Up to the longest length that still adds work (at most 60, and less once the week's volume
  // ceiling is reached), stepping only through lengths that change the session; then "+" stops.
  // A step adds sets, which may be another exercise or more sets of one already planned.
  const more = time(page).getByRole("button", { name: "More time" });
  for (let i = 0; i < 12 && (await more.isEnabled()); i++) {
    const before = await exercisesInHeader(page);
    await more.click();
    expect(await exercisesInHeader(page)).toBeGreaterThanOrEqual(before);
  }
  await expect(more).toBeDisabled();
  expect(await exercisesInHeader(page)).toBeGreaterThanOrEqual(usual);

  // Back to usual, then down to 10: fewer exercises, and "−" stops.
  // (When the week's ceiling leaves no room for more today, the length never left the usual.)
  const back = page.getByRole("button", { name: "Back to usual (20 min)" });
  if (await back.isVisible()) await back.click();
  await expect(time(page)).toContainText("20");
  expect(await exercisesInHeader(page)).toBe(usual);
  // Down to 10, skipping lengths that plan the same session.
  const less = time(page).getByRole("button", { name: "Less time" });
  for (let i = 0; i < 4 && (await less.isEnabled()); i++) await less.click();
  await expect(time(page)).toContainText("10");
  await expect(time(page).getByRole("button", { name: "Less time" })).toBeDisabled();
  expect(await exercisesInHeader(page)).toBeLessThan(usual);
});

test("a session started on a long day runs the longer plan", async ({ page }) => {
  await onboard(page);
  const more = time(page).getByRole("button", { name: "More time" });
  for (let i = 0; i < 12 && (await more.isEnabled()); i++) await more.click();
  const planned = await exercisesInHeader(page);
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(page.locator("article.block")).toHaveCount(planned);
});
