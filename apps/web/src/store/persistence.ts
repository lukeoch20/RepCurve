import { createStore, entries, get, promisifyRequest, set, del, type UseStore } from "idb-keyval";
import { insideClaude, useCapability } from "../platform/runtime";
import { EMPTY_DATA, type ActiveSession, type AppData, type Core, type SessionRecord } from "../model/types";

export type StorageKind = "claude" | "device" | "memory";

export interface Persistence {
  kind: StorageKind;
  /** Set when data is not going where the user expects (e.g. memory only). Shown until reload. */
  warning: string | null;
  load(): Promise<AppData>;
  saveCore(core: Core | null): void;
  saveActive(active: ActiveSession | null): void;
  saveRecord(record: SessionRecord): void;
  /** Replace everything (import or reset). Resolves once written; rejects if any part failed. */
  replaceAll(data: AppData): Promise<void>;
  /** Resolves when every queued write has been attempted (failed writes are retried first). */
  flush(): Promise<void>;
  /** Write problems: a short message, or null once everything is saved again. */
  onError(fn: (message: string | null) => void): void;
  /** Another device changed the saved data, so this page's copy is stale and should be reloaded. */
  onConflict(fn: () => void): void;
  /** True when storage holds changes this page has not loaded (made on another device). */
  changedElsewhere(): Promise<boolean>;
}

/** Strip undefined and functions so documents are plain JSON. */
const plain = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** A write refused because another device saved a newer version first. */
export class ConflictError extends Error {
  constructor() {
    super("Saved data changed on another device");
  }
}

type Op = () => Promise<void>;
interface Queue {
  pending: Op | null;
  /** The latest write for this document that failed; retried until it succeeds or is superseded. */
  failed: Op | null;
  running: Promise<void> | null;
}

export const RETRY_MS = 15_000;

/**
 * One writer per document: writes run one at a time, and a burst of updates collapses
 * into the latest value. A write that fails is kept and retried (on the next change, on
 * flush, when the connection returns and every few seconds) until it succeeds.
 */
export class Writer {
  private queues = new Map<string, Queue>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private reported = false;

  constructor(
    private report: (message: string | null) => void,
    private conflict: () => void = () => {},
    private retryDelay = (): Promise<void> => new Promise((r) => setTimeout(r, 400 + Math.random() * 600)),
  ) {
    if (typeof window !== "undefined") window.addEventListener("online", () => this.retryFailed());
  }

  schedule(key: string, op: Op): void {
    const q = this.queues.get(key) ?? { pending: null, failed: null, running: null };
    q.pending = op;
    q.failed = null;
    this.queues.set(key, q);
    this.start(q);
    this.retryFailed();
  }

  hasFailures(): boolean {
    return [...this.queues.values()].some((q) => q.failed !== null);
  }

  retryFailed(): void {
    for (const q of this.queues.values()) {
      if (q.failed && !q.pending) {
        q.pending = q.failed;
        q.failed = null;
        this.start(q);
      }
    }
  }

  async flush(): Promise<void> {
    this.retryFailed();
    await Promise.all([...this.queues.values()].map((q) => q.running ?? Promise.resolve()));
  }

  private start(q: Queue): void {
    if (!q.running) q.running = this.drain(q);
  }

  private async drain(q: Queue): Promise<void> {
    while (q.pending) {
      const op = q.pending;
      q.pending = null;
      try {
        await this.attempt(op);
      } catch (e) {
        if (!q.pending) q.failed = op;
        this.reported = true;
        this.report(describeError(e));
        this.armRetry();
      }
    }
    q.running = null;
    if (this.reported && !this.hasFailures() && [...this.queues.values()].every((x) => !x.running)) {
      this.reported = false;
      this.report(null);
    }
  }

  /** Run a write with one quiet retry for blips. A conflict is never retried. */
  private async attempt(op: Op): Promise<void> {
    try {
      await op();
    } catch (e) {
      if (e instanceof ConflictError) return this.conflict();
      await this.retryDelay();
      try {
        await op();
      } catch (e2) {
        if (e2 instanceof ConflictError) return this.conflict();
        throw e2;
      }
    }
  }

  private armRetry(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.retryFailed();
    }, RETRY_MS);
  }
}

export function describeError(e: unknown): string {
  const code = (e as { code?: string })?.code;
  if (code === "quota_exceeded") return "Storage is full. Export a backup in Settings, then reset old history.";
  if (code === "revoked" || code === "not_granted") return "This page lost access to your saved data. Reload the page.";
  return "Couldn't save your latest change. RepCurve keeps retrying while the app is open; this message clears once it's saved.";
}

// ---------------------------------------------------------------- local safety copy

/**
 * Account writes that haven't been confirmed yet, kept in this browser so a reload or a
 * closed tab doesn't lose them. Best effort: storage may be unavailable.
 */
interface Unsaved {
  core?: { core: Core; baseRev: number };
  records: Record<string, SessionRecord>;
}

