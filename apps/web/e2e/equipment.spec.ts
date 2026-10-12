import { expect, test } from "@playwright/test";

async function toWhere(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Set up my plan" }).click();
  await page.getByRole("group", { name: "Sex" }).getByRole("button", { name: "Male", exact: true }).click();
  await page.getByLabel("Age").fill("30");
  await page.getByLabel("Weight (lb)").fill("180");
  await page.getByLabel("Height (ft)").fill("5");
  await page.getByLabel("(in)").fill("11");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: /A little/ }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
}

test("a gym comes filled in with machines, and a newcomer's plan uses them", async ({ page }) => {
  await toWhere(page);
  await page.getByRole("button", { name: /At a gym/ }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { name: "What does your gym have?" })).toBeVisible();
  await expect(page.getByLabel("Heaviest (lb)")).toHaveValue("100");
  for (const tile of ["Barbell and plates", "Cable station", "Rower", "Adjustable bench"]) {
    await expect(page.getByRole("switch", { name: new RegExp(tile) })).toBeChecked();
  }
  await expect(page.getByRole("group", { name: "Machines" }).getByRole("button", { name: "Leg press" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Start training" }).click();
  await expect(page.getByRole("button", { name: /Chest press|Leg press|Lat pulldown/ }).first()).toBeVisible();
  // No jump rope warm-up: it's a cardio option, not a default warm-up.
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(page.getByText(/jump rope/i)).toHaveCount(0);
});

test("home and gym: each place has its own equipment, and Today switches between them", async ({ page }) => {
  await toWhere(page);
  await page.getByRole("button", { name: /^Both/ }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { name: "What do you have at home?" })).toBeVisible();
  const weights = page.getByRole("group", { name: "Dumbbell weights" });
  for (const w of ["10", "15", "20"]) await weights.getByRole("button", { name: w, exact: true }).click();
  await page.getByRole("group", { name: "Place" }).getByRole("button", { name: "Gym" }).click();
  await expect(page.getByRole("heading", { name: "What does your gym have?" })).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Start training" }).click();

  const where = page.getByRole("group", { name: "Training at" });
  await expect(where.getByRole("button", { name: "Home" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /Leg press|Lat pulldown|Chest press/ })).toHaveCount(0);
  await where.getByRole("button", { name: "Gym" }).click();
  await expect(page.getByRole("button", { name: /Leg press|Lat pulldown|Chest press/ }).first()).toBeVisible();
});

test("bands ask about an anchor, and a jump rope can be ticked on its own", async ({ page }) => {
  await toWhere(page);
  await page.getByRole("button", { name: "Next" }).click();
  const rope = page.getByRole("switch", { name: "Jump rope" });
  await expect(rope).not.toBeChecked();
  await rope.click();
  await expect(rope).toBeChecked();
  await expect(page.getByLabel(/door anchor/)).toHaveCount(0);
  await page.getByRole("switch", { name: "Bands" }).click();
  await expect(page.getByLabel(/door anchor/)).not.toBeChecked();
});
