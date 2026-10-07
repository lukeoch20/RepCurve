import { expect, test } from "@playwright/test";
import { onboard } from "./helpers";

test("on iPhone Safari the welcome screen explains installing before setup", async ({ page }) => {
  await page.goto("/");
  const card = page.getByRole("region", { name: "Install RepCurve" });
  await expect(card).toContainText("Add to Home Screen");
  await expect(card).toContainText("before setting up");
});

test("once opened from the home screen, the install guide is gone", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "standalone", { value: true }));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Set up my plan" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Install RepCurve" })).toHaveCount(0);
});

test("a backup can be restored from the welcome screen, without setting up first", async ({ page }) => {
  const backup = {
    format: "repcurve-backup",
    version: 1,
    core: {
      profile: { sex: "female", age: 41, heightCm: 165, bodyweightKg: 64, trainingHistory: "a_little", goal: "both", daysPerWeek: 3, minutesPerSession: 20, injuries: [], units: "kg" },
      equipment: { dumbbells: { kind: "fixed", weights: [4, 6, 8], unit: "kg", pairs: true }, treadmill: false, mat: true, abRoller: false, pullupBar: false, bench: true, bands: [] },
      state: {},
      nextIndex: 4,
      startedAt: "2026-09-01T08:00:00.000Z",
    },
    history: [],
  };
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.getByText("Week 2 · session 5")).toBeVisible();
});

test("tapping an exercise shows how to do it, before and during a workout", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Goblet squat" }).click();
  const sheet = page.getByRole("dialog", { name: "Goblet squat" });
  await expect(sheet).toContainText("Each rep");
  await expect(sheet).toContainText("Works your quads and glutes");
  // Easier and harder versions open in place (the sheet takes their name), with a way back.
  await sheet.getByRole("button", { name: /^Harder:/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).not.toHaveAccessibleName("Goblet squat");
  await dialog.getByRole("button", { name: "Back to Goblet squat" }).click();
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "Start session" }).click();
  await page.getByRole("button", { name: "How to" }).first().click();
  await expect(page.getByRole("dialog")).toContainText("Each rep");
});
