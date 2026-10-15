import { expect, test } from "@playwright/test";
import { onboard } from "./helpers";

test("a sheet keeps keyboard focus inside, closes on Escape and hands focus back", async ({ page }) => {
  await onboard(page);
  const opener = page.getByRole("button", { name: "Goblet squat" });
  await opener.focus();
  await page.keyboard.press("Enter");
  const sheet = page.getByRole("dialog", { name: "Goblet squat" });
  await expect(sheet).toBeVisible();
  // Focus starts on the sheet's first control.
  await expect(sheet.getByRole("button", { name: "Close" })).toBeFocused();
  const insideSheet = () => page.evaluate(() => document.activeElement?.closest(".sheet") !== null);
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Tab");
    expect(await insideSheet()).toBe(true);
  }
  // Shift+Tab from the first control wraps to the last.
  await sheet.getByRole("button", { name: "Close" }).focus();
  await page.keyboard.press("Shift+Tab");
  expect(await insideSheet()).toBe(true);
  await expect(sheet.getByRole("button", { name: "Close" })).not.toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("a backup with values the app doesn't know restores and plans, and one it can't repair is refused", async ({ page }) => {
  const backup = {
    format: "repcurve-backup",
    version: 1,
    core: {
      profile: { sex: "female", age: 41, heightCm: 165, bodyweightKg: 64, trainingHistory: "x", goal: "foo", split: "bar", daysPerWeek: 99, minutesPerSession: -5, injuries: "knee", units: "parsec" },
      equipment: { dumbbells: { kind: "adjustable", min: 5, max: 2, step: 0 }, treadmill: "yes", mat: true, abRoller: false, pullupBar: false, bench: true, bands: ["light", "steel"], machines: 7 },
      settings: { restSec: -10, transitionSec: "x" },
      state: { exercises: { goblet_squat: { repRange: [12, 8], targetReps: "x", loadKg: "heavy" } }, deloadRemaining: -1 },
      nextIndex: 3,
      startedAt: "2026-09-01T08:00:00.000Z",
    },
    history: [],
  };
  await page.goto("/");
  await page.getByRole("button", { name: "Paste one instead" }).click();
  await page.getByLabel("Backup text").fill(JSON.stringify({ ...backup, core: { ...backup.core, profile: { ...backup.core.profile, sex: "?" } } }));
  await page.getByRole("button", { name: "Check backup" }).click();
  await expect(page.getByRole("status")).toContainText("profile is damaged");
  await page.getByLabel("Backup text").fill(JSON.stringify(backup));
  await page.getByRole("button", { name: "Check backup" }).click();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.getByText(/Week \d+ · session 4/)).toBeVisible();
  await expect(page.getByText("RepCurve hit a problem")).toHaveCount(0);
  await page.getByRole("button", { name: "Plan" }).click();
  await expect(page.getByText("RepCurve hit a problem")).toHaveCount(0);
});

test("a full phone is named, with a backup button beside it", async ({ page }) => {
  // Stand in for a full disk: every IndexedDB write fails the way a browser out of space fails it.
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
      if (localStorage.getItem("e2e.full")) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      return put.apply(this, args);
    };
  });
  await onboard(page);
  await page.evaluate(() => localStorage.setItem("e2e.full", "1"));
  await page.getByRole("button", { name: "Start session" }).click();
  const toast = page.getByRole("alert").filter({ hasText: "out of space" });
  await expect(toast).toContainText("Your phone is out of space for RepCurve's data. Save a backup, then free some space.");
  await expect(toast.getByRole("button", { name: "Save a backup" })).toBeVisible();
});

test("a tap that fails inside the planner changes nothing, says so, and is logged", async ({ page }) => {
  // Stand in for an engine error: the planner's copy step fails while the flag is set.
  await page.addInitScript(() => {
    const clone = window.structuredClone;
    window.structuredClone = ((value: unknown, options?: StructuredSerializeOptions) => {
      if (localStorage.getItem("e2e.fail")) throw new Error("planner failed");
      return clone(value, options);
    }) as typeof structuredClone;
  });
  await onboard(page);
  await page.evaluate(() => localStorage.setItem("e2e.fail", "1"));
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "That didn't work, so nothing was changed." })).toBeVisible();
  // Still on Today, not a blank page or the crash screen.
  await expect(page.getByText("RepCurve hit a problem")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start session" })).toBeVisible();
  await page.evaluate(() => localStorage.removeItem("e2e.fail"));
  await page.getByRole("button", { name: "Dismiss" }).click();
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(page.getByRole("button", { name: "Done · set 1" }).first()).toBeVisible();
  const log = await page.evaluate(() => JSON.parse(localStorage.getItem("repcurve.crashes") ?? "[]") as { where: string; message: string }[]);
  expect(log).toEqual([expect.objectContaining({ where: "action: start", message: "Error: planner failed" })]);
});

test("the error log can be copied from Settings", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => {
    localStorage.setItem("repcurve.crashes", JSON.stringify([{ at: Date.UTC(2026, 9, 15, 9), where: "action: start", message: "Error: test failure" }]));
  });
  await onboard(page);
  await page.getByRole("button", { name: "Settings" }).click();
  const section = page.getByRole("heading", { name: "Error log" }).locator("..");
  await expect(section).toContainText("1 recent error recorded on this device");
  await section.getByRole("button", { name: "Copy error log" }).click();
  await expect(section.getByRole("status")).toContainText("Error log copied");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("action: start");
  expect(copied).toContain("Error: test failure");
});
