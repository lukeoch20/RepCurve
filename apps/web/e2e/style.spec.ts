import { expect, test, type Page } from "@playwright/test";
import { onboard } from "./helpers";

const background = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const styleGroup = (page: Page) => page.getByRole("group", { name: "Style" });

test("Bluebird light is the default look, with Bluebird dark and Classic in Settings", async ({ page }) => {
  await onboard(page);
  await expect(page.locator("html")).toHaveAttribute("data-style", "bluebird");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await background(page)).toBe("rgb(234, 241, 251)");

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(styleGroup(page).getByRole("button", { name: /Bluebird light/ })).toHaveAttribute("aria-pressed", "true");

  // Dark: applies at once and survives a reload.
  await styleGroup(page).getByRole("button", { name: /Bluebird dark/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await background(page)).toBe("rgb(14, 23, 38)");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Make it yours" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(styleGroup(page).getByRole("button", { name: /Bluebird dark/ })).toHaveAttribute("aria-pressed", "true");

  // Classic: the original look, following the phone's light or dark mode.
  await styleGroup(page).getByRole("button", { name: /Classic/ }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-style", /./);
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /./);
  expect(await background(page)).toBe("rgb(244, 245, 242)");
  await page.emulateMedia({ colorScheme: "dark" });
  expect(await background(page)).toBe("rgb(14, 18, 16)");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Make it yours" })).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute("data-style", /./);
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
