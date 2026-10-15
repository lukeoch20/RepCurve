import { expect, test, type Page } from "@playwright/test";
import { onboard } from "./helpers";

const background = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const styleGroup = (page: Page) => page.getByRole("group", { name: "Style" });
const look = (page: Page, name: string) => styleGroup(page).getByRole("button", { name: new RegExp(`^${name}`) });
const version = (page: Page, name: string, v: "Light" | "Dark" | "Match phone") =>
  page.getByRole("group", { name: `${name} version` }).getByRole("button", { name: v, exact: true });
/** Opens a look in the Style list and picks one of its versions. */
async function pick(page: Page, name: string, v: "Light" | "Dark" | "Match phone") {
  const button = look(page, name);
  if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
  await version(page, name, v).click();
}
/** The look and version in use show as chosen once the look is opened. */
async function expectChosen(page: Page, name: string, v: "Light" | "Dark" | "Match phone") {
  await expect(look(page, name)).toHaveAttribute("aria-pressed", "true");
  if ((await look(page, name).getAttribute("aria-expanded")) !== "true") await look(page, name).click();
  await expect(version(page, name, v)).toHaveAttribute("aria-pressed", "true");
}

test("Bluebird light is the default look; Settings lists each look once and asks light or dark", async ({ page }) => {
  await onboard(page);
  await expect(page.locator("html")).toHaveAttribute("data-style", "bluebird");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await background(page)).toBe("rgb(234, 241, 251)");

  await page.getByRole("button", { name: "Settings" }).click();
  // One entry per look, each opening to its versions.
  await expect(styleGroup(page).getByRole("button")).toHaveCount(6);
  await expectChosen(page, "Bluebird", "Light");

  // Dark: applies at once and survives a reload.
  await pick(page, "Bluebird", "Dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await background(page)).toBe("rgb(14, 23, 38)");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Make it yours" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expectChosen(page, "Bluebird", "Dark");

  // Fired Forge, light and dark.
  await pick(page, "Fired Forge", "Light");
  await expect(page.locator("html")).toHaveAttribute("data-style", "forge");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await background(page)).toBe("rgb(240, 236, 229)");
  await pick(page, "Fired Forge", "Dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await background(page)).toBe("rgb(18, 16, 15)");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Make it yours" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-style", "forge");
  await expectChosen(page, "Fired Forge", "Dark");

  // Pixel Press, light and dark: grid lettering, pixel icons and stepped medals.
  await pick(page, "Pixel Press", "Light");
  await expect(page.locator("html")).toHaveAttribute("data-style", "pixel");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await background(page)).toBe("rgb(242, 240, 255)");
  const title = page.getByRole("heading", { name: "Make it yours" });
  expect(await title.evaluate((h) => getComputedStyle(h).fontFamily)).toContain("Pixel Press 5x7");
  expect(await page.evaluate(async () => (await document.fonts.load('16px "Pixel Press 5x7"', "PUSH")).length)).toBeGreaterThan(0);
  const tab = page.getByRole("button", { name: "Settings" });
  await expect(tab.locator(".icon-pixel")).toBeVisible();
  await expect(tab.locator(".icon-line")).toBeHidden();
  await pick(page, "Pixel Press", "Dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await background(page)).toBe("rgb(18, 18, 38)");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Make it yours" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-style", "pixel");
  await expectChosen(page, "Pixel Press", "Dark");

  // Gold Plated, light and dark.
  await pick(page, "Gold Plated", "Light");
  await expect(page.locator("html")).toHaveAttribute("data-style", "gold");
  expect(await background(page)).toBe("rgb(245, 241, 232)");
  await pick(page, "Gold Plated", "Dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await background(page)).toBe("rgb(16, 17, 15)");

  // Cut Like a Diamond, light and dark: Bodoni headings, emerald-cut frames, the diamond crest.
  await pick(page, "Cut Like a Diamond", "Light");
  await expect(page.locator("html")).toHaveAttribute("data-style", "diamond");
  expect(await background(page)).toBe("rgb(240, 242, 243)");
  expect(await page.getByRole("heading", { name: "Make it yours" }).evaluate((h) => getComputedStyle(h).fontFamily)).toContain("Bodoni Moda");
  await pick(page, "Cut Like a Diamond", "Dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await background(page)).toBe("rgb(8, 12, 17)");
  await page.getByRole("button", { name: "Today" }).click();
  // The session tile carries the diamond, and cards wear the platinum bevel.
  expect(await page.locator(".page-head .glyph").evaluate((el) => getComputedStyle(el).backgroundImage)).toContain("data:image/webp");
  expect(await page.locator(".card > .eyebrow").filter({ hasText: "Today" }).locator("..").evaluate((el) => getComputedStyle(el).clipPath)).toContain("polygon");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Make it yours" })).toBeVisible();
  await expectChosen(page, "Cut Like a Diamond", "Dark");

  // Classic: light or dark whatever the phone says, or matching the phone.
  await pick(page, "Classic", "Light");
  await expect(page.locator("html")).not.toHaveAttribute("data-style", /./);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await background(page)).toBe("rgb(244, 245, 242)");
  await pick(page, "Classic", "Dark");
  await page.emulateMedia({ colorScheme: "light" });
  expect(await background(page)).toBe("rgb(14, 18, 16)");
  await pick(page, "Classic", "Match phone");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /./);
  expect(await background(page)).toBe("rgb(244, 245, 242)");
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await background(page)).toBe("rgb(14, 18, 16)");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Make it yours" })).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute("data-style", /./);
  await expectChosen(page, "Classic", "Match phone");
});

test("the workout header and tab bar wear Bluebird's blue bands", async ({ page }) => {
  await onboard(page);
  const chrome = (sel: string) => page.locator(sel).first().evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(await chrome(".tabbar")).toContain("linear-gradient");
  // The Today card's heading is a band across its top.
  expect(await page.locator(".card > .eyebrow").filter({ hasText: "Today" }).evaluate((el) => getComputedStyle(el).backgroundImage)).toContain("linear-gradient");
  await page.getByRole("button", { name: "Start session" }).click();
  expect(await chrome(".runner-head")).toContain("linear-gradient");
});
