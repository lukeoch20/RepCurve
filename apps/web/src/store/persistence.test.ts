import "fake-indexeddb/auto";
import { createStore, set, type UseStore } from "idb-keyval";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { newCore } from "../model/plan";
import { EMPTY_DATA, type AppData, type Core, type SessionRecord } from "../model/types";
import {
  claudePersistence,
  ConflictError,
  describeError,
  devicePersistence,
  isStorageFull,
  memoryPersistence,
  STORAGE_FULL,
  Writer,
  type DB,
} from "./persistence";

// ------------------------------------------------------------------ test doubles

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}
(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();

/** An in-memory stand-in for the claude.ai page database, with switchable failures. */
function fakeDb() {
  const docs = new Map<string, Record<string, unknown>>();
  const failing = { writes: 0, match: "" };
  const maybeFail = (path: string) => {
    if (failing.writes > 0 && path.includes(failing.match)) {
      failing.writes -= 1;
      throw new Error("network");
    }
  };
  const doc = (path: string) => ({
    async get() {
      const d = docs.get(path);
      return { exists: d !== undefined, data: () => (d ? (JSON.parse(JSON.stringify(d)) as Record<string, unknown>) : undefined) };
    },
    async set(data: Record<string, unknown>) {
      maybeFail(path);
      docs.set(path, JSON.parse(JSON.stringify(data)) as Record<string, unknown>);
    },
    async delete() {
      maybeFail(path);
      docs.delete(path);
    },
    collection: (name: string) => collection(`${path}/${name}`),
  });
  const collection = (prefix: string) => {
    const q = {
      where: () => q,
      orderBy: () => q,
      limit: () => q,
      async get() {
        const out = [...docs.entries()]
          .filter(([k]) => k.startsWith(`${prefix}/`) && !k.slice(prefix.length + 1).includes("/"))
          .map(([k, v]) => ({ id: k.slice(prefix.length + 1), exists: true, data: () => v }))
          .sort((a, b) => Number(a.data()["index"]) - Number(b.data()["index"]));
        return { docs: out };
      },
      doc: (id?: string) => doc(`${prefix}/${id ?? Math.random().toString(36).slice(2)}`),
    };
    return q;
  };
  const db = { doc, collection } as unknown as DB;
  return { db, docs, failing };
}

const profile = {
  sex: "male", age: 33, heightCm: 178, bodyweightKg: 84, trainingHistory: "never", goal: "both",
  daysPerWeek: 4, minutesPerSession: 20, injuries: [], units: "lb",
} as const;
const equipment = {
  dumbbells: { kind: "fixed", weights: [10, 15, 20, 25, 30], unit: "lb", pairs: true },
  treadmill: true, mat: true, abRoller: true, pullupBar: false, bench: false, bands: [],
} as const;
const baseCore = (): Core => newCore({ ...profile, injuries: [] }, { ...equipment, dumbbells: { ...equipment.dumbbells, weights: [10, 15, 20, 25, 30] }, bands: [] }, 0);

function record(index: number): SessionRecord {
  return {
    id: `s${index}`, index, kind: "strength", name: "Full body A", week: 1, startedAt: index, finishedAt: index,
    activeMinutes: 20, plan: { kind: "strength" } as SessionRecord["plan"], changes: [], cardio: null, deload: false, comeback: false, skipped: false,
    sets: [{ exerciseId: "goblet_squat", slot: "A.squat", setIndex: 0, loadKg: 9, reps: 10, rir: 2, at: 0 }],
  };
}

const instant = () => Promise.resolve();

beforeEach(() => {
  localStorage.clear();
});

// ------------------------------------------------------------------ RC-04

describe("RC-04: failed writes are retried, not dropped", () => {
  it("retries a failed session record on the next change and clears the error", async () => {
    const { db, docs, failing } = fakeDb();
    const p = claudePersistence(db, "u1", instant);
    const errors: (string | null)[] = [];
    p.onError((m) => errors.push(m));
    await p.load();
    failing.writes = 2;
    failing.match = "sessions/s0";
    p.saveRecord(record(0));
    await p.flush().catch(() => {});
    expect(errors.at(-1)).toMatch(/keeps retrying/);
    expect(docs.has("data/users/u1/core/sessions/s0")).toBe(false);
    // The next change (finishing another session) also retries the failed one.
    p.saveRecord(record(1));
    await p.flush();
    expect(docs.has("data/users/u1/core/sessions/s0")).toBe(true);
    expect(docs.has("data/users/u1/core/sessions/s1")).toBe(true);
    expect(errors.at(-1)).toBeNull();
  });

  it("keeps an unsaved record across a reload and sends it then", async () => {
    const { db, docs, failing } = fakeDb();
    const first = claudePersistence(db, "u1", instant);
    await first.load();
    failing.writes = 2;
    failing.match = "sessions/s0";
    first.saveRecord(record(0));
    await first.flush();
    expect(docs.has("data/users/u1/core/sessions/s0")).toBe(false);
    // The tab is closed and opened again.
    const second = claudePersistence(db, "u1", instant);
    const data = await second.load();
    expect(data.history.map((r) => r.id)).toEqual(["s0"]);
    await second.flush();
    expect(docs.has("data/users/u1/core/sessions/s0")).toBe(true);
  });

  it("retries on a timer when nothing else changes", async () => {
    vi.useFakeTimers();
    try {
      let attempts = 0;
      const reports: (string | null)[] = [];
      const w = new Writer((m) => reports.push(m), () => {}, instant);
      w.schedule("x", async () => {
        attempts += 1;
        if (attempts <= 2) throw new Error("offline");
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(attempts).toBe(2);
      expect(w.hasFailures()).toBe(true);
      await vi.advanceTimersByTimeAsync(16_000);
      expect(attempts).toBe(3);
      expect(w.hasFailures()).toBe(false);
      expect(reports.at(-1)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

// ------------------------------------------------------------------ RC-15

describe("RC-15: two devices on one account", () => {
  it("refuses a stale core write and asks the page to reload", async () => {
    const { db, docs } = fakeDb();
    const phone = claudePersistence(db, "u1", instant);
    const tablet = claudePersistence(db, "u1", instant);
    const core = baseCore();
    phone.saveCore(core);
    await phone.flush();
    await tablet.load();
    await phone.load();

    phone.saveCore({ ...core, nextIndex: 6 });
    await phone.flush();
    let conflicts = 0;
    tablet.onConflict(() => (conflicts += 1));
    expect(await tablet.changedElsewhere()).toBe(true);
    tablet.saveCore({ ...core, nextIndex: 9 });
    await tablet.flush();
    expect(conflicts).toBe(1);
    expect((docs.get("data/users/u1/core")!["core"] as Core).nextIndex).toBe(6);
    const reloaded = await tablet.load();
    expect(reloaded.core!.nextIndex).toBe(6);
    expect(await tablet.changedElsewhere()).toBe(false);
  });
});

// ------------------------------------------------------------------ RC-14

describe("RC-14: restore writes new data before removing old", () => {
  it("leaves the old history in place when a restore fails part-way", async () => {
    const { db, docs, failing } = fakeDb();
    const p = claudePersistence(db, "u1", instant);
    await p.load();
    p.saveCore(baseCore());
    p.saveRecord(record(0));
    p.saveRecord(record(1));
    await p.flush();
    failing.writes = 1;
    failing.match = "/active";
    const backup: AppData = { core: { ...baseCore(), nextIndex: 3 }, active: null, history: [record(5)] };
    await expect(p.replaceAll(backup)).rejects.toThrow();
    // Nothing was deleted, and core (written last) is unchanged.
    expect(docs.has("data/users/u1/core/sessions/s0")).toBe(true);
    expect((docs.get("data/users/u1/core")!["core"] as Core).nextIndex).toBe(0);
    await p.replaceAll(backup);
    const after = await p.load();
    expect(after.history.map((r) => r.id)).toEqual(["s5"]);
    expect(after.core!.nextIndex).toBe(3);
  });
});

// ------------------------------------------------------------------ RC-29

describe("RC-29: device storage keeps one key per session", () => {
  it("moves an old history array to per-record keys and saves records one by one", async () => {
    const store = createStore(`t-${Math.random()}`, "data");
    await set("history", [record(0), record(1)], store);
    await set("core", baseCore(), store);
    const p = devicePersistence(store);
    const data = await p.load();
    expect(data.history.map((r) => r.id)).toEqual(["s0", "s1"]);
    p.saveRecord(record(2));
    await p.flush();
    const again = await devicePersistence(store).load();
    expect(again.history.map((r) => r.id)).toEqual(["s0", "s1", "s2"]);
    expect(again.core?.nextIndex).toBe(0);
  });

  it("replaces everything in one transaction", async () => {
    const store = createStore(`t-${Math.random()}`, "data");
    const p = devicePersistence(store);
    p.saveRecord(record(0));
    await p.flush();
    await p.replaceAll({ core: baseCore(), active: null, history: [record(7)] });
    const data = await devicePersistence(store).load();
    expect(data.history.map((r) => r.id)).toEqual(["s7"]);
  });
});

// ------------------------------------------------------------------ two copies on one device

describe("two copies of the app on one device", () => {
  it("refuses a save from a copy that missed the other's latest, instead of rolling progress back", async () => {
    const store = createStore(`t-${Math.random()}`, "data");
    const first = devicePersistence(store);
    await first.load();
    first.saveCore(baseCore());
    await first.flush();
    // Two copies open with the same data.
    const tabA = devicePersistence(store);
    const tabB = devicePersistence(store);
    await tabA.load();
    await tabB.load();
    let conflicts = 0;
    tabA.onConflict(() => (conflicts += 1));
    // B finishes a session; A, still showing the old state, changes a setting.
    tabB.saveCore({ ...baseCore(), nextIndex: 1 });
    await tabB.flush();
    expect(await tabA.changedElsewhere()).toBe(true);
    tabA.saveCore({ ...baseCore(), settings: { ...baseCore().settings, restSec: 90 } });
    await tabA.flush();
    expect(conflicts).toBe(1);
    expect((await devicePersistence(store).load()).core!.nextIndex).toBe(1);
    // After reloading, A saves normally.
    const reloaded = await tabA.load();
    tabA.saveCore({ ...reloaded.core!, settings: { ...reloaded.core!.settings, restSec: 90 } });
    await tabA.flush();
    const final = (await devicePersistence(store).load()).core!;
    expect(final.nextIndex).toBe(1);
    expect(final.settings.restSec).toBe(90);
    expect(conflicts).toBe(1);
  });

  it("keeps saving as usual for data saved before revisions existed", async () => {
    const store = createStore(`t-${Math.random()}`, "data");
    await set("core", baseCore(), store);
    const p = devicePersistence(store);
    await p.load();
    p.saveCore({ ...baseCore(), nextIndex: 4 });
    await p.flush();
    expect((await devicePersistence(store).load()).core!.nextIndex).toBe(4);
    expect(await p.changedElsewhere()).toBe(false);
  });

  it("a restore in one copy makes the other's next save a conflict, not an overwrite", async () => {
    const store = createStore(`t-${Math.random()}`, "data");
    const tabA = devicePersistence(store);
    const tabB = devicePersistence(store);
    await tabA.load();
    await tabB.load();
    let conflicts = 0;
    const errors: (string | null)[] = [];
    tabB.onConflict(() => (conflicts += 1));
    tabB.onError((m) => errors.push(m));
    await tabA.replaceAll({ core: { ...baseCore(), nextIndex: 8 }, active: null, history: [record(7)] });
    expect(await tabA.changedElsewhere()).toBe(false);
    expect(await tabB.changedElsewhere()).toBe(true);
    tabB.saveCore(baseCore());
    await tabB.flush();
    expect(conflicts).toBe(1);
    // A conflict isn't a write failure: nothing to retry, no error shown.
    expect(errors).toEqual([]);
    const stored = await devicePersistence(store).load();
    expect(stored.core!.nextIndex).toBe(8);
    expect(stored.history.map((r) => r.id)).toEqual(["s7"]);
  });

  it("a reset leaves nothing behind", async () => {
    const store = createStore(`t-${Math.random()}`, "data");
    const p = devicePersistence(store);
    await p.load();
    p.saveCore(baseCore());
    p.saveRecord(record(0));
    await p.flush();
    await p.replaceAll(EMPTY_DATA);
    expect(await devicePersistence(store).load()).toEqual(EMPTY_DATA);
    // Saving again after a reset works without a conflict.
    let conflicts = 0;
    p.onConflict(() => (conflicts += 1));
    p.saveCore(baseCore());
    await p.flush();
    expect(conflicts).toBe(0);
    expect((await devicePersistence(store).load()).core).not.toBeNull();
  });
});

// ------------------------------------------------------------------ the write queue

describe("the write queue", () => {
  it("collapses a burst of changes into the latest and writes one document at a time", async () => {
    const written: number[] = [];
    let running = 0;
    let most = 0;
    const w = new Writer(() => {}, () => {}, instant);
    for (let i = 1; i <= 5; i++) {
      w.schedule("core", async () => {
        running += 1;
        most = Math.max(most, running);
        await new Promise((r) => setTimeout(r, 5));
        written.push(i);
        running -= 1;
      });
    }
    await w.flush();
    // The first was already under way; the rest collapse into the last.
    expect(written).toEqual([1, 5]);
    expect(most).toBe(1);
  });

  it("hands a conflict to the page once, without retrying or reporting a save error", async () => {
    let attempts = 0;
    let conflicts = 0;
    const reports: (string | null)[] = [];
    const w = new Writer((m) => reports.push(m), () => (conflicts += 1), instant);
    w.schedule("core", async () => {
      attempts += 1;
      throw new ConflictError();
    });
    await w.flush();
    expect(attempts).toBe(1);
    expect(conflicts).toBe(1);
    expect(reports).toEqual([]);
    expect(w.hasFailures()).toBe(false);
  });
});

// ------------------------------------------------------------------ L3: storage full

describe("L3: a full phone is named as such", () => {
  it("recognises quota errors from IndexedDB, localStorage, Firefox and Safari", () => {
    expect(isStorageFull(new DOMException("The quota has been exceeded.", "QuotaExceededError"))).toBe(true);
    expect(isStorageFull({ name: "NS_ERROR_DOM_QUOTA_REACHED", message: "Persistent storage maximum size reached" })).toBe(true);
    expect(isStorageFull(new DOMException("", "UnknownError"))).toBe(false);
    expect(isStorageFull(new DOMException("Database or disk is full", "UnknownError"))).toBe(true);
    // A failed IndexedDB transaction carries the quota error inside it.
    expect(isStorageFull({ name: "AbortError", error: new DOMException("", "QuotaExceededError") })).toBe(true);
    expect(isStorageFull(new Error("write failed", { cause: new DOMException("", "QuotaExceededError") }))).toBe(true);
    expect(isStorageFull(new Error("network"))).toBe(false);
    expect(isStorageFull(null)).toBe(false);
    expect(isStorageFull("QuotaExceededError")).toBe(false);
  });

  it("says the phone is out of space, and keeps the account-storage message for the account", () => {
    expect(describeError(new DOMException("", "QuotaExceededError"))).toBe(STORAGE_FULL);
    expect(STORAGE_FULL).toBe("Your phone is out of space for RepCurve's data. Save a backup, then free some space.");
    expect(describeError({ code: "quota_exceeded" })).toMatch(/Storage is full/);
    expect(describeError(new Error("network"))).toMatch(/keeps retrying/);
  });

  it("reports a full phone on a device save, and clears it once there's room again", async () => {
    // Only the retry timers: the stand-in IndexedDB runs its work on setImmediate.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const real = createStore(`t-${Math.random()}`, "data");
      const disk = { full: true };
      const store: UseStore = (mode, fn) =>
        mode === "readwrite" && disk.full ? Promise.reject(new DOMException("The quota has been exceeded.", "QuotaExceededError")) : real(mode, fn);
      const p = devicePersistence(store);
      const errors: (string | null)[] = [];
      p.onError((m) => errors.push(m));
      await p.load();
      p.saveRecord(record(0));
      await vi.advanceTimersByTimeAsync(2_000);
      expect(errors.at(-1)).toBe(STORAGE_FULL);
      // Space is freed; the queued write goes through on the next retry and the message clears.
      disk.full = false;
      await vi.advanceTimersByTimeAsync(16_000);
      await p.flush();
      expect(errors.at(-1)).toBeNull();
      expect((await devicePersistence(real).load()).history.map((r) => r.id)).toEqual(["s0"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects a restore that doesn't fit, leaving the old data in place", async () => {
    const real = createStore(`t-${Math.random()}`, "data");
    const before = devicePersistence(real);
    await before.load();
    before.saveCore(baseCore());
    await before.flush();
    const full: UseStore = (mode, fn) => (mode === "readwrite" ? Promise.reject(new DOMException("", "QuotaExceededError")) : real(mode, fn));
    const p = devicePersistence(full);
    await p.load();
    const failed = await p.replaceAll({ core: { ...baseCore(), nextIndex: 5 }, active: null, history: [record(1)] }).catch((e: unknown) => e);
    expect(isStorageFull(failed)).toBe(true);
    expect((await devicePersistence(real).load()).core!.nextIndex).toBe(0);
  });
});

// ------------------------------------------------------------------ nowhere

describe("memory only", () => {
  it("keeps this visit's data, says so, and never reports a conflict", async () => {
    const p = memoryPersistence();
    expect(p.warning).toMatch(/isn't letting RepCurve save/);
    p.saveCore(baseCore());
    p.saveRecord(record(0));
    p.saveRecord({ ...record(0), name: "Edited" });
    expect((await p.load()).history.map((r) => r.name)).toEqual(["Edited"]);
    await p.replaceAll(EMPTY_DATA);
    expect(await p.load()).toEqual(EMPTY_DATA);
    expect(await p.changedElsewhere()).toBe(false);
  });
});

// ------------------------------------------------------------------ account storage, more

describe("account storage", () => {
  it("a restore bumps the revision, so another device's stale save is refused", async () => {
    const { db, docs } = fakeDb();
    const phone = claudePersistence(db, "u1", instant);
    const tablet = claudePersistence(db, "u1", instant);
    await phone.load();
    phone.saveCore(baseCore());
    await phone.flush();
    await tablet.load();
    await phone.replaceAll({ core: { ...baseCore(), nextIndex: 4 }, active: null, history: [record(3)] });
    let conflicts = 0;
    tablet.onConflict(() => (conflicts += 1));
    tablet.saveCore({ ...baseCore(), nextIndex: 1 });
    await tablet.flush();
    expect(conflicts).toBe(1);
    expect((docs.get("data/users/u1/core")!["core"] as Core).nextIndex).toBe(4);
    // The refused change isn't re-sent on the next load.
    const again = claudePersistence(db, "u1", instant);
    expect((await again.load()).core!.nextIndex).toBe(4);
  });

  it("notices a session started on another device", async () => {
    const { db } = fakeDb();
    const phone = claudePersistence(db, "u1", instant);
    const tablet = claudePersistence(db, "u1", instant);
    await phone.load();
    await tablet.load();
    expect(await tablet.changedElsewhere()).toBe(false);
    phone.saveActive({ id: "a1" } as AppData["active"]);
    await phone.flush();
    expect(await tablet.changedElsewhere()).toBe(true);
  });
});
