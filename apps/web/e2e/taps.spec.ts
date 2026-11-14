import { expect, test, type Page } from "@playwright/test";
import { onboard } from "./helpers";

// A tick when a control that matters is tapped (src/ui/TapTick.tsx, src/platform/haptics.ts).
// Android pulses from code. An iPhone only ticks when the finger itself toggles a native switch,
// so there the button carries a see-through label with a hidden one inside it.

type Recorded = { __buzz: unknown[] };
const buzzes = (page: Page) => page.evaluate(() => (window as unknown as Recorded).__buzz);
const forget = (page: Page) =>
  page.evaluate(() => {
    (window as unknown as Recorded).__buzz.length = 0;
  });
/** Long enough for a pulse that shouldn't happen to have happened. */
const settle = (page: Page) => page.waitForTimeout(150);

test.describe("on a phone that can vibrate", () => {
  // Record vibrations instead of making them.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as Recorded;
      w.__buzz = [];
      Object.defineProperty(navigator, "vibrate", { configurable: true, value: (p: unknown) => (w.__buzz.push(p), true) });
    });
  });

  test("main buttons, steppers, segments and switches give one short pulse a tap; other taps give none", async ({ page }) => {
    await onboard(page);

    // A switch: one pulse, though the row's label passes its click on to the checkbox.
    await page.getByRole("button", { name: "Settings" }).click();
    await forget(page);
    const sound = page.getByRole("switch", { name: "Beep when rest is over" });
    await page.getByText("Beep when rest is over").click();
    await expect(sound).not.toBeChecked();
    await expect.poll(() => buzzes(page)).toEqual([15]);
    // The space above the words switches nothing, so it gives nothing.
    await page.locator(".toggle").filter({ has: sound }).click({ position: { x: 150, y: 3 } });
    await settle(page);
    await expect(sound).not.toBeChecked();
    expect(await buzzes(page)).toEqual([15]);

    // The tab bar doesn't tick; a main button does.
    await page.getByRole("button", { name: "Today" }).click();
    await settle(page);
    expect(await buzzes(page)).toEqual([15]);
    await page.getByRole("button", { name: "Start session" }).click();
    await expect.poll(() => buzzes(page)).toEqual([15, 15]);

    // A stepper and a segment.
    await page.getByRole("button", { name: "More reps" }).first().click();
    await expect.poll(() => buzzes(page)).toEqual([15, 15, 15]);
    await page.getByRole("group", { name: "Effort" }).first().locator("button[aria-pressed='false']").first().click();
    await expect.poll(() => buzzes(page)).toEqual([15, 15, 15, 15]);

    // A small button with no tick.
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await settle(page);
    expect(await buzzes(page)).toEqual([15, 15, 15, 15]);
  });

  test("a set or a finished session gives its own buzz in place of the tap's, and the rest timer's buttons pulse", async ({ page }) => {
    await onboard(page);
    await page.getByRole("button", { name: "Start session" }).click();
    await expect.poll(() => buzzes(page)).toContain(15);
    await forget(page);
    await page.getByRole("button", { name: "Done · set 1" }).first().click();
    await settle(page);
    expect(await buzzes(page)).toEqual([30]);

    await page.getByRole("button", { name: "+15 s" }).click();
    await expect.poll(() => buzzes(page)).toEqual([30, 15]);
    await page.getByRole("timer").getByRole("button", { name: "Skip", exact: true }).click();
    await expect.poll(() => buzzes(page)).toEqual([30, 15, 15]);

    // Finishing: the session's pattern, and no tap pulse after it to cut it short.
    await page.getByRole("button", { name: "End" }).click();
    await forget(page);
    await page.getByRole("button", { name: "Finish and save" }).click();
    await settle(page);
    expect(await buzzes(page)).toEqual([[40, 70, 40, 70, 120]]);
  });
});

