import { expect, test, type Page } from "@playwright/test";
import { onboard } from "./helpers";

async function finish(page: Page) {
  await page.getByRole("button", { name: "End" }).click();
  await page.getByRole("button", { name: "Finish and save" }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
}

test("What RepCurve knows: what hurt, what was swapped and working weights, each with a fix", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Start session" }).click();

  // Swap the first exercise out for good, then flag the next one as hurting the knee.
  await page.getByRole("button", { name: "Swap" }).first().click();
  const sheet = page.getByRole("dialog", { name: /^Swap / });
  const swappedOut = (await sheet.getByRole("heading").textContent())!.replace(/^Swap /, "");
  await sheet.getByRole("group", { name: "Why swap" }).getByRole("button", { name: "Don't like it" }).click();
  await sheet.locator(".choice button").first().click();
  await page.getByRole("button", { name: "Done · set 1" }).first().click();
  await page.getByRole("button", { name: "It hurt" }).first().click();
  await page.getByRole("group", { name: "Where it hurt" }).getByRole("button", { name: "Knee" }).click();
  await page.getByRole("button", { name: "Carry on" }).click();
  await finish(page);

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "What RepCurve knows about you" }).click();
  await expect(page.getByRole("heading", { name: "What RepCurve knows" })).toBeVisible();
  await expect(page.getByText(/Started as: Beginner/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Sets each week" })).toContainText("Quads");

  const pain = page.getByRole("region", { name: "Pain" });
  await expect(pain).toContainText("Knee");
  await expect(pain).toContainText("Lifts after 2 pain-free sessions or 6 weeks");
  await pain.getByRole("button", { name: "Knee: it's fine now" }).click();
  await expect(page.getByRole("status")).toContainText("your knee is fine now");
  await expect(pain).toContainText("Nothing flagged right now.");

  const swaps = page.getByRole("region", { name: "Exercises you swapped out" });
  await expect(swaps).toContainText(swappedOut);
  await expect(swaps).toContainText("You don't like it.");
  await swaps.getByRole("button", { name: `${swappedOut}: bring it back` }).click();
  await expect(page.getByRole("status")).toContainText(`${swappedOut} is back in your plan.`);
  await expect(swaps).toContainText("Nothing to remember yet.");

  const weights = page.getByRole("region", { name: "Working weights" });
  const retest = weights.getByRole("button", { name: /^Re-test / }).first();
  const name = (await retest.getAttribute("aria-label"))!.replace(/^Re-test /, "");
  await retest.click();
  await expect(page.getByRole("status")).toContainText(`Next time, ${name} starts with a test set.`);
  await expect(weights).toContainText("Re-testing next time");
  await expect(weights.getByRole("button", { name: `Re-test ${name}` })).toHaveCount(0);

  // The corrections are saved: they're still there after a reload.
  await page.reload();
  await page.getByRole("button", { name: "What RepCurve knows about you" }).click();
  await expect(page.getByRole("region", { name: "Pain" })).toContainText("Nothing flagged right now.");
  await expect(page.getByRole("region", { name: "Working weights" })).toContainText("Re-testing next time");

  // Back, and in from Progress too.
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("heading", { name: "Make it yours" })).toBeVisible();
  await page.getByRole("button", { name: "Progress" }).click();
  await page.getByRole("button", { name: "What RepCurve knows about you" }).click();
  await expect(page.getByRole("heading", { name: "What RepCurve knows" })).toBeVisible();
  await page.getByRole("button", { name: "Today" }).click();
  await expect(page.getByRole("button", { name: "Start session" })).toBeVisible();
});

test("Still sore: asked before a session that works the same muscles, and very sore means a set fewer", async ({ page }) => {
  await onboard(page);
  // No session yet: nothing to ask.
  await expect(page.getByRole("heading", { name: /Still sore/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Start session" }).click();
  // Push day: a set of push-ups and a set of goblet squats (quads and glutes).
  await page.getByRole("button", { name: "Done · set 1" }).first().click();
  await page.getByRole("button", { name: "Done · set 1" }).first().click();
  await finish(page);

  // Pull day's deadlift works the glutes again.
  await expect(page.getByRole("heading", { name: "Pull day" })).toBeVisible();
  const check = page.getByRole("region", { name: "Still sore from your earlier session today?" });
  await expect(check).toContainText("Today works your glutes again.");
  const lineup = page.locator(".lineup");
  const rdl = lineup.locator(".lineup-item", { hasText: "Romanian deadlift" });
  await expect(rdl).toContainText("2 ×");

  await check.getByRole("group", { name: "How sore" }).getByRole("button", { name: "A bit" }).click();
  await expect(check).toContainText("The plan stays as it is");
  await expect(rdl).toContainText("2 ×");

  await check.getByRole("group", { name: "How sore" }).getByRole("button", { name: "Very" }).click();
  await expect(check.getByRole("status")).toHaveText(/Glutes still very sore: one set fewer of Dumbbell Romanian deadlift, at the same weight today\./);
  await expect(rdl).toContainText("1 ×");
  // Other exercises are as planned.
  await expect(lineup.locator(".lineup-item", { hasText: "Dumbbell curl" })).toContainText("2 ×");

  // The answer is kept (asked once), and the session starts with it.
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Today" }).click();
  await expect(page.getByRole("region", { name: /Still sore/ }).getByRole("button", { name: "Very" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(page.locator("article.block", { hasText: "Romanian deadlift" }).locator(".block-target").first()).toContainText("1 sets");
  await page.getByRole("button", { name: "Done · set 1" }).first().click();
  await finish(page);

  // The profile learned it.
  await page.getByRole("button", { name: "Progress" }).click();
  await page.getByRole("button", { name: "What RepCurve knows about you" }).click();
  await expect(page.getByRole("region", { name: "Soreness" })).toContainText("Glutes");
  await expect(page.getByRole("region", { name: "Soreness" })).toContainText("Last time: very sore");
});
