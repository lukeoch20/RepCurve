import { createStore, del, get, set, type UseStore } from "idb-keyval";
import { useCapability } from "../platform/runtime";
import { EMPTY_DATA, type ActiveSession, type AppData, type Core, type SessionRecord } from "../model/types";

export type StorageKind = "claude" | "device" | "memory";

export interface Persistence {
  kind: StorageKind;
  load(): Promise<AppData>;
  saveCore(core: Core | null): void;
  saveActive(active: ActiveSession | null): void;
  saveRecord(record: SessionRecord): void;
  /** Replace everything (import or reset). Resolves once written. */
  replaceAll(data: AppData): Promise<void>;
  /** Resolves when every queued write has been attempted. */
  flush(): Promise<void>;
  /** Called with a short message when a write fails. */
  onError(fn: (message: string) => void): void;
}

/** Strip undefined and functions so documents are plain JSON. */
const plain = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/**
 * One writer per document: writes run one at a time, and a burst of updates
 * collapses into the latest value.
 */
class Writer {
  private queues = new Map<string, { pending: (() => Promise<void>) | null; running: Promise<void> | null }>();
  constructor(private report: (message: string) => void) {}

  schedule(key: string, op: () => Promise<void>): void {
    const q = this.queues.get(key) ?? { pending: null, running: null };
    q.pending = op;
    this.queues.set(key, q);
    if (!q.running) q.running = this.drain(q);
  }

  private async drain(q: { pending: (() => Promise<void>) | null; running: Promise<void> | null }): Promise<void> {
    while (q.pending) {
      const op = q.pending;
      q.pending = null;
      try {
        await op();
      } catch (e) {
        // One quiet retry for transient failures, then tell the user.
        try {
          await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
          await op();
        } catch (e2) {
          this.report(describeError(e2 ?? e));
        }
      }
    }
    q.running = null;
  }

  async flush(): Promise<void> {
    await Promise.all([...this.queues.values()].map((q) => q.running ?? Promise.resolve()));
  }
}

function describeError(e: unknown): string {
  const code = (e as { code?: string })?.code;
  if (code === "quota_exceeded") return "Storage is full. Export a backup in Settings, then reset old history.";
  if (code === "revoked" || code === "not_granted") return "This page lost access to your saved data. Reload the page.";
  return "Couldn't save your latest change. It will retry with your next change; check your connection.";
}

// ---------------------------------------------------------------- claude.ai account storage

