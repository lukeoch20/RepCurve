import { expect, test, type Page } from "@playwright/test";
import { onboard } from "./helpers";

const MONDAY = new Date("2026-10-05T07:00:00");
const timer = (page: Page) => page.getByRole("timer");
/** The line beside the timer: which side, set or amount this step is. */
const target = (page: Page) => page.locator(".cardio-clock .block-target");
const finished = (page: Page) => page.getByRole("heading", { level: 1, name: /^(All of it, done|Done for today)$/ });

/** Run the session on screen to its end: tap Done on reps and let the clock run the holds. */
async function runToEnd(page: Page) {
  const done = page.getByRole("button", { name: "Done", exact: true });
  for (let i = 0; i < 120; i++) {
    if (await finished(page).isVisible()) return;
    if (await done.isVisible()) await done.click();
    // Short steps, so a countdown is never found long over (which would pause the session).
    else await page.clock.runFor(10_000);
  }
  throw new Error("The session did not finish");
}

/** A saved setup, restored from the welcome screen: the quick way to a state that takes weeks to reach. */
async function restore(page: Page, core: { injuries?: string[]; mobility?: unknown }) {
  const backup = {
    format: "repcurve-backup",
    version: 1,
    core: {
      profile: { sex: "female", age: 41, heightCm: 165, bodyweightKg: 64, trainingHistory: "a_little", goal: "both", daysPerWeek: 3, minutesPerSession: 20, injuries: core.injuries ?? [], units: "kg" },
      equipment: { dumbbells: { kind: "fixed", weights: [4, 6, 8], unit: "kg", pairs: true }, treadmill: false, mat: true, abRoller: false, pullupBar: false, bench: true, bands: [] },
      state: {},
      nextIndex: 4,
      startedAt: "2026-09-01T08:00:00.000Z",
      ...(core.mobility ? { mobility: core.mobility } : {}),
    },
    history: [],
  };
  await page.goto("/");
  await page.getByRole("button", { name: "Paste one instead" }).click();
  await page.getByLabel("Backup text").fill(JSON.stringify(backup));
  await page.getByRole("button", { name: "Check backup" }).click();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start session" })).toBeVisible();
}