function unsavedStore(key: string) {
  const read = (): Unsaved => {
    try {
      const raw = localStorage.getItem(key);
      const u = raw ? (JSON.parse(raw) as Unsaved) : null;
      return u && typeof u === "object" && u.records ? u : { records: {} };
    } catch {
      return { records: {} };
    }
  };
  const write = (u: Unsaved) => {
    try {
      if (!u.core && Object.keys(u.records).length === 0) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(u));
    } catch {
      // best effort
    }
  };
  return {
    read,
    update(fn: (u: Unsaved) => void) {
      const u = read();
      fn(u);
      write(u);
    },
    clear: () => write({ records: {} }),
  };
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
export interface DB { doc(path: string): DocRef; collection(path: string): CollRef }
interface UserNs { id(): Promise<string | null> }

const revOf = (snap: DocSnap): number => (snap.exists ? Number(snap.data()?.["rev"] ?? 0) || 0 : 0);
const activeIdOf = (snap: DocSnap): string | null =>
  snap.exists ? ((snap.data()?.["active"] as { id?: string } | undefined)?.id ?? null) : null;

export function claudePersistence(db: DB, uid: string, retryDelay?: () => Promise<void>): Persistence {
  let report: (m: string | null) => void = () => {};
  let conflict: () => void = () => {};
  const writer = new Writer((m) => report(m), () => conflict(), retryDelay);
  const base = `data/users/${uid}`;
  const coreDoc = db.doc(`${base}/core`);
  const activeDoc = db.doc(`${base}/active`);
  const sessions = () => coreDoc.collection("sessions");
  const unsaved = unsavedStore(`repcurve.unsaved.${uid}`);
  /** Revision of core this page last loaded or wrote. */
  let rev = 0;
  let activeId: string | null = null;

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

  const writeRecord = (record: SessionRecord) => async () => {
    await sessions().doc(record.id).set(plain(record) as unknown as Record<string, unknown>);
    unsaved.update((u) => {
      if (u.records[record.id] && JSON.stringify(u.records[record.id]) === JSON.stringify(record)) delete u.records[record.id];
    });
  };

  const writeCore = (core: Core) => async () => {
    const current = revOf(await coreDoc.get());
    if (current !== rev) {
      unsaved.update((u) => delete u.core);
      throw new ConflictError();
    }
    await coreDoc.set({ core: plain(core), rev: rev + 1 });
    rev += 1;
    unsaved.update((u) => {
      if (!u.core) return;
      // A newer change waiting behind this one now builds on the revision just written.
      if (JSON.stringify(u.core.core) === JSON.stringify(plain(core))) delete u.core;
      else u.core.baseRev = rev;
    });
  };

  const self: Persistence = {
    kind: "claude",
    warning: null,
    async load() {
      await writer.flush();
      const [c, a, stored] = await Promise.all([coreDoc.get(), activeDoc.get(), loadSessions()]);
      rev = revOf(c);
      activeId = activeIdOf(a);
      let core = c.exists ? ((c.data()?.["core"] as Core | undefined) ?? null) : null;
      const history = new Map(stored.map((r) => [r.id, r]));
      // Re-send anything this browser saved that never reached the account.
      const u = unsaved.read();
      for (const r of Object.values(u.records)) {
        history.set(r.id, r);
        writer.schedule(`session:${r.id}`, writeRecord(r));
      }
      if (u.core) {
        if (u.core.baseRev === rev) {
          core = u.core.core;
          writer.schedule("core", writeCore(u.core.core));
        } else unsaved.update((x) => delete x.core);
      }
      return {
        core,
        active: a.exists ? ((a.data()?.["active"] as ActiveSession | undefined) ?? null) : null,
        history: [...history.values()].sort((x, y) => x.index - y.index || x.finishedAt - y.finishedAt),
      };
    },
    saveCore(core) {
      if (!core) {
        writer.schedule("core", async () => {
          await coreDoc.delete();
          rev = 0;
        });
        return;
      }
      unsaved.update((u) => (u.core = { core: plain(core), baseRev: u.core?.baseRev ?? rev }));
      writer.schedule("core", writeCore(core));
    },
    saveActive(active) {
      activeId = active?.id ?? null;
      writer.schedule("active", () => (active ? activeDoc.set({ active: plain(active) }) : activeDoc.delete()));
    },
    saveRecord(record) {
      unsaved.update((u) => (u.records[record.id] = plain(record)));
      writer.schedule(`session:${record.id}`, writeRecord(record));
    },
    async replaceAll(data) {
      await writer.flush();
      // New data first, the switch of core last, then remove what the new data doesn't have.
      const keep = new Set(data.history.map((r) => r.id));
      const existing = await loadSessions();
      for (const r of data.history) await sessions().doc(r.id).set(plain(r) as unknown as Record<string, unknown>);
      if (data.active) await activeDoc.set({ active: plain(data.active) });
      else await activeDoc.delete();
      const current = revOf(await coreDoc.get());
      if (data.core) await coreDoc.set({ core: plain(data.core), rev: current + 1 });
      else await coreDoc.delete();
      rev = data.core ? current + 1 : 0;
      activeId = data.active?.id ?? null;
      unsaved.clear();
      for (const r of existing) if (!keep.has(r.id)) await sessions().doc(r.id).delete();
    },
    flush: () => writer.flush(),
    onError(fn) {
      report = fn;
    },
    onConflict(fn) {
      conflict = fn;
    },
    async changedElsewhere() {
      await writer.flush();
      const [c, a] = await Promise.all([coreDoc.get(), activeDoc.get()]);
      return revOf(c) !== rev || activeIdOf(a) !== activeId;
    },
  };
  return self;
}

