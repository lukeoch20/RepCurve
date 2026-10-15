import { beforeEach, describe, expect, it } from "vitest";
import { clearCrashLog, crashLog, crashLogText, CRASH_LOG_MAX, logCrash } from "./crashLog";

class MemoryStorage {
  m = new Map<string, string>();
  full = false;
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.full) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}
const storage = new MemoryStorage();
(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = storage;

beforeEach(() => {
  storage.clear();
  storage.full = false;
});

describe("L3: the error log on the device", () => {
  it("keeps the time, where, message and a trimmed stack, under the app's storage name", () => {
    const e = new Error("Unknown exercise: gone_lift");
    e.stack = `Error: Unknown exercise\n${"    at somewhere (app.js:1:1)\n".repeat(200)}`;
    logCrash("action: start", e, 1234);
    const [entry] = crashLog();
    expect(entry).toMatchObject({ at: 1234, where: "action: start", message: "Error: Unknown exercise: gone_lift" });
    expect(entry!.stack!.length).toBeLessThanOrEqual(1024);
    expect([...storage.m.keys()]).toEqual(["repcurve.crashes"]);
  });

  it("keeps only the last 20, oldest first", () => {
    for (let i = 0; i < 25; i++) logCrash("showing a screen", new Error(`e${i}`), i);
    const log = crashLog();
    expect(log).toHaveLength(CRASH_LOG_MAX);
    expect(log[0]!.message).toBe("Error: e5");
    expect(log.at(-1)!.message).toBe("Error: e24");
  });

  it("logs things thrown that aren't errors", () => {
    logCrash("action: log", "plain string", 1);
    logCrash("action: log", { code: 7 }, 2);
    logCrash("action: log", null, 3);
    expect(crashLog().map((e) => e.message)).toEqual(["plain string", '{"code":7}', "null"]);
  });

  it("never throws, even when storage is full or the log is garbage", () => {
    storage.m.set("repcurve.crashes", "{not json");
    expect(crashLog()).toEqual([]);
    storage.m.set("repcurve.crashes", JSON.stringify([{ at: 1, message: "ok", where: "x" }, "junk", { at: "x" }]));
    expect(crashLog()).toHaveLength(1);
    storage.full = true;
    expect(() => logCrash("action: finish", new Error("boom"))).not.toThrow();
  });

  it("copies as plain text, and clears", () => {
    logCrash("action: finish", new Error("boom"), Date.UTC(2026, 9, 15, 9));
    const text = crashLogText();
    expect(text).toContain("RepCurve error log");
    expect(text).toContain("2026-10-15T09:00:00.000Z  action: finish");
    expect(text).toContain("Error: boom");
    clearCrashLog();
    expect(crashLog()).toEqual([]);
    expect(crashLogText()).toContain("No errors recorded.");
  });
});