test("the hips block starts under Plan, runs on the timer beside today's workout, and counts", async ({ page }) => {
  await page.clock.install({ time: MONDAY });
  await onboard(page);
  // Today has a way in; Plan lists the routines.
  await expect(page.getByRole("button", { name: /Stretch and loosen up/ })).toBeVisible();
  await page.getByRole("button", { name: "Plan" }).click();
  const mobility = page.getByRole("region", { name: "Mobility" });
  await expect(mobility.getByRole("button", { name: /Hips: mobility and strength/ })).toContainText("6-week block");
  await expect(mobility.getByRole("button", { name: /Morning mobility/ })).toContainText("Quick session");
  await mobility.getByRole("button", { name: /Hips: mobility and strength/ }).click();
  const sheet = page.getByRole("dialog", { name: "Hips: mobility and strength" });
  await expect(sheet).toContainText("6 weeks, 3 sessions a week");
  await sheet.getByRole("button", { name: "Start the 6 weeks" }).click();
  await expect(sheet.getByRole("region", { name: "Your block" })).toContainText("Session 1 of 18");
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(mobility.getByRole("button", { name: /Hips: mobility and strength/ })).toContainText("Session 1 of 18");

  // Today shows the session beside the workout: what comes first, and what the two add up to.
  await page.getByRole("button", { name: "Today" }).click();
  const today = page.getByRole("region", { name: "Hips: session 1 of 18" });
  await expect(today).toContainText(/Your workout comes first\. Do this after it or on a day off: with today's push day it comes to about \d+ minutes\./);
  // The workout can be shortened to fit both into the usual time. It's a choice, never done for you.
  await today.getByRole("button", { name: /^Only have 20 minutes\? Shorten today's workout to 10$/ }).click();
  await expect(page.getByRole("group", { name: "Time" })).toContainText("10");
  await expect(today.getByRole("button", { name: /Only have/ })).toHaveCount(0);

  await today.getByRole("button", { name: "Start hips session" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Hips: mobility and strength" })).toBeVisible();
  await expect(page.getByText("Mobility · session 1 of 18 · level 1")).toBeVisible();
  // Get ready counts down by itself; slow reps then wait for Done, one side at a time.
  await expect(timer(page)).toHaveAccessibleName("Get ready: 0:10 left");
  await expect(page.getByRole("button", { name: "Start now" })).toBeVisible();
  await page.clock.runFor(10_500);
  await expect(timer(page)).toHaveAccessibleName("4 circles each way");
  await expect(target(page)).toHaveText("4 circles each way · left leg");
  await page.clock.runFor(60_000);
  await expect(target(page)).toHaveText("4 circles each way · left leg");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(target(page)).toHaveText("4 circles each way · right leg");

  await runToEnd(page);
  await expect(page.getByRole("heading", { level: 1, name: "All of it, done" })).toBeVisible();
  await expect(page.getByRole("region", { name: "This session" })).toContainText("6 of 6");
  await expect(page.getByText("Session 1 of 18 done. 1 of 3 this week.")).toBeVisible();
  // Leaving the summary lands back on the tabs.
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Hips: session 2 of 18" })).toBeVisible();
  await expect(page.getByText("Done for today. The next one is ready whenever you are.")).toBeVisible();
  // A workout still starts as before.
  await expect(page.getByRole("button", { name: "Start session" })).toBeVisible();
  await page.getByRole("button", { name: "Progress" }).click();
  await expect(page.getByRole("region", { name: "Mobility" })).toContainText("Hips block: 1 of 18 sessions");
});

test("something hurts pauses first; the stopped drill is remembered, and a reload brings the session back paused", async ({ page }) => {
  await page.clock.install({ time: MONDAY });
  await onboard(page);
  await page.getByRole("button", { name: /Stretch and loosen up/ }).click();
  await page.getByRole("dialog", { name: "Mobility" }).getByRole("button", { name: /Desk-day reset/ }).click();
  await page.getByRole("dialog", { name: "Desk-day reset" }).getByRole("button", { name: "Start this session" }).click();
  await expect(page.getByText("Mobility", { exact: true })).toBeVisible();
  await page.clock.runFor(10_500);
  await expect(timer(page)).toHaveAccessibleName(/^Hold: 0:4\d left$/);
  await expect(target(page)).toHaveText("Left knee down");
  await page.clock.runFor(10_000);

  // The clock stops before anything is asked.
  await page.getByRole("button", { name: "Something hurts" }).click();
  const hurts = page.getByRole("dialog", { name: "Something hurts?" });
  await expect(hurts).toContainText("The session is paused.");
  const left = (await timer(page).getAttribute("aria-label"))!;
  expect(left).toMatch(/^Hold: 0:3\d left, paused$/);
  await page.clock.runFor(30_000);
  await expect(timer(page)).toHaveAttribute("aria-label", left);
  await hurts.getByRole("button", { name: "Stop this drill" }).click();
  // After pain nothing starts by itself: the next drill waits for a tap, hands-free or not.
  await expect(timer(page)).toHaveAccessibleName("Ready: tap start");
  await page.clock.runFor(30_000);
  await expect(timer(page)).toHaveAccessibleName("Ready: tap start");
  await expect(page.locator(".segment.drill").first()).toContainText("stopped");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(timer(page)).toHaveAccessibleName("Hold: 0:45 left");
  await page.clock.runFor(5_000);

  // A reload mid-hold: the session is back, paused, with that hold ready to start again in full.
  await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "Paused" })).toBeVisible();
  await expect(timer(page)).toHaveAccessibleName("Hold: 0:45 left, paused");
  await page.getByRole("button", { name: "Resume" }).first().click();
  await page.clock.runFor(20_000);
  await expect(timer(page)).toHaveAccessibleName(/^Hold: 0:2\d left$/);

  // End stops the clock while you decide, and Keep going picks it up again.
  await page.getByRole("button", { name: "End", exact: true }).click();
  const end = page.getByRole("dialog", { name: "End this session?" });
  await expect(end).toContainText("What you've done is saved.");
  const held = (await timer(page).getAttribute("aria-label"))!;
  expect(held).toMatch(/^Hold: 0:2\d left, paused$/);
  await page.clock.runFor(30_000);
  await expect(timer(page)).toHaveAttribute("aria-label", held);
  await end.getByRole("button", { name: "Keep going" }).click();
  await expect(timer(page)).toHaveAttribute("aria-label", held.replace(", paused", ""));
  // Ending early keeps what was done.
  await page.getByRole("button", { name: "End", exact: true }).click();
  await end.getByRole("button", { name: "Finish and save" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Done for today" })).toBeVisible();
  await expect(page.getByText("You stopped half-kneeling hip-flexor stretch")).toBeVisible();
  await page.getByRole("button", { name: "Done", exact: true }).click();

  // Next time the routine says so, and the drill can be left out and brought back.
  await page.getByRole("button", { name: /Stretch and loosen up/ }).click();
  await page.getByRole("dialog", { name: "Mobility" }).getByRole("button", { name: /Desk-day reset/ }).click();
  const routine = page.getByRole("dialog", { name: "Desk-day reset" });
  await expect(routine).toContainText("You stopped this for pain last time.");
  await expect(routine.locator(".lineup-item")).toHaveCount(5);
  await routine.getByRole("button", { name: "Leave out Half-kneeling hip-flexor stretch" }).click();
  await expect(routine.locator(".lineup-item")).toHaveCount(4);
  await routine.getByRole("button", { name: "Bring back Half-kneeling hip-flexor stretch" }).click();
  await expect(routine.locator(".lineup-item")).toHaveCount(5);
});

test("with hands-free off, each step waits for a tap", async ({ page }) => {
  await page.clock.install({ time: MONDAY });
  await onboard(page);
  await page.getByRole("button", { name: "Plan" }).click();
  await page.getByRole("region", { name: "Mobility" }).getByRole("button", { name: /Desk-day reset/ }).click();
  const routine = page.getByRole("dialog", { name: "Desk-day reset" });
  await routine.getByRole("switch", { name: /Hands-free/ }).uncheck();
  await routine.getByRole("button", { name: "Start this session" }).click();
  await expect(timer(page)).toHaveAccessibleName("Ready: tap start");
  await page.clock.runFor(30_000);
  await expect(timer(page)).toHaveAccessibleName("Ready: tap start");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  // The hold itself always counts down; the change of sides then waits.
  await expect(timer(page)).toHaveAccessibleName("Hold: 0:45 left");
  await page.clock.runFor(45_500);
  await expect(timer(page)).toHaveAccessibleName("Ready: tap start");
  await expect(target(page)).toHaveText("Next: right knee down");
  await page.getByRole("button", { name: "Start the other side" }).click();
  await expect(target(page)).toHaveText("Right knee down");
  // Nothing done yet counts for little: it can be thrown away.
  await page.getByRole("button", { name: "End", exact: true }).click();
  await page.getByRole("dialog", { name: "End this session?" }).getByRole("button", { name: "Discard this session" }).click();
  await expect(page.getByRole("region", { name: "Mobility" })).toBeVisible();
  // The choice sticks for next time.
  await page.getByRole("region", { name: "Mobility" }).getByRole("button", { name: /Desk-day reset/ }).click();
  await expect(page.getByRole("dialog", { name: "Desk-day reset" }).getByRole("switch", { name: /Hands-free/ })).not.toBeChecked();
});

test("sore knees get gentler drills, and the routine says what changed", async ({ page }) => {
  await page.clock.install({ time: MONDAY });
  await restore(page, { injuries: ["knee"] });
  await page.getByRole("button", { name: "Plan" }).click();
  await page.getByRole("region", { name: "Mobility" }).getByRole("button", { name: /Hips: mobility and strength/ }).click();
  const sheet = page.getByRole("dialog", { name: "Hips: mobility and strength" });
  await sheet.getByRole("group", { name: "Level" }).getByRole("button", { name: "Level 3" }).click();
  const changed = sheet.getByRole("status").filter({ hasText: "Changed for you" });
  await expect(changed).toContainText("Lying knee drops instead of 90/90 hip switches, to go easy on your knees.");
  await expect(changed).toContainText("Standing hip-flexor stretch instead of half-kneeling hip-flexor stretch, to go easy on your knees.");
  await expect(changed).toContainText("Supported deep squat is left out, to go easy on your knees.");
  await expect(sheet.getByRole("button", { name: "Lying knee drops", exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "90/90 hip switches", exact: true })).toHaveCount(0);
  // A drill's guide opens from its name.
  await sheet.getByRole("button", { name: "Standing hip-flexor stretch", exact: true }).click();
  const guide = page.getByRole("dialog", { name: "Standing hip-flexor stretch" });
  await expect(guide).toContainText("In short:");
  await expect(guide.getByRole("heading", { name: "Each hold" })).toBeVisible();
});

test("a finished block asks what's next, and another round stays at the top level", async ({ page }) => {
  await page.clock.install({ time: MONDAY });
  const DAY = 86_400_000;
  const started = new Date("2026-08-24T07:00:00").getTime();
  const entry = (n: number, day: number) => ({
    id: `m-${n}`, routine: "hips", version: 1, level: 2, startedAt: started + day * DAY, finishedAt: started + day * DAY + 840_000, minutes: 14,
    drills: [{ id: "figure_four", plannedSec: 180, doneSec: 180 }], blockSession: n,
  });
  await restore(page, { mobility: { block: { routine: "hips", startedAt: started, done: 18 }, log: [entry(17, 38), entry(18, 40)] } });
  const today = page.getByRole("region", { name: "Hips: all 18 sessions done" });
  await expect(today).toContainText("That's the whole block.");
  await today.getByRole("button", { name: "Look back at the block" }).click();
  const review = page.getByRole("dialog", { name: "Looking back" });
  await expect(review).toContainText("Hips: mobility and strength: 2 sessions and 28 minutes over 6 weeks.");
  await expect(review.getByRole("button", { name: "Finish the block" })).toBeVisible();
  await review.getByRole("button", { name: "Go another 6 weeks" }).click();
  const again = page.getByRole("region", { name: "Hips: session 1 of 18" });
  await again.getByRole("button", { name: "Start hips session" }).click();
  await expect(page.getByText("Mobility · session 1 of 18 · level 3")).toBeVisible();
  // Nothing done: there's nothing to save, only to discard.
  await page.getByRole("button", { name: "End", exact: true }).click();
  const end = page.getByRole("dialog", { name: "End this session?" });
  await expect(end).toContainText("Nothing is done yet, so there's nothing to save.");
  await end.getByRole("button", { name: "Discard this session" }).click();
  await expect(again).toBeVisible();
});

test("the app says what stretching does and doesn't do, with its sources", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Plan" }).click();
  await page.getByRole("button", { name: "What stretching does, and what it doesn't" }).click();
  const facts = page.getByRole("dialog", { name: "What stretching does" });
  for (const heading of ["What it does", "What it doesn't", "What isn't settled", "When to take care"]) {
    await expect(facts.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
  await expect(facts).toContainText("Stretching regularly for several weeks improves flexibility.");
  await expect(facts).toContainText("It hasn't been shown to lower your overall risk of injury.");
  await expect(facts).toContainText("These sessions aren't treatment for an injury");
  const sources = facts.locator("details.sources");
  await sources.locator("summary").click();
  const links = sources.getByRole("link");
  expect(await links.count()).toBeGreaterThanOrEqual(15);
  await expect(sources.locator("summary")).toHaveText(`Sources (${await links.count()})`);
  for (const href of await links.evaluateAll((as) => as.map((a) => a.getAttribute("href")))) expect(href).toMatch(/^https:\/\//);
});
