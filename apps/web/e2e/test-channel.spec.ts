import { expect, test } from "@playwright/test";
import { onboard } from "./helpers";

// RepCurve is served at / and RepCurve Test at /test/ (as on GitHub Pages: /RepCurve/ and /RepCurve/test/).

test("RepCurve Test says what it is: name, strip and icons", async ({ page }) => {
  await page.goto("/test/");
  await expect(page).toHaveTitle("RepCurve Test");
  await expect(page.getByRole("note")).toContainText("RepCurve Test");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "./test-apple-touch-icon.png");
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute("content", "RepCurve Test");
  const manifest = await (await page.request.get("/test/manifest.webmanifest")).json();
  expect(manifest.name).toBe("RepCurve Test");
  expect(manifest.icons.map((i: { src: string }) => i.src).every((s: string) => s.startsWith("test-"))).toBe(true);
});

test("the real app shows no test markings", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("RepCurve");
  await expect(page.getByRole("note")).toHaveCount(0);
  const manifest = await (await page.request.get("/manifest.webmanifest")).json();
  expect(manifest.name).toBe("RepCurve");
});

test("the two apps keep separate data", async ({ page }) => {
  await onboard(page);
  await expect(page.getByText("Week 1 · session 1")).toBeVisible();
  await page.goto("/test/");
  // Set up in the real app, but the test app starts fresh.
  await expect(page.getByRole("button", { name: "Set up my plan" })).toBeVisible();
  // Only the apps' own databases: the offline worker may add its own (e.g. for the font cache).
  const dbs = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name ?? "").filter((n) => n.startsWith("repcurve")).sort());
  expect(dbs).toEqual(["repcurve", "repcurve-test"]);
  await page.goto("/");
  await expect(page.getByText("Week 1 · session 1")).toBeVisible();
});

test("the real app's offline worker never answers for the test app", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? "")).toMatch(/\/sw\.js$/);
  // Now controlled by the real app's worker, which covers /test/ too. It must let the test app through.
  await page.goto("/test/");
  await expect(page).toHaveTitle("RepCurve Test");
  await expect(page.getByRole("note")).toContainText("RepCurve Test");
  // And once the test app has its own worker, the real app is still itself.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.goto("/");
  await expect(page).toHaveTitle("RepCurve");
});
