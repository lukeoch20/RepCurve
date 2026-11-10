import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { claimUsername, deleteAccount, hasBackend, newIdentity, sendFeedback, usernameProblem, usernameStatus } from "./backend";

const stand = (key = "eyJtest") => {
  (globalThis as { __REPCURVE_BACKEND__?: unknown }).__REPCURVE_BACKEND__ = { url: "https://example.supabase.co", key };
};
const reply = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
const id = { userId: "11111111-1111-4111-8111-111111111111", secret: "a".repeat(64) };

beforeEach(() => {
  delete (globalThis as { __REPCURVE_BACKEND__?: unknown }).__REPCURVE_BACKEND__;
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("backend: usernames and feedback", () => {
  it("does nothing without a backend: no requests, nothing to show", async () => {
    const fetch = reply("ok");
    vi.stubGlobal("fetch", fetch);
    expect(hasBackend()).toBe(false);
    expect(await claimUsername(id, "luke")).toEqual({ ok: false, error: "unavailable" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("calls the database functions with the public key", async () => {
    stand();
    const fetch = reply("ok");
    vi.stubGlobal("fetch", fetch);
    expect(hasBackend()).toBe(true);
    expect(await claimUsername(id, "Luke_O")).toEqual({ ok: true, value: "ok" });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://example.supabase.co/rest/v1/rpc/claim_username");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ apikey: "eyJtest", Authorization: "Bearer eyJtest" });
    expect(JSON.parse(init.body as string)).toEqual({ p_user: id.userId, p_secret: id.secret, p_name: "Luke_O" });
  });

  it("sends a newer publishable key without an Authorization header", async () => {
    stand("sb_publishable_abc");
    const fetch = reply("available");
    vi.stubGlobal("fetch", fetch);
    expect(await usernameStatus("luke")).toEqual({ ok: true, value: "available" });
    const init = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.headers).toEqual({ apikey: "sb_publishable_abc", "Content-Type": "application/json" });
  });

  it("treats an unexpected answer, an error status or a failed request as not reached", async () => {
    stand();
    vi.stubGlobal("fetch", reply("maybe"));
    expect(await deleteAccount(id)).toEqual({ ok: false, error: "unavailable" });
    vi.stubGlobal("fetch", reply({ message: "boom" }, 500));
    expect(await sendFeedback(null, "hi", {})).toEqual({ ok: false, error: "unavailable" });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    vi.stubGlobal("navigator", { onLine: false });
    expect(await usernameStatus("luke")).toEqual({ ok: false, error: "offline" });
  });

  it("files feedback under the account, and trims it to the limit", async () => {
    stand();
    const fetch = reply("ok");
    vi.stubGlobal("fetch", fetch);
    await sendFeedback({ ...id, username: "luke" }, "x".repeat(5000), { build: "abc" });
    const body = JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({ p_user: id.userId, p_secret: id.secret, p_meta: { build: "abc" } });
    expect(body.p_message).toHaveLength(4000);
  });

  it("checks names as the server does", () => {
    expect(usernameProblem("Luke_O")).toBeNull();
    expect(usernameProblem("lu")).toBe("invalid");
    expect(usernameProblem("luke o")).toBe("invalid");
    expect(usernameProblem("x".repeat(21))).toBe("invalid");
    expect(usernameProblem("émile")).toBe("invalid");
    expect(usernameProblem("ADMIN")).toBe("reserved");
  });

  it("makes a random version 4 id and a long secret for each new person", () => {
    const a = newIdentity();
    const b = newIdentity();
    expect(a.userId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a.secret).toMatch(/^[0-9a-f]{64}$/);
    expect(a.userId).not.toBe(b.userId);
    expect(a.secret).not.toBe(b.secret);
  });
});
