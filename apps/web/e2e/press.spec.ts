import { expect, test, type Locator, type Page } from "@playwright/test";
import { onboard } from "./helpers";

// Press feel: a control goes down when it's touched and comes back by itself (styles.css).

type Matrix = { scale: number; x: number; y: number } | null;
/** The control's transform as a scale and a shift; null while it's at rest. */
const transformOf = (control: Locator): Promise<Matrix> =>
  control.evaluate((el) => {
    const t = getComputedStyle(el).transform;
    if (t === "none") return null;
    const m = t.slice(t.indexOf("(") + 1, -1).split(",").map(Number);
    return { scale: m[0]!, x: m[4]!, y: m[5]! };
  });
const styleOf = (control: Locator, prop: string) => control.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
/** Presses and holds, and gives the transform the control settles at while it's held down. */
async function pressed(page: Page, control: Locator, at?: { x: number; y: number }): Promise<Matrix> {
  await control.scrollIntoViewIfNeeded();
  const box = (await control.boundingBox())!;
  await page.mouse.move(box.x + (at?.x ?? box.width / 2), box.y + (at?.y ?? box.height / 2));
  await page.mouse.down();
  let last: Matrix = null;
  await expect
    .poll(async () => {
      const now = await transformOf(control);
      const still = JSON.stringify(now) === JSON.stringify(last);
      last = now;
      return still && now !== null;
    })
    .toBe(true);
  return last;
}
/** Let go away from the control, so nothing is tapped. */
async function letGo(page: Page) {
  await page.mouse.move(2, 300);
  await page.mouse.up();
}

test("a pressed button goes down after a moment's wait, does nothing until it's let go on it, and comes back by itself", async ({ page }) => {
  await onboard(page);
  const start = page.getByRole("button", { name: "Start session" });
  expect(await transformOf(start)).toBeNull();
  // A second tap in a hurry is a tap, not a zoom.
  expect(await styleOf(start, "touch-action")).toBe("manipulation");

  const down = await pressed(page, start);
  // Bluebird, the look a new setup starts in: the button moves into the page.
  expect(down!.y).toBeGreaterThan(0);
  expect(down!.scale).toBeLessThan(1);
  // The movement waits a moment, so a thumb that lands here to scroll doesn't make it dip.
  expect(await styleOf(start, "transition-delay")).toBe("0.04s");

  await letGo(page);
  await expect.poll(() => transformOf(start)).toBeNull();
  await expect(start).toBeVisible();
  await expect(page.getByRole("button", { name: "Done · set 1" })).toHaveCount(0);

  // A row waits longer, moves less and fades into a shade.
  const row = page.locator(".session-row").first();
  const rowDown = await pressed(page, row);
  expect(rowDown!.scale).toBeGreaterThan(down!.scale);
  expect(await styleOf(row, "transition-delay")).toBe("0.09s");
  await expect.poll(() => styleOf(row, "filter")).toBe("contrast(0.88)");
  await letGo(page);
  await expect.poll(() => styleOf(row, "filter")).toBe("none");

  // A look that's still locked can't be put on, and doesn't move or shade when pressed.
  await page.getByRole("button", { name: "Settings" }).click();
  const locked = page.getByRole("group", { name: "Style" }).getByRole("button", { name: /^Fired Forge/ });
  await expect(locked).toHaveAttribute("aria-disabled", "true");
  await locked.scrollIntoViewIfNeeded();
  const box = (await locked.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(250);
  expect(await transformOf(locked)).toBeNull();
  expect(await styleOf(locked, "filter")).toBe("none");
  await letGo(page);
});

test("a press held at the very edge of a button still counts, though the button has shrunk away from it", async ({ page }) => {
  await onboard(page, "/test/");
  const start = page.getByRole("button", { name: "Start session" });
  // Classic squeezes its main buttons the most: about 5px comes off each side.
  await page.evaluate(() => localStorage.setItem("repcurve-test.style", "classic-light"));
  await page.reload();
  await expect(start).toBeVisible();
  const down = await pressed(page, start, { x: 2, y: 28 });
  expect(down!.scale).toBeLessThan(0.98);
  // The pointer is now outside the shrunken button, on the pad that reaches back out to it.
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "Done · set 1" }).first()).toBeVisible();
});

test("each look presses its own way, a disabled button stays put, and reduced motion drops the animation", async ({ page }) => {
  await onboard(page, "/test/");
  const start = page.getByRole("button", { name: "Start session" });
  const tab = page.getByRole("button", { name: "Plan", exact: true });
  const wear = async (style: string) => {
    await page.evaluate((s) => localStorage.setItem("repcurve-test.style", s), style);
    await page.reload();
    await expect(start).toBeVisible();
  };

  // Classic squeezes, and shades with a tint of its ink.
  await wear("classic-light");
  const classic = await pressed(page, start);
  expect(classic!.scale).toBeLessThan(1);
  expect(classic!.x).toBe(0);
  expect(await styleOf(start, "background-image")).toContain("linear-gradient");
  await letGo(page);
  // A small control moves more than a big one.
  expect((await pressed(page, tab))!.scale).toBeLessThan(classic!.scale);
  await letGo(page);

  // Gold Plated and Cut Like a Diamond: the faceted main button dips 1px. Its cut corners would
  // clip the pad that keeps an edge tap, so it doesn't shrink.
  for (const style of ["gold-dark", "diamond-light"]) {
    await wear(style);
    expect(await pressed(page, start), style).toEqual({ scale: 1, x: 0, y: 1 });
    await letGo(page);
  }
  // Fired Forge is stamped straight down, and comes back without a bounce.
  await wear("forge-dark");
  expect(await pressed(page, start)).toEqual({ scale: 1, x: 0, y: 2 });
  await letGo(page);
  expect(await styleOf(start, "transition-timing-function")).toContain("cubic-bezier(0.2, 0.8, 0.3, 1)");
  // Pixel Press lands on its own offset shadow at once, and is back at once.
  await wear("pixel-light");
  expect(await pressed(page, start)).toEqual({ scale: 1, x: 2, y: 2 });
  expect(await styleOf(start, "transition-delay")).toBe("0s");
  await letGo(page);
  expect(await styleOf(start, "transition-duration")).toBe("0s");

  // Reduced motion: the pressed state is still there, nothing is animated, and the wait stays.
  await wear("bluebird-dark");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await styleOf(start, "transition-duration")).toBe("0s");
  expect((await pressed(page, start))!.scale).toBeLessThan(1);
  expect(await styleOf(start, "transition-duration")).toBe("0s");
  expect(await styleOf(start, "transition-delay")).toBe("0.04s");
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
  await page.waitForTimeout(250);
  expect(await transformOf(lighter)).toBeNull();
  await letGo(page);
});
