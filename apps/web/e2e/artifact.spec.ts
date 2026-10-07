import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

// Serves the claude.ai build the way the Artifact publisher would (wrapped in a document), with a stand-in
// for the claude.ai runtime whose database persists in localStorage. The page must need no third-party scripts.
const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(resolve(here, "../artifact/repcurve.html"), "utf8");
const doc = `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${page}</body></html>`;

function fakeClaude() {
  const KEY = "fake-claude-db";
  const load = (): Record<string, Record<string, unknown>> => JSON.parse(localStorage.getItem(KEY) ?? "{}");
  const save = (s: Record<string, Record<string, unknown>>) => localStorage.setItem(KEY, JSON.stringify(s));
  const snap = (path: string) => {
    const data = load()[path];
    return { id: path.split("/").pop(), exists: data !== undefined, data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined) };
  };
  const docRef = (path: string): unknown => ({
    path,
    get: async () => snap(path),
    set: async (d: Record<string, unknown>) => { const s = load(); s[path] = d; save(s); },
    delete: async () => { const s = load(); delete s[path]; save(s); },
    collection: (sub: string) => coll(`${path}/${sub}`),
  });
  const coll = (path: string) => {
    const q = (filters: [string, string, unknown][], order: string | null, lim: number): unknown => ({
      where: (f: string, op: string, v: unknown) => q([...filters, [f, op, v]], order, lim),
      orderBy: (f: string) => q(filters, f, lim),
      limit: (n: number) => q(filters, order, n),
      doc: (id: string) => docRef(`${path}/${id}`),
      get: async () => {
        const s = load();
        let docs = Object.keys(s)
          .filter((k) => k.startsWith(`${path}/`) && !k.slice(path.length + 1).includes("/"))
          .map((k) => snap(k));
        for (const [f, op, v] of filters) docs = docs.filter((d) => (op === ">" ? (d.data() as Record<string, number>)[f]! > (v as number) : true));
        if (order) docs.sort((a, b) => (a.data() as Record<string, number>)[order]! - (b.data() as Record<string, number>)[order]!);
        return { docs: docs.slice(0, lim) };
      },
    });
    return q([], null, 1000);
  };
  const db = { doc: docRef, collection: coll };
  const user = { id: async () => "u_test" };
  (window as unknown as { claude: unknown }).claude = {
    use: async (name: string) => (name === "db" ? db : name === "user" ? user : null),
  };
}

test.beforeEach(async ({ page: p }) => {
  // Any script from elsewhere would mean the page trusts a third party with the user's data (RC-35).
  await p.route("**/*.js", (route) => (route.request().url().startsWith("http://artifact.test/") ? route.continue() : route.abort()));
  await p.route("https://fonts.googleapis.com/**", (route) => route.fulfill({ contentType: "text/css", body: "" }));
  await p.route("http://artifact.test/**", (route) => route.fulfill({ contentType: "text/html", body: doc }));
  await p.addInitScript(fakeClaude);
});

test("the claude.ai page loads no third-party scripts", () => {
  expect(page).not.toMatch(/<script[^>]+src=/i);
});

test("the claude.ai page saves to the account database and survives a reload", async ({ page: p }) => {
  await p.goto("http://artifact.test/");
  await p.getByRole("button", { name: "Set up my plan" }).click();
  await p.getByRole("group", { name: "Sex" }).getByRole("button", { name: "Female", exact: true }).click();
  await p.getByRole("group", { name: "Units" }).getByRole("button", { name: "kg · cm" }).click();
  await p.getByLabel("Age").fill("38");
  await p.getByLabel("Weight (kg)").fill("70");
  await p.getByLabel("Height (cm)").fill("168");
  await p.getByRole("button", { name: "Next" }).click();
  await p.getByRole("button", { name: /A little/ }).click();
  await p.getByRole("button", { name: "Next" }).click();
  await p.getByRole("button", { name: "Next" }).click();
  await p.getByRole("group", { name: "Dumbbells" }).getByRole("button", { name: "None" }).click();
  await p.getByRole("button", { name: "Next" }).click();
  await p.getByRole("button", { name: "Next" }).click();
  await p.getByRole("button", { name: "Start training" }).click();
  await p.getByRole("button", { name: "Start session" }).click();
  await p.getByRole("button", { name: "Done · set 1" }).first().click();
  await expect(p.getByRole("timer")).toBeVisible();

  await p.reload();
  // Mid-session state comes back from the database: still in the session with one set logged.
  await expect(p.getByText(/^1 of \d+ sets$/)).toBeVisible();
  const stored = await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("fake-claude-db") ?? "{}")));
  expect(stored).toEqual(expect.arrayContaining(["data/users/u_test/core", "data/users/u_test/active"]));

  await p.getByRole("button", { name: "End" }).click();
  await p.getByRole("button", { name: "Finish and save" }).click();
  await p.getByRole("button", { name: "Done" }).click();
  await p.reload();
  await expect(p.getByText("Week 1 · session 2")).toBeVisible();
  const after = await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("fake-claude-db") ?? "{}")));
  expect(after.some((k) => k.startsWith("data/users/u_test/core/sessions/"))).toBe(true);
  expect(after).not.toContain("data/users/u_test/active");
});
