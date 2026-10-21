import { expect, test, type Page } from "@playwright/test";
import { onboard } from "./helpers";

const FAMILIES = ["Inter", "Newsreader", "Archivo Narrow", "Cinzel", "Manrope", "Bodoni Moda", "Hanken Grotesk"];

/** Loads each family from the page's own fonts; true when it has a face for it and the face is ready. */
async function fontsReady(page: Page): Promise<Record<string, boolean>> {
  return page.evaluate(async (families) => {
    const out: Record<string, boolean> = {};
    for (const f of families) {
      const faces = await document.fonts.load(`16px "${f}"`);
      out[f] = faces.length > 0 && document.fonts.check(`16px "${f}"`);
    }
    return out;
  }, FAMILIES);
}

test("fonts come with the app: every family loads and no other site is asked for anything", async ({ page, baseURL }) => {
  const elsewhere: string[] = [];
  page.on("request", (r) => {
    if (!r.url().startsWith(baseURL!) && !r.url().startsWith("data:")) elsewhere.push(r.url());
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Set up my plan" })).toBeVisible();
  expect(await fontsReady(page)).toEqual(Object.fromEntries(FAMILIES.map((f) => [f, true])));
  // The offline worker keeps every font, so each style looks right with no connection.
  const sw = await (await page.request.get("sw.js")).text();
  for (const f of ["inter", "newsreader", "archivo-narrow", "cinzel", "manrope", "bodoni-moda", "hanken-grotesk"]) expect(sw).toContain(`${f}-latin-`);
  expect(elsewhere).toEqual([]);
});

test("the first screen leads with what RepCurve does and the way in, then how to install", async ({ page }) => {
  await page.goto("/");
  const promise = page.getByRole("heading", { level: 1 });
  const start = page.getByRole("button", { name: "Set up my plan" });
  const install = page.getByRole("region", { name: "Install RepCurve" });
  await expect(install).toBeVisible();
  const y = async (l: ReturnType<Page["getByRole"]>) => (await l.boundingBox())!.y;
  expect(await y(promise)).toBeLessThan(await y(start));
  expect(await y(start)).toBeLessThan(await y(install));
  // The way in is on screen without scrolling.
  await expect(start).toBeInViewport();
});

test("the privacy note opens from the first screen and from Settings", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Privacy", exact: true }).click();
  const note = page.getByRole("dialog", { name: "Privacy" });
  await expect(note).toContainText("No account, no analytics, no ads");
  await expect(note).toContainText("sex, age, height and body weight");
  await expect(note).toContainText("On this device");
  await expect(note).toContainText("Reset all data");
  await note.getByRole("button", { name: "Close" }).click();
  await expect(note).toHaveCount(0);

  await onboard(page);
  await page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "What RepCurve keeps" }).click();
  await expect(page.getByRole("dialog", { name: "Privacy" })).toContainText("Backups");
});

test("an hour-long plan: 60 minutes can be picked, and the plan's summary comes first with the rest behind a disclosure", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Set up my plan" }).click();
  await page.getByRole("group", { name: "Sex" }).getByRole("button", { name: "Female", exact: true }).click();
  await page.getByRole("group", { name: "Units" }).getByRole("button", { name: "kg · cm" }).click();
  await page.getByLabel("Age").fill("38");
  await page.getByLabel("Weight (kg)").fill("70");
  await page.getByLabel("Height (cm)").fill("168");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: /I train regularly/ }).click();
  await page.getByRole("group", { name: "Main aim" }).getByRole("button", { name: /^Lose fat/ }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("group", { name: "Days a week" }).getByRole("button", { name: "3", exact: true }).click();
  await page.getByRole("group", { name: "Minutes per session" }).getByRole("button", { name: "60", exact: true }).click();
  await expect(page.getByText("180 minutes")).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("group", { name: "Dumbbells" }).getByRole("button", { name: "None" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toContainText("60 minutes");
  const minutes = Number((await page.getByText(/^~\d+ min$/).textContent())!.match(/\d+/)![0]);
  expect(minutes).toBeLessThanOrEqual(63);
  const more = page.getByRole("button", { name: "How this plan works" });
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText(/^You train 3 days a week for about 60 minutes/)).toBeVisible();
  await expect(page.getByText(/^Progress is automatic/)).toBeHidden();
  await more.click();
  await expect(more).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText(/^Progress is automatic/)).toBeVisible();
  await page.getByRole("button", { name: "Start training" }).click();

  // The Plan tab gives the same summary, with the same disclosure.
  await page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "Plan" }).click();
  const planMore = page.getByRole("button", { name: "How this plan works" });
  await expect(planMore).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText(/^Progress is automatic/)).toBeHidden();
  await planMore.click();
  await expect(page.getByText(/^Progress is automatic/)).toBeVisible();
});
