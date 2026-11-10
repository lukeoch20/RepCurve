import { expect, test, type Page } from "@playwright/test";
import { onboard } from "./helpers";

// Exercises only a gym's equipment allows.
const GYM_LIFTS = /Leg press|Lat pulldown|Chest press|Cable|Barbell|Machine|Smith/;

const card = (page: Page) => page.getByRole("region", { name: "Training setup" });
const picker = (page: Page) => page.getByRole("dialog", { name: "Training setup" });
const choices = (page: Page) => picker(page).getByRole("group", { name: "Training setups" });

/** From Today: add a gym from the template, which comes back to Today with the picker open. */
async function addGymFromToday(page: Page) {
  await card(page).getByRole("button", { name: "Change training setup" }).click();
  await picker(page).getByRole("button", { name: "Add setup" }).click();
  await expect(page.getByRole("heading", { name: "Start from" })).toBeFocused();
  await page.getByRole("button", { name: /A typical gym/ }).click();
  await expect(page.getByLabel("Name")).toHaveValue("Gym");
  await expect(page.getByText(/Filled in for a typical gym/)).toBeVisible();
  await expect(page.getByLabel("Heaviest (lb)")).toHaveValue("100");
  await page.getByRole("button", { name: "Save setup" }).click();
}

test("a home-only user adds a gym from Today and uses it for one workout, which survives reloads", async ({ page }) => {
  await onboard(page);
  await expect(card(page)).toContainText("Home");
  await expect(card(page)).toContainText("Usual");
  await expect(card(page)).toContainText("Dumbbells 10–30 lb");
  await expect(page.getByRole("button", { name: GYM_LIFTS })).toHaveCount(0);

  await addGymFromToday(page);
  // Back on Today with the picker open; saving the new setup didn't pick it.
  await expect(picker(page)).toContainText("Saved Gym. Pick it to use it.");
  await expect(choices(page).getByRole("button", { name: /^Home/ })).toHaveAttribute("aria-pressed", "true");
  await choices(page).getByRole("button", { name: /^Gym/ }).click();
  await expect(choices(page).getByRole("button", { name: /^Gym/ })).toHaveAttribute("aria-pressed", "true");
  // "This workout" is the default; keeping it is the other choice.
  await expect(picker(page).getByRole("group", { name: "Use Gym for" }).getByRole("button", { name: "This workout" })).toHaveAttribute("aria-pressed", "true");
  await expect(picker(page)).toContainText("Next workout: Gym, then back to Home.");
  await picker(page).getByRole("button", { name: "Done" }).click();
  await expect(card(page).getByRole("button", { name: "Change training setup" })).toBeFocused();

  // The preview follows the gym's equipment, before starting.
  await expect(card(page)).toContainText("Gym");
  await expect(card(page)).toContainText("This workout");
  await expect(page.getByRole("button", { name: GYM_LIFTS }).first()).toBeVisible();

  await page.reload();
  await expect(card(page)).toContainText("This workout");
  await expect(page.getByRole("button", { name: GYM_LIFTS }).first()).toBeVisible();

  // The workout started with the gym keeps it through a reload.
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(page.getByText("Setup: Gym")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Setup: Gym")).toBeVisible();

  // Discarded: the one-workout choice goes with it, and the usual setup is back.
  await page.getByRole("button", { name: "End", exact: true }).click();
  await page.getByRole("button", { name: "Discard this session" }).click();
  await expect(card(page)).toContainText("Home");
  await expect(card(page)).toContainText("Usual");
  await expect(page.getByRole("button", { name: GYM_LIFTS })).toHaveCount(0);
});

test("a one-workout setup is used up by skipping that workout", async ({ page }) => {
  await onboard(page);
  await addGymFromToday(page);
  await choices(page).getByRole("button", { name: /^Gym/ }).click();
  await picker(page).getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("Week 1 · session 1")).toBeVisible();
  await page.getByRole("button", { name: "Skip this one" }).click();
  await page.getByRole("button", { name: "Skip it" }).click();
  await expect(page.getByText("Week 1 · session 2")).toBeVisible();
  await expect(card(page)).toContainText("Home");
  await expect(card(page)).toContainText("Usual");
});

