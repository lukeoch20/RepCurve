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
  const file = page.locator('input[type="file"]');
  // A broken file explains itself and changes nothing.
  await file.setInputFiles({ name: "notes.json", mimeType: "application/json", buffer: Buffer.from("{ not json") });
  await expect(page.getByRole("status")).toContainText("isn't valid JSON");
  // Cancelling keeps the welcome screen.
  await file.setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("button", { name: "Set up my plan" })).toBeVisible();
  // Pasting the text works as well as a file (the claude.ai version sometimes offers only text).
  await page.getByRole("button", { name: "Paste one instead" }).click();
  await page.getByLabel("Backup text").fill(JSON.stringify(backup));
  await page.getByRole("button", { name: "Check backup" }).click();
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
  await expect(dialog).toHaveAccessibleName("Dumbbell front squat");
  await dialog.getByRole("button", { name: "Back to Goblet squat" }).click();
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "Start session" }).click();
  await page.getByRole("button", { name: "How to" }).first().click();
  await expect(page.getByRole("dialog")).toContainText("Each rep");
});

test.describe("in a desktop browser that offers its own install prompt", () => {
  test.use({ userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36" });

  test("the Install button shows the browser's prompt", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      const e = new Event("beforeinstallprompt") as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
      e.prompt = async () => {
        (window as unknown as { prompted: boolean }).prompted = true;
      };
      e.userChoice = Promise.resolve({ outcome: "accepted" });
      window.dispatchEvent(e);
    });
    await page.getByRole("button", { name: "Install app" }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { prompted?: boolean }).prompted)).toBe(true);
  });
});

test("in an app's built-in browser on iPhone, it says to open Safari", async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0",
  });
  const page = await ctx.newPage();
  await page.goto("http://127.0.0.1:4173/");
  await expect(page.getByRole("region", { name: "Install RepCurve" })).toContainText("Open this page in Safari");
  await ctx.close();
});
