import { expect, type Page } from "@playwright/test";

/**
 * Set up a new user: 33-year-old man, never trained, aiming to lose fat, 10–30 lb dumbbells,
 * treadmill and ab roller. In RepCurve by default, or in RepCurve Test with "/test/"; with a
 * username when the app has a backend (see backend.ts in this folder).
 */
export async function onboard(page: Page, app: "/" | "/test/" = "/", opts: { username?: string; nameStatus?: string | RegExp } = {}) {
  await page.goto(app);
  await page.getByRole("button", { name: "Set up my plan" }).click();
  if (opts.username) {
    await page.getByLabel("Username").fill(opts.username);
    await expect(page.getByText(opts.nameStatus ?? "Available.")).toBeVisible();
  }
  await page.getByRole("group", { name: "Sex" }).getByRole("button", { name: "Male", exact: true }).click();
  await page.getByLabel("Age").fill("33");
  await page.getByLabel("Weight (lb)").fill("185");
  await page.getByLabel("Height (ft)").fill("5");
  await page.getByLabel("(in)").fill("10");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: /New to it/ }).click();
  await page.getByRole("group", { name: "Main aim" }).getByRole("button", { name: /^Lose fat/ }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("80 minutes")).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  // Where: at home, picked to start.
  await expect(page.getByRole("group", { name: "Where you train" }).getByRole("button", { name: /At home/ })).toHaveAttribute("aria-pressed", "true");
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