test("a kept setup stays through workouts and reloads until you go back to usual", async ({ page }) => {
  await onboard(page);
  await addGymFromToday(page);
  await choices(page).getByRole("button", { name: /^Gym/ }).click();
  await picker(page).getByRole("group", { name: "Use Gym for" }).getByRole("button", { name: "Keep using this setup" }).click();
  await expect(picker(page)).toContainText("Home stays your usual setup.");
  await picker(page).getByRole("button", { name: "Done" }).click();
  await expect(card(page)).toContainText("Kept");

  await page.getByRole("button", { name: "Skip this one" }).click();
  await page.getByRole("button", { name: "Skip it" }).click();
  await expect(page.getByText("Week 1 · session 2")).toBeVisible();
  await page.reload();
  await expect(card(page)).toContainText("Gym");
  await expect(card(page)).toContainText("Kept");
  // The usual setup didn't change underneath.
  await card(page).getByRole("button", { name: "Change training setup" }).click();
  await expect(choices(page).getByRole("button", { name: /^Home/ })).toContainText("Usual");
  await picker(page).getByRole("button", { name: "Close" }).click();

  await card(page).getByRole("button", { name: "Back to usual (Home)" }).click();
  await expect(card(page)).toContainText("Home");
  await expect(card(page)).toContainText("Usual");
});

test("Bodyweight only needs nothing set up and plans no equipment", async ({ page }) => {
  await onboard(page);
  await card(page).getByRole("button", { name: "Change training setup" }).click();
  const bodyweight = choices(page).getByRole("button", { name: /^Bodyweight only/ });
  await expect(bodyweight).toContainText("No equipment needed");
  await bodyweight.click();
  await picker(page).getByRole("button", { name: "Done" }).click();
  await expect(card(page)).toContainText("Bodyweight only");
  await expect(card(page)).toContainText("No equipment needed");
  await expect(page.locator(".lineup .dose").first()).toBeVisible();
  await expect(page.locator(".lineup .dose").filter({ hasText: / lb/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Start session" }).click();
  await expect(page.getByText("Setup: Bodyweight only")).toBeVisible();
});

test("Settings manages setups: edit, rename, duplicate, make usual, and delete with a safe fallback", async ({ page }) => {
  await onboard(page);
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Manage training setups" }).click();
  await expect(page.getByRole("heading", { name: "Training setups", level: 1 })).toBeFocused();
  const home = page.getByRole("region", { name: "Home", exact: true });
  await expect(home).toContainText("Usual");

  // Equipment opens straight in the editor; cancelling changes nothing, saving does.
  await home.getByRole("button", { name: "Edit equipment" }).click();
  await page.getByRole("switch", { name: /Pull-up bar/ }).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(home).not.toContainText("pull-up bar");
  await home.getByRole("button", { name: "Edit equipment" }).click();
  await page.getByRole("switch", { name: /Pull-up bar/ }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(home).toContainText("pull-up bar");

  await home.getByRole("button", { name: "Rename" }).click();
  await page.getByLabel("New name").fill("Apartment");
  await page.getByRole("button", { name: "Save name" }).click();
  const apartment = page.getByRole("region", { name: "Apartment", exact: true });
  await expect(apartment).toContainText("Usual");

  await apartment.getByRole("button", { name: "Duplicate" }).click();
  const copy = page.getByRole("region", { name: "Apartment copy", exact: true });
  await expect(copy).toContainText("pull-up bar");
  await copy.getByRole("button", { name: "Make usual" }).click();
  await expect(copy).toContainText("Usual");
  await expect(apartment).not.toContainText("Usual");

  // Deleting the usual setup says what takes its place first.
  await copy.getByRole("button", { name: "Delete" }).click();
  await expect(copy).toContainText("Apartment becomes your usual setup.");
  await copy.getByRole("button", { name: "Keep it" }).click();
  await expect(copy.getByRole("button", { name: "Delete" })).toBeFocused();
  await copy.getByRole("button", { name: "Delete" }).click();
  await copy.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(copy).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Deleted Apartment copy");
  await expect(apartment).toContainText("Usual");

  // Bodyweight only can be the usual setup too.
  const bodyweight = page.getByRole("region", { name: "Bodyweight only" });
  await bodyweight.getByRole("button", { name: "Make usual" }).click();
  await expect(bodyweight).toContainText("Usual");

  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("heading", { name: "Make it yours" })).toBeVisible();
  await page.getByRole("button", { name: "Today" }).click();
  await expect(card(page)).toContainText("Bodyweight only");
  await expect(card(page)).toContainText("Usual");
});
