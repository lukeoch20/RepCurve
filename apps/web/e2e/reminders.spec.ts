import { expect, test } from "@playwright/test";
import { onboard } from "./helpers";

test("reminders: pick training days and add them to the calendar as one repeating event", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Settings" }).click();
  const days = page.getByRole("group", { name: "Training days" });
  await expect(days).toBeVisible();
  // Start from Monday, Wednesday and Saturday.
  for (const d of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
    const chip = days.getByRole("button", { name: d });
    const want = ["Mon", "Wed", "Sat"].includes(d);
    if ((await chip.getAttribute("aria-pressed")) !== String(want)) await chip.click();
  }
  await page.getByLabel("Reminder time").fill("18:30");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Add to my calendar" }).click()]);
  // The tests run as an iPhone, where the calendar file is opened (Safari then offers Add All).
  expect(download.suggestedFilename()).toMatch(/\.ics$/);
  const ics = await (await download.createReadStream()).toArray().then((chunks) => Buffer.concat(chunks).toString("utf8"));
  expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO,WE,SA");
  expect(ics).toMatch(/DTSTART:\d{8}T183000/);
  await expect(page.getByText("Added for Mon, Wed, Sat at 18:30.")).toBeVisible();
});
