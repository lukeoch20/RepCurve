/**
 * RepCurve's small backend (Supabase, see supabase/schema.sql): usernames and feedback, nothing
 * else. Its address and public key come from the build (VITE_SUPABASE_URL, VITE_SUPABASE_KEY);
 * without them, and in the claude.ai page, there's no backend and the app works as before.
 */
import type { Account } from "../model/types";

declare const __RUNTIME__: "pwa" | "artifact";

interface Config {
  url: string;
  key: string;
}

function config(): Config | null {
  // End-to-end tests point the app at a stand-in.
  const stand = (globalThis as { __REPCURVE_BACKEND__?: Config }).__REPCURVE_BACKEND__;
  if (stand) return stand;
  if ((typeof __RUNTIME__ === "undefined" ? "artifact" : __RUNTIME__) === "artifact") return null;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_KEY;
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}

/** Whether this build has a backend to send usernames and feedback to. */
export const hasBackend = (): boolean => config() !== null;

/** Why a call didn't get an answer: no connection, or the server didn't reply as expected. */
export type Unreached = "offline" | "unavailable";
export type Reply<T extends string> = { ok: true; value: T } | { ok: false; error: Unreached };

const TIMEOUT_MS = 10_000;

async function rpc<T extends string>(name: string, args: Record<string, unknown>, answers: readonly T[]): Promise<Reply<T>> {
  const c = config();
  if (!c) return { ok: false, error: "unavailable" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${c.url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: c.key,
        // The older keys are tokens and go here too; the newer publishable keys don't.
        ...(c.key.startsWith("eyJ") ? { Authorization: `Bearer ${c.key}` } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      signal: controller.signal,
    });
    const value: unknown = res.ok ? await res.json() : null;
    return answers.includes(value as T) ? { ok: true, value: value as T } : { ok: false, error: "unavailable" };
  } catch {
    return { ok: false, error: typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------- usernames

/** 3 to 20 letters, numbers or underscores. Keep in step with username_problem in schema.sql. */
export const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
const RESERVED = new Set(["admin", "administrator", "repcurve", "repcurve_team", "support", "help", "moderator", "mod", "root", "system", "official", "staff", "team", "coach"]);

/** What's wrong with a name before asking the server, or null. */
export function usernameProblem(name: string): "invalid" | "reserved" | null {
  if (!USERNAME_RE.test(name)) return "invalid";
  return RESERVED.has(name.toLowerCase()) ? "reserved" : null;
}

export type UsernameStatus = "available" | "taken" | "invalid" | "reserved";

export function usernameStatus(name: string, userId?: string): Promise<Reply<UsernameStatus>> {
  return rpc("username_status", { p_name: name, p_user: userId ?? null }, ["available", "taken", "invalid", "reserved"] as const);
}

export type ClaimResult = "ok" | "taken" | "invalid" | "reserved" | "forbidden" | "busy";

/** Claim a username for this identity, or rename it. */
export function claimUsername(id: Identity, name: string): Promise<Reply<ClaimResult>> {
  return rpc("claim_username", { p_user: id.userId, p_secret: id.secret, p_name: name }, ["ok", "taken", "invalid", "reserved", "forbidden", "busy"] as const);
}

/** Free the username and unlink the person's feedback from it. */
export function deleteAccount(id: Identity): Promise<Reply<"ok" | "forbidden">> {
  return rpc("delete_account", { p_user: id.userId, p_secret: id.secret }, ["ok", "forbidden"] as const);
}

/** Who someone is to the server: a random id and a secret, both made on their device. */
export type Identity = Pick<Account, "userId" | "secret">;

export function newIdentity(): Identity {
  const bytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));
  const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  const u = bytes(16);
  // A version 4 UUID, as crypto.randomUUID makes (which needs a secure page).
  u[6] = (u[6]! & 0x0f) | 0x40;
  u[8] = (u[8]! & 0x3f) | 0x80;
  const h = hex(u);
  return { userId: `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`, secret: hex(bytes(32)) };
}

// ---------------------------------------------------------------- feedback

export const FEEDBACK_MAX = 4000;

/** Send feedback, filed under the person's username when they have one. */
export function sendFeedback(account: Account | null, message: string, meta: Record<string, string | number | boolean>): Promise<Reply<"ok" | "invalid" | "busy">> {
  return rpc(
    "send_feedback",
    { p_user: account?.userId ?? null, p_secret: account?.secret ?? null, p_message: message.slice(0, FEEDBACK_MAX), p_meta: meta },
    ["ok", "invalid", "busy"] as const,
  );
}
