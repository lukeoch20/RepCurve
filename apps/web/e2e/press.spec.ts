import { expect, test, type Locator, type Page } from "@playwright/test";
import { onboard } from "./helpers";

// Press feel: a control goes down the moment it's touched and comes back by itself (styles.css).

type Matrix = { scale: number; x: number; y: number } | null;
/** The button's transform as a scale and a shift; null while it's at rest. */
const transformOf = (button: Locator): Promise<Matrix> =>
  button.evaluate((el) => {
    const t = getComputedStyle(el).transform;
    if (t === "none") return null;
    const m = t.slice(t.indexOf("(") + 1, -1).split(",").map(Number);
    return { scale: m[0]!, x: m[4]!, y: m[5]! };
  });
/** The transform the button settles at while it's held down. */
async function pressed(page: Page, button: Locator): Promise<Matrix> {
  await button.scrollIntoViewIfNeeded();
  const box = (await button.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  let last: Matrix = null;
  await expect
    .poll(async () => {
      const now = await transformOf(button);
      const still = JSON.stringify(now) === JSON.stringify(last);
      last = now;
      return still && now !== null;
    })
    .toBe(true);
  return last;
}
/** Let go away from the button, so nothing is tapped. */
async function letGo(page: Page) {
  await page.mouse.move(2, 300);
  await page.mouse.up();
}

test("a pressed button goes down at once, does nothing until it's let go on it, and comes back by itself", async ({ page }) => {
  await onboard(page);
  const start = page.getByRole("button", { name: "Start session" });
  expect(await transformOf(start)).toBeNull();
  // A second tap in a hurry is a tap, not a zoom.
  expect(await start.evaluate((el) => getComputedStyle(el).touchAction)).toBe("manipulation");

  const down = await pressed(page, start);
  // Bluebird, the look a new setup starts in: the button moves into the page.
  expect(down!.y).toBeGreaterThan(0);
  expect(down!.scale).toBeLessThan(1);

  await letGo(page);
  await expect.poll(() => transformOf(start)).toBeNull();
  await expect(start).toBeVisible();
  await expect(page.getByRole("button", { name: "Done · set 1" })).toHaveCount(0);
});

test("each look presses its own way, a disabled button stays put, and reduced motion drops the animation", async ({ page }) => {
  await onboard(page, "/test/");
  const start = page.getByRole("button", { name: "Start session" });
  const wear = async (style: string) => {
    await page.evaluate((s) => localStorage.setItem("repcurve-test.style", s), style);
    await page.reload();
    await expect(start).toBeVisible();
  };

  // Classic, Gold Plated and Cut Like a Diamond squeeze.
  for (const style of ["classic-light", "gold-dark", "diamond-light"]) {
    await wear(style);
    const down = await pressed(page, start);
    expect(down!.scale, style).toBeLessThan(1);
    expect(down!.x, style).toBe(0);
    await letGo(page);
  }
  // Fired Forge is stamped straight down; Pixel Press lands on its own offset shadow. Neither shrinks.
  await wear("forge-dark");
  expect(await pressed(page, start)).toEqual({ scale: 1, x: 0, y: 2 });
  await letGo(page);
  await wear("pixel-light");
  expect(await pressed(page, start)).toEqual({ scale: 1, x: 2, y: 2 });
  await letGo(page);
  // Pixel steps back instead of easing.
  expect(await start.evaluate((el) => getComputedStyle(el).transitionTimingFunction)).toContain("steps");

  // Small controls move too: a tab, and a row.
  await wear("classic-dark");
  expect((await pressed(page, page.getByRole("button", { name: "Plan", exact: true })))!.scale).toBeLessThan(1);
  await letGo(page);
  expect((await pressed(page, page.locator(".session-row").first()))!.scale).toBeLessThan(1);
  await letGo(page);

  // Reduced motion: the pressed state is still there, with nothing animated on the way.
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await start.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0s");
  expect((await pressed(page, start))!.scale).toBeLessThan(1);
  await letGo(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });

  // A disabled button doesn't move.
  await page.getByRole("button", { name: "Start session" }).click();
  await page.getByRole("button", { name: "Done · set 1" }).first().click();
  await page.getByRole("timer").getByRole("button", { name: "Skip", exact: true }).click();
  const lighter = page.getByRole("button", { name: "Lighter" }).first();
  for (let i = 0; i < 12 && (await lighter.isEnabled()); i++) await lighter.click();
  await expect(lighter).toBeDisabled();
  await lighter.scrollIntoViewIfNeeded();
  const box = (await lighter.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(150);
  expect(await transformOf(lighter)).toBeNull();
  await letGo(page);
});