// ---------------------------------------------------------------- this device (IndexedDB)

const RECORD = "record:";

/** Run several writes in one IndexedDB transaction, so they land together or not at all. */
function inOneTransaction(store: UseStore, fn: (os: IDBObjectStore) => void): Promise<void> {
  return store("readwrite", (os) => {
    fn(os);
    return promisifyRequest(os.transaction);
  });
}

export function devicePersistence(store: UseStore): Persistence {
  let report: (m: string | null) => void = () => {};
  const writer = new Writer((m) => report(m));
  return {
    kind: "device",
    warning: null,
    async load() {
      const all = await entries<IDBValidKey, unknown>(store);
      const byKey = new Map(all.map(([k, v]) => [String(k), v]));
      const records = all.filter(([k]) => String(k).startsWith(RECORD)).map(([, v]) => v as SessionRecord);
      const legacy = byKey.get("history");
      if (Array.isArray(legacy)) {
        // Older versions kept every record in one array; move them to one key each.
        const merged = new Map((legacy as SessionRecord[]).map((r) => [r.id, r]));
        for (const r of records) merged.set(r.id, r);
        await inOneTransaction(store, (os) => {
          for (const r of merged.values()) os.put(plain(r), RECORD + r.id);
          os.delete("history");
        });
        records.splice(0, records.length, ...merged.values());
      }
      return {
        core: (byKey.get("core") as Core | undefined) ?? null,
        active: (byKey.get("active") as ActiveSession | undefined) ?? null,
        history: records.sort((a, b) => a.index - b.index || a.finishedAt - b.finishedAt),
      };
    },
    saveCore(core) {
      writer.schedule("core", () => (core ? set("core", plain(core), store) : del("core", store)));
    },
    saveActive(active) {
      writer.schedule("active", () => (active ? set("active", plain(active), store) : del("active", store)));
    },
    saveRecord(record) {
      writer.schedule(RECORD + record.id, () => set(RECORD + record.id, plain(record), store));
    },
    async replaceAll(data) {
      await writer.flush();
      await inOneTransaction(store, (os) => {
        os.clear();
        if (data.core) os.put(plain(data.core), "core");
        if (data.active) os.put(plain(data.active), "active");
        for (const r of data.history) os.put(plain(r), RECORD + r.id);
      });
    },
    flush: () => writer.flush(),
    onError(fn) {
      report = fn;
    },
    onConflict() {},
    changedElsewhere: async () => false,
  };
}

// ---------------------------------------------------------------- nowhere (last resort)

export function memoryPersistence(warning: string | null = MEMORY_WARNING): Persistence {
  let data: AppData = EMPTY_DATA;
  return {
    kind: "memory",
    warning,
    load: async () => data,
    saveCore(core) {
      data = { ...data, core };
    },
    saveActive(active) {
      data = { ...data, active };
    },
    saveRecord(record) {
      data = { ...data, history: [...data.history.filter((r) => r.id !== record.id), record] };
    },
    async replaceAll(next) {
      data = next;
    },
    flush: async () => {},
    onError() {},
    onConflict() {},
    changedElsewhere: async () => false,
  };
}

export const MEMORY_WARNING =
  "This browser isn't letting RepCurve save anything, so this visit is lost when you close it. Export a backup in Settings before you leave.";
export const DEVICE_FALLBACK_WARNING =
  "Couldn't reach your Claude account storage, so this visit saves on this device only. Reload to try again.";

/**
 * Inside claude.ai the app saves to the person's private space in the page's database, so
 * it follows them across devices and reloads. Installed on its own it saves on the device.
 * Falling back anywhere else comes with a warning the app keeps on screen.
 */
export async function openPersistence(): Promise<Persistence> {
  if (insideClaude()) {
    for (const timeoutMs of [12_000, 20_000]) {
      const [db, user] = await Promise.all([useCapability<DB>("db", timeoutMs), useCapability<UserNs>("user", timeoutMs)]);
      if (!db || !user) continue;
      try {
        const uid = await user.id();
        if (uid) return claudePersistence(db, uid);
      } catch {
        // try again, then fall back
      }
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
    const device = devicePersistence(store);
    return insideClaude() ? { ...device, warning: DEVICE_FALLBACK_WARNING } : device;
  } catch {
    return memoryPersistence();
  }
}
