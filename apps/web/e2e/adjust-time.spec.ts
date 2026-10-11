import { expect, test } from "@playwright/test";
import { onboard } from "./helpers";

const time = (page: import("@playwright/test").Page) => page.getByRole("group", { name: "Time" });
const exercisesInHeader = async (page: import("@playwright/test").Page) =>
  Number((await page.getByText(/min · \d+ exercises/).textContent())!.match(/(\d+) exercises/)![1]);

test("today's time goes from 10 to 40 minutes: more time adds exercises, less takes them away", async ({ page }) => {
  await onboard(page);
  await expect(time(page)).toContainText("20");
  await expect(page.getByText("Your usual length")).toBeVisible();
  const usual = await exercisesInHeader(page);
  await expect(page.getByText("Dumbbell lateral raise")).toHaveCount(0);

  // Up to 40, stepping only through lengths that change the session (in this benchmark week,
  // 35 plans the same as 30, so it's skipped). Each step adds work; then "+" stops.
  for (const m of ["25", "30", "40"]) {
    const before = await exercisesInHeader(page);
    await time(page).getByRole("button", { name: "More time" }).click();
    await expect(time(page)).toContainText(m);
    expect(await exercisesInHeader(page)).toBeGreaterThan(before);
  }
  await expect(time(page).getByRole("button", { name: "More time" })).toBeDisabled();
  expect(await exercisesInHeader(page)).toBeGreaterThan(usual);
  await expect(page.getByText("Dumbbell lateral raise")).toBeVisible();

  // Back to usual, then down to 10: fewer exercises, and "−" stops.
  await page.getByRole("button", { name: "Back to usual (20 min)" }).click();
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
  for (let i = 0; i < 3; i++) await time(page).getByRole("button", { name: "More time" }).click();
  await expect(time(page)).toContainText("40");
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(page.getByText("Dumbbell lateral raise").first()).toBeVisible();
});
