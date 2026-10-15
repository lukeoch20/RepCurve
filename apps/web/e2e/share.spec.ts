import { expect, test } from "@playwright/test";
import { onboard } from "./helpers";

test("Progress makes a picture of your curve to share or save", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Progress" }).click();
  // Nothing to share before the first workout.
  await expect(page.getByRole("button", { name: "Share", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Today" }).click();
  await page.getByRole("button", { name: "Start session" }).click();
  await page.getByRole("button", { name: "Done · set 1" }).first().click();
  await page.getByRole("button", { name: "End" }).click();
  await page.getByRole("button", { name: "Finish and save" }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();

  await page.getByRole("button", { name: "Progress" }).click();
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Share your progress" });
  const img = sheet.getByRole("img", { name: /^My strength curve: / });
  await expect(img).toBeVisible();
  expect(await img.evaluate((el: HTMLImageElement) => [el.naturalWidth, el.naturalHeight])).toEqual([1080, 1080]);

  // Without a share sheet that takes files, it downloads.
  const save = sheet.getByRole("button", { name: /^(Share|Save picture)$/ });
  if ((await save.textContent()) === "Save picture") {
    const download = page.waitForEvent("download");
    await save.click();
    expect((await download).suggestedFilename()).toMatch(/^repcurve-progress-\d{4}-\d{2}-\d{2}\.png$/);
    await expect(sheet.getByRole("status")).toContainText("Picture saved");
  }
});
