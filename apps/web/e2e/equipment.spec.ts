import { expect, test } from "@playwright/test";

async function toEquipment(page: import("@playwright/test").Page) {
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

test("one tap on Gym fills in a gym's equipment, and the plan uses it", async ({ page }) => {
  await toEquipment(page);
  await page.getByRole("button", { name: "Gym" }).click();
  await expect(page.getByRole("status")).toContainText("Gym setup filled in");
  await expect(page.getByRole("group", { name: "Dumbbells" }).getByRole("button", { name: "Adjustable" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Heaviest (lb)")).toHaveValue("100");
  for (const tile of ["Treadmill", /Flat bench/, "Pull-up bar", "Jump rope", "Bands"]) {
    await expect(page.getByRole("switch", { name: tile })).toBeChecked();
  }
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Start training" }).click();
  // The plan is built from it: the warm-up uses the rope.
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(page.getByText("Easy jump rope")).toBeVisible();
});

test("a jump rope can be ticked on its own", async ({ page }) => {
  await toEquipment(page);
  const rope = page.getByRole("switch", { name: "Jump rope" });
  await expect(rope).not.toBeChecked();
  await rope.click();
  await expect(rope).toBeChecked();
});
