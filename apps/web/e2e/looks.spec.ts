import { expect, test, type Page } from "@playwright/test";
import { onboard } from "./helpers";

const styleGroup = (page: Page) => page.getByRole("group", { name: "Style" });
const look = (page: Page, name: string) => styleGroup(page).getByRole("button", { name: new RegExp(`^${name}`) });
const css = (page: Page, sel: string, prop: string) => page.locator(sel).first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

/** The next session, start to finish screen: one set of a lifting day, or a cardio day ended early. */
async function quickSession(page: Page) {
  await page.getByRole("button", { name: "Start session" }).click();
  const set = page.getByRole("button", { name: "Done · set 1" }).first();
  const cardio = page.getByRole("region", { name: "Segment timer" });
  await expect(set.or(cardio).first()).toBeVisible();
  if (await cardio.isVisible()) {
    await page.getByRole("button", { name: "Finish early" }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    return;
  }
  await set.click();
  await page.getByRole("button", { name: "End" }).click();
  await page.getByRole("button", { name: "Finish and save" }).click();
}

test("in RepCurve a new user's earned looks are locked, show their routes, and can't be put on", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(styleGroup(page).getByRole("button")).toHaveCount(6);

  // Free: Bluebird and Classic.
  for (const name of ["Bluebird", "Classic"]) await expect(look(page, name)).not.toHaveAttribute("aria-disabled", "true");

  // Earned: dimmed with a lock and their routes, with how far there is to go.
  for (const name of ["Fired Forge", "Pixel Press", "Gold Plated", "Cut Like a Diamond"]) await expect(look(page, name)).toHaveAttribute("aria-disabled", "true");
  const forge = look(page, "Fired Forge");
  await expect(forge).toContainText("Locked. Unlocks with: 10 workouts (10 to go)");
  await expect(forge).toContainText("a 4-week streak (4 weeks to go)");
  await expect(forge.locator(".look-lock")).toBeVisible();

  // Tapping a locked look does nothing.
  await forge.click({ force: true });
  await expect(page.getByRole("group", { name: "Fired Forge version" })).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-style", "bluebird");

  // Its preview is still there, in its own colours and lettering rather than Bluebird's.
  expect(await css(page, ".choice:has(button[aria-disabled]) .lp-head", "background-color")).toBe("rgb(48, 39, 33)");
  expect(await css(page, ".choice:has(button[aria-disabled]) .lp-head", "font-family")).toContain("Archivo Narrow");

  // Progress names the next look to earn.
  await page.getByRole("button", { name: "Progress" }).click();
  await expect(page.getByRole("region", { name: "Next look" })).toContainText("Next look: Fired Forge");
});

test("each look's preview keeps its own colours and fonts whatever look is on", async ({ page }) => {
  await onboard(page, "/test/");
  await page.getByRole("button", { name: "Settings" }).click();
  await look(page, "Pixel Press").click();
  await page.getByRole("group", { name: "Pixel Press version" }).getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-style", "pixel");
  const head = (name: string) => look(page, name).locator(".lp-head").first();
  expect(await head("Classic").evaluate((el) => getComputedStyle(el).fontFamily)).toContain("Newsreader");
  expect(await head("Bluebird").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(23, 84, 184)");
  expect(await head("Gold Plated").evaluate((el) => getComputedStyle(el).fontFamily)).toContain("Cinzel");
  // Classic follows the phone: light and dark side by side.
  await expect(look(page, "Classic").locator(".lp-pane")).toHaveCount(2);
});

test("in RepCurve Test every look is open, and says how it's earned in RepCurve", async ({ page }) => {
  await onboard(page, "/test/");
  await page.getByRole("button", { name: "Settings" }).click();
  for (const name of ["Fired Forge", "Pixel Press", "Gold Plated", "Cut Like a Diamond"]) await expect(look(page, name)).not.toHaveAttribute("aria-disabled", "true");
  await expect(look(page, "Fired Forge")).toContainText("Open in the test app. In RepCurve it unlocks with: 10 workouts");
});

test("the tenth workout unlocks Fired Forge, and Try it puts it on", async ({ page }) => {
  test.setTimeout(120_000);
  await onboard(page);
  for (let i = 1; i < 10; i++) {
    await quickSession(page);
    await expect(page.getByRole("region", { name: "New look" })).toHaveCount(0);
    await page.getByRole("button", { name: "Done", exact: true }).click();
  }
  await quickSession(page);
  const banner = page.getByRole("region", { name: "New look" });
  await expect(banner).toContainText("New look unlocked: Fired Forge");
  await banner.getByRole("button", { name: "Try it" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-style", "forge");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(banner).toContainText("Fired Forge is on.");
  await page.getByRole("button", { name: "Done", exact: true }).click();

  // Open in Settings now, and still the next one to earn on Progress is Pixel Press.
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(look(page, "Fired Forge")).toHaveAttribute("aria-pressed", "true");
  await expect(look(page, "Fired Forge")).not.toHaveAttribute("aria-disabled", "true");
  await page.getByRole("button", { name: "Progress" }).click();
  await expect(page.getByRole("region", { name: "Next look" })).toContainText("Next look: Pixel Press");
});
