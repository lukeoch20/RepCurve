import { expect, test } from "@playwright/test";
import { fakeBackend } from "./backend";
import { onboard } from "./helpers";

// Requests to the stand-in backend come from the page, not the offline worker.
test.use({ serviceWorkers: "block" });

test("a new person picks a unique username while setting up, can change it, and sends feedback under it", async ({ page }) => {
  const db = await fakeBackend(page, { taken: ["Taken_One"] });
  await page.goto("/");
  await page.getByRole("button", { name: "Set up my plan" }).click();
  const username = page.getByLabel("Username");
  // Taken whatever the capitals; not a valid name with a space.
  await username.fill("taken_one");
  await expect(page.getByText("Taken. Try another.")).toBeVisible();
  await username.fill("luke o");
  await expect(page.getByText(/no spaces/)).toBeVisible();
  await expect(username).toHaveAttribute("aria-invalid", "true");
  await username.fill("Luke_O");
  await expect(page.getByText("Available.")).toBeVisible();
  await page.goto("about:blank");

  // The whole setup, with the name claimed on the way.
  await onboard(page, "/", { username: "Luke_O" });
  expect([...db.accounts.values()].map((a) => a.username)).toContain("Luke_O");
  await expect(page.getByRole("region", { name: "Pick a username" })).toHaveCount(0);

  await page.getByRole("button", { name: "Settings" }).click();
  const card = page.getByRole("region", { name: "Username" });
  await expect(card).toContainText("Luke_O");
  await card.getByRole("button", { name: "Change username" }).click();
  await card.getByLabel("New username").fill("Taken_One");
  await expect(card.getByText("Taken. Try another.")).toBeVisible();
  await expect(card.getByRole("button", { name: "Save" })).toBeDisabled();
  await card.getByLabel("New username").fill("LukeLifts");
  await expect(card.getByText("Available.")).toBeVisible();
  await card.getByRole("button", { name: "Save" }).click();
  await expect(card).toContainText("Username saved.");
  await expect(card).toContainText("LukeLifts");
  expect([...db.accounts.values()].map((a) => a.username)).toEqual(["Taken_One", "LukeLifts"]);

  // Feedback goes in under the username, with what's needed to follow it up.
  const feedback = page.getByRole("region", { name: "Send feedback" });
  await expect(feedback).toContainText("Sent as LukeLifts");
  await feedback.getByLabel(/What's working/).fill("  The setup picker is great  ");
  await feedback.getByRole("button", { name: "Send feedback" }).click();
  await expect(feedback).toContainText("Thanks! Your feedback was sent.");
  await expect(feedback.getByLabel(/What's working/)).toHaveValue("");
  expect(db.feedback).toHaveLength(1);
  // The build is the commit's short hash in CI, "dev" in a local build.
  expect(db.feedback[0]).toMatchObject({ username: "LukeLifts", message: "The setup picker is great", meta: { channel: "main", workouts: 0, build: expect.stringMatching(/^(dev|[0-9a-f]{7})$/) } });

  // The privacy note says what goes to the server.
  await page.getByRole("button", { name: "What RepCurve keeps" }).click();
  await expect(page.getByRole("dialog")).toContainText("RepCurve's server only gets your username and any feedback you send");
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();

  // Starting over lets the name go.
  await page.getByRole("button", { name: "Reset all data" }).click();
  await page.getByRole("button", { name: "Delete everything" }).click();
  await expect(page.getByRole("button", { name: "Set up my plan" })).toBeVisible();
  expect([...db.accounts.values()].map((a) => a.username)).toEqual(["Taken_One"]);
});

test("when the server can't be reached, setup carries on and Today asks for a username later", async ({ page }) => {
  const db = await fakeBackend(page, { down: true });
  // With the server unreachable the name can't be checked or saved, and setup goes on without it.
  await onboard(page, "/", { username: "Sam", nameStatus: /Can't reach RepCurve's server/ });
  await expect(page.getByRole("heading", { name: "Push day" })).toBeVisible();
  expect(db.accounts.size).toBe(0);
  const card = page.getByRole("region", { name: "Pick a username" });
  await expect(card).toBeVisible();
  await card.getByLabel("Username").fill("Sam");
  await expect(card.getByText(/Can't reach RepCurve's server/)).toBeVisible();

  db.down = false;
  await card.getByLabel("Username").fill("Sam_");
  await expect(card.getByText("Available.")).toBeVisible();
  await card.getByRole("button", { name: "Save username" }).click();
  await expect(page.getByText("You're Sam_. Change it any time in Settings.")).toBeVisible();
  expect([...db.accounts.values()].map((a) => a.username)).toEqual(["Sam_"]);
});

test("without a backend there's no username or feedback, and the privacy note is unchanged", async ({ page }) => {
  await onboard(page);
  await expect(page.getByRole("region", { name: "Pick a username" })).toHaveCount(0);
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("region", { name: "Username" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Send feedback" })).toHaveCount(0);
});
