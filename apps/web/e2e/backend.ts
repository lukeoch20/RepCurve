import type { Page, Route } from "@playwright/test";

/**
 * A stand-in for RepCurve's backend (supabase/schema.sql), answering the app's calls from memory
 * the way the database functions do. `down` makes every call fail, as with no connection to it.
 */
export interface FakeBackend {
  accounts: Map<string, { username: string; secret: string }>;
  feedback: { username: string | null; message: string; meta: Record<string, unknown> }[];
  down: boolean;
}

const URL = "https://backend.test";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, OPTIONS" };

export async function fakeBackend(page: Page, opts: { taken?: string[]; down?: boolean } = {}): Promise<FakeBackend> {
  const db: FakeBackend = { accounts: new Map(), feedback: [], down: opts.down ?? false };
  (opts.taken ?? []).forEach((name, i) => db.accounts.set(`taken-${i}`, { username: name, secret: "x".repeat(64) }));
  await page.addInitScript((url) => {
    (window as unknown as { __REPCURVE_BACKEND__: unknown }).__REPCURVE_BACKEND__ = { url, key: "eyJ-test-key" };
  }, URL);
  await page.route(`${URL}/rest/v1/rpc/*`, async (route: Route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (db.down) return route.abort("connectionrefused");
    const name = route.request().url().split("/").pop();
    const a = route.request().postDataJSON() as Record<string, string | null>;
    const takenBy = (n: string, user: string | null) => [...db.accounts].some(([id, x]) => x.username.toLowerCase() === n.toLowerCase() && id !== user);
    const valid = (n: string) => /^[A-Za-z0-9_]{3,20}$/.test(n);
    let out: string;
    if (name === "username_status") out = !valid(a["p_name"]!) ? "invalid" : takenBy(a["p_name"]!, a["p_user"] ?? null) ? "taken" : "available";
    else if (name === "claim_username") {
      const mine = db.accounts.get(a["p_user"]!);
      if (!valid(a["p_name"]!)) out = "invalid";
      else if (mine && mine.secret !== a["p_secret"]) out = "forbidden";
      else if (takenBy(a["p_name"]!, a["p_user"]!)) out = "taken";
      else {
        db.accounts.set(a["p_user"]!, { username: a["p_name"]!, secret: a["p_secret"]! });
        out = "ok";
      }
    } else if (name === "send_feedback") {
      const who = a["p_user"] ? db.accounts.get(a["p_user"]) : undefined;
      db.feedback.push({ username: who && who.secret === a["p_secret"] ? who.username : null, message: String(a["p_message"]).trim(), meta: a["p_meta"] as unknown as Record<string, unknown> });
      out = "ok";
    } else if (name === "delete_account") {
      db.accounts.delete(a["p_user"]!);
      out = "ok";
    } else return route.fulfill({ status: 404, headers: CORS, body: "{}" });
    await route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(out) });
  });
  return db;
}