interface DocSnap { exists: boolean; data(): Record<string, unknown> | undefined }
interface DocRef {
  get(): Promise<DocSnap>;
  set(data: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
  collection(path: string): CollRef;
}
interface Query { where(f: string, op: string, v: unknown): Query; orderBy(f: string, d?: "asc" | "desc"): Query; limit(n: number): Query; get(): Promise<{ docs: (DocSnap & { id: string })[] }> }
interface CollRef extends Query { doc(id?: string): DocRef }
interface DB { doc(path: string): DocRef; collection(path: string): CollRef }
interface UserNs { id(): Promise<string | null> }

function claudePersistence(db: DB, uid: string): Persistence {
  let report: (m: string) => void = () => {};
  const writer = new Writer((m) => report(m));
  const base = `data/users/${uid}`;
  const coreDoc = db.doc(`${base}/core`);
  const activeDoc = db.doc(`${base}/active`);
  const sessions = () => coreDoc.collection("sessions");

  async function loadSessions(): Promise<SessionRecord[]> {
    const out: SessionRecord[] = [];
    let after = -1;
    for (;;) {
      const page = await sessions().where("index", ">", after).orderBy("index").limit(500).get();
      for (const d of page.docs) out.push(d.data() as unknown as SessionRecord);
      if (page.docs.length < 500) break;
      after = out[out.length - 1]!.index;
    }
    return out;
  }

  return {
    kind: "claude",
    async load() {
      const [c, a, history] = await Promise.all([coreDoc.get(), activeDoc.get(), loadSessions()]);
      return {
        core: c.exists ? ((c.data()?.["core"] as Core | undefined) ?? null) : null,
        active: a.exists ? ((a.data()?.["active"] as ActiveSession | undefined) ?? null) : null,
        history: history.sort((x, y) => x.index - y.index || x.finishedAt - y.finishedAt),
      };
    },
    saveCore(core) {
      writer.schedule("core", () => (core ? coreDoc.set({ core: plain(core) }) : coreDoc.delete()));
    },
    saveActive(active) {
      writer.schedule("active", () => (active ? activeDoc.set({ active: plain(active) }) : activeDoc.delete()));
    },
    saveRecord(record) {
      writer.schedule(`session:${record.id}`, () => sessions().doc(record.id).set(plain(record) as unknown as Record<string, unknown>));
    },
    async replaceAll(data) {
      await writer.flush();
      const existing = await loadSessions();
      for (const r of existing) await sessions().doc(r.id).delete();
      for (const r of data.history) await sessions().doc(r.id).set(plain(r) as unknown as Record<string, unknown>);
      if (data.active) await activeDoc.set({ active: plain(data.active) });
      else await activeDoc.delete();
      if (data.core) await coreDoc.set({ core: plain(data.core) });
      else await coreDoc.delete();
    },
    flush: () => writer.flush(),
    onError(fn) {
      report = fn;
    },
  };
}

// ---------------------------------------------------------------- this device (IndexedDB)

function devicePersistence(store: UseStore): Persistence {
  let report: (m: string) => void = () => {};
  const writer = new Writer((m) => report(m));
  let history: SessionRecord[] = [];
  return {
    kind: "device",
    async load() {
      const [core, active, h] = await Promise.all([get<Core>("core", store), get<ActiveSession>("active", store), get<SessionRecord[]>("history", store)]);
      history = h ?? [];
      return { core: core ?? null, active: active ?? null, history };
    },
    saveCore(core) {
      writer.schedule("core", () => (core ? set("core", plain(core), store) : del("core", store)));
    },
    saveActive(active) {
      writer.schedule("active", () => (active ? set("active", plain(active), store) : del("active", store)));
    },
    saveRecord(record) {
      history = [...history.filter((r) => r.id !== record.id), record].sort((a, b) => a.index - b.index);
      const snapshot = history;
      writer.schedule("history", () => set("history", plain(snapshot), store));
    },
    async replaceAll(data) {
      await writer.flush();
      history = data.history;
      await Promise.all([
        data.core ? set("core", plain(data.core), store) : del("core", store),
        data.active ? set("active", plain(data.active), store) : del("active", store),
        set("history", plain(data.history), store),
      ]);
    },
    flush: () => writer.flush(),
    onError(fn) {
      report = fn;
    },
  };
}

// ---------------------------------------------------------------- nowhere (last resort)

export function memoryPersistence(): Persistence {
  return {
    kind: "memory",
    load: async () => EMPTY_DATA,
    saveCore() {},
    saveActive() {},
    saveRecord() {},
    async replaceAll() {},
    flush: async () => {},
    onError() {},
  };
}

/**
 * Inside claude.ai the app saves to the person's private space in the page's
 * database, so it follows them across devices and reloads. Installed on its
 * own it saves on the device.
 */
export async function openPersistence(): Promise<Persistence> {
  const [db, user] = await Promise.all([useCapability<DB>("db"), useCapability<UserNs>("user")]);
  if (db && user) {
    try {
      const uid = await user.id();
      if (uid) return claudePersistence(db, uid);
    } catch {
      // fall through to device storage
    }
  }
  try {
    const store = createStore("repcurve", "data");
    await get("core", store);
    try {
      await navigator.storage?.persist?.();
    } catch {
      // best effort
    }
    return devicePersistence(store);
  } catch {
    return memoryPersistence();
  }
}