test.describe("on an iPhone", () => {
  // Safari on iPhone: no Vibration API, and an <input> that knows the switch attribute.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "vibrate", { configurable: true, value: undefined });
      Object.defineProperty(HTMLInputElement.prototype, "switch", {
        configurable: true,
        get(this: HTMLInputElement) {
          return this.hasAttribute("switch");
        },
      });
    });
  });

  const tapLabel = (page: Page, name: string | RegExp) => page.getByRole("button", { name }).first().locator("label.tap-tick");

  test("a main button carries a label with a hidden switch: the tap lands on it, acts once and flips the switch", async ({ page }) => {
    // Every tap in the setup goes through such a label.
    await onboard(page);

    const start = page.getByRole("button", { name: "Start session" });
    const label = tapLabel(page, "Start session");
    await expect(label).toHaveCount(1);
    await expect(label).toHaveAttribute("aria-hidden", "true");
    await expect(label.locator("input")).toHaveAttribute("switch", "");
    // It covers the button, so that's what a finger hits; the switch itself is out of the way.
    const hit = await start.evaluate((el) => {
      el.scrollIntoView({ block: "center" });
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const cover = el.querySelector("label.tap-tick")!.getBoundingClientRect();
      const hidden = getComputedStyle(el.querySelector("label.tap-tick input")!).visibility;
      return { onLabel: top?.matches("label.tap-tick") ?? false, covers: r.width - cover.width <= 4 && r.height - cover.height <= 4, hidden };
    });
    expect(hit).toEqual({ onLabel: true, covers: true, hidden: "hidden" });
    // The button still reads as before.
    await expect(start).toHaveAccessibleName("Start session");

    // This tap takes the button off the page before its label can pass the click on.
    await start.click();
    await expect(page.getByRole("button", { name: "Done · set 1" }).first()).toBeVisible();

    // One tap is one step, and it's the switch that was flipped: the thing an iPhone ticks for.
    const more = page.getByRole("button", { name: "More reps" }).first();
    const reps = page.getByRole("group", { name: "Reps" }).first().locator(".value b");
    const before = Number(await reps.textContent());
    await more.click();
    await expect(reps).toHaveText(String(before + 1));
    await expect(more.locator("label.tap-tick input")).toBeChecked();
    await more.click();
    await expect(reps).toHaveText(String(before + 2));
    await expect(more.locator("label.tap-tick input")).not.toBeChecked();

    // A screen reader's "activate" goes straight to the switch: that has to press the button too, once.
    await more.locator("label.tap-tick input").dispatchEvent("click");
    await expect(reps).toHaveText(String(before + 3));
    // And the keyboard presses the button itself.
    await more.focus();
    await page.keyboard.press("Enter");
    await expect(reps).toHaveText(String(before + 4));

    // A set is logged once.
    await page.getByRole("button", { name: "Done · set 1" }).first().click();
    await expect(page.getByText(/^1 of \d+ sets$/)).toBeVisible();
  });

  test("the label steps aside while a button is disabled", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Set up my plan" }).click();
    // Nothing filled in yet: Next is disabled, and a tap on it must not tick.
    const next = page.getByRole("button", { name: "Next" });
    await expect(next).toBeDisabled();
    await expect(tapLabel(page, "Next")).toBeHidden();
    await page.getByRole("group", { name: "Sex" }).getByRole("button", { name: "Male", exact: true }).click();
    await page.getByLabel("Age").fill("33");
    await page.getByLabel("Weight (lb)").fill("185");
    await page.getByLabel("Height (ft)").fill("5");
    await page.getByLabel("(in)").fill("10");
    await expect(next).toBeEnabled();
    await expect(tapLabel(page, "Next")).toBeVisible();
  });

  test("switch rows stay plain switches, and turning Vibration off takes the labels away", async ({ page }) => {
    await onboard(page);
    await expect(tapLabel(page, "Start session")).toBeVisible();
    await page.getByRole("button", { name: "Settings" }).click();

    // Nothing is laid over a switch row: a screen reader's finger has to find the switch.
    await expect(page.locator(".toggle label.tap-tick")).toHaveCount(0);
    const sound = page.getByRole("switch", { name: "Beep when rest is over" });
    await sound.uncheck();
    await expect(sound).not.toBeChecked();
    await page.getByText("Beep when rest is over").click();
    await expect(sound).toBeChecked();

    const vibration = page.getByRole("switch", { name: /^Vibration/ });
    await expect(page.locator(".toggle").filter({ has: vibration })).toContainText("A light tick when you tap a main button.");
    await vibration.uncheck();
    await expect(page.locator("html")).toHaveAttribute("data-haptics", "off");
    await expect(page.locator("label.tap-tick:visible")).toHaveCount(0);
    // With the labels gone the buttons are plain buttons.
    await page.getByRole("button", { name: "Today" }).click();
    await expect(tapLabel(page, "Start session")).toBeHidden();
    await page.getByRole("button", { name: "Settings" }).click();
    await vibration.check();
    await expect(page.locator("html")).not.toHaveAttribute("data-haptics", "off");
    await page.getByRole("button", { name: "Today" }).click();
    await expect(tapLabel(page, "Start session")).toBeVisible();
  });

  test("a sheet still keeps keyboard focus inside: the hidden switches aren't stops", async ({ page }) => {
    await onboard(page);
    await page.getByRole("button", { name: "Start session" }).click();
    await page.getByRole("button", { name: "End" }).click();
    const sheet = page.getByRole("dialog", { name: "End this session?" });
    await expect(sheet).toBeVisible();
    const close = sheet.getByRole("button", { name: "Close" });
    const last = sheet.getByRole("button", { name: "Discard this session" });
    await close.focus();
    await page.keyboard.press("Shift+Tab");
    await expect(last).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
  });
});
