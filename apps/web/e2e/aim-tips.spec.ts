import { expect, test, type Page } from "@playwright/test";
import type { Equipment, Profile } from "@repcurve/shared";
import { exportBackup } from "../src/model/backup";
import { newCore } from "../src/model/plan";
import { onboard } from "./helpers";

/** Start today's session, log one set and finish it. */
async function quickWorkout(page: Page) {
  await page.getByRole("button", { name: "Start session" }).click();
  await page.getByRole("button", { name: "Done · set 1" }).first().click();
  await page.getByRole("button", { name: "End" }).click();
  await page.getByRole("button", { name: "Finish and save" }).click();
}

test("after a workout, a tip for the person's aim, with the research behind it", async ({ page }) => {
  await onboard(page);
  await quickWorkout(page);
  const tip = page.getByRole("region", { name: "Walk more, on top of your lifting" });
  await expect(tip).toContainText("Tip for your aim · Lose fat");
  await expect(tip).toContainText("2,000–3,000 steps");
  await tip.getByRole("button", { name: "Learn more" }).click();
  const more = page.getByRole("dialog", { name: "Walk more, on top of your lifting" });
  await expect(more).toContainText("The research");
  await expect(more.getByRole("link", { name: /Paluch AE et al\. \(2022\)/ })).toHaveAttribute("href", "https://doi.org/10.1016/S2468-2667(21)00302-9");
  await expect(more).toContainText("not medical advice");
  await more.getByRole("button", { name: "Close" }).click();
  await expect(tip.getByRole("button", { name: "Learn more" })).toBeFocused();
  await page.getByRole("button", { name: "Done" }).click();

  // Every tip for the aim, in Settings; and they can be turned off.
  await page.getByRole("button", { name: "Settings" }).click();
  const settings = page.locator("section").filter({ has: page.getByRole("heading", { name: "Tips for your aim" }) });
  await expect(settings).toContainText("Your aim: Lose fat");
  await settings.getByRole("button", { name: "See all 6 tips" }).click();
  const all = page.getByRole("dialog", { name: "Tips: Lose fat" });
  await expect(all.locator("details")).toHaveCount(6);
  await all.getByText("Protect your sleep while dieting").click();
  await expect(all).toContainText("fat-free mass");
  await all.getByRole("button", { name: "Close" }).click();
  await settings.getByRole("switch", { name: /A tip after each workout/ }).uncheck();

  await page.getByRole("button", { name: "Today" }).click();
  await quickWorkout(page);
  await expect(page.getByText("Next time")).toBeVisible();
  await expect(page.getByText(/Tip for your aim/)).toHaveCount(0);
});

test("someone set up before aims existed is asked for one after a workout, and tips follow it", async ({ page }) => {
  const profile: Profile = {
    sex: "female", age: 29, heightCm: 168, bodyweightKg: 64, trainingHistory: "a_little", goal: "both",
    daysPerWeek: 3, minutesPerSession: 20, injuries: [], units: "lb", split: "push_pull",
  };
  const equipment: Equipment = {
    dumbbells: { kind: "fixed", weights: [10, 15, 20, 25], unit: "lb", pairs: true },
    treadmill: false, mat: true, abRoller: false, pullupBar: false, bench: true, bands: [],
  };
  const backup = exportBackup({ core: newCore(profile, equipment, Date.now() - 86_400_000), active: null, history: [] }, Date.now());
  await page.goto("/");
  await page.getByRole("button", { name: "Paste one instead" }).click();
  await page.getByLabel("Backup text").fill(backup);
  await page.getByRole("button", { name: "Check backup" }).click();
  await page.getByRole("button", { name: "Restore", exact: true }).click();

  await quickWorkout(page);
  const ask = page.getByRole("region", { name: "What do you most want from training?" });
  await expect(ask).toContainText("Your plan stays as it is");
  await ask.getByRole("button", { name: /^Get stronger/ }).click();
  await expect(page.getByText("Tip for your aim · Get stronger")).toBeVisible();
  await expect(ask).toHaveCount(0);
});
