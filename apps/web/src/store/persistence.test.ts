import "fake-indexeddb/auto";
import { createStore, set } from "idb-keyval";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { newCore } from "../model/plan";
import type { AppData, Core, SessionRecord } from "../model/types";
import { claudePersistence, devicePersistence, Writer, type DB } from "./persistence";

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
