import React, { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { migrateData } from "../model/migrate";
import { EMPTY_DATA, type AppData } from "../model/types";
import { memoryPersistence, openPersistence, type Persistence, type StorageKind } from "./persistence";
import { INITIAL, reducer, type Action, type AppState } from "./reducer";

export interface AppStore extends AppState {
  dispatch: (a: Action) => void;
  storage: StorageKind | null;
  saveError: string | null;
  clearSaveError: () => void;
  /** Data isn't going where the user expects (memory only, or device instead of account). */
  storageWarning: string | null;
  /** One-off notice, e.g. data reloaded after a change on another device. */
  notice: string | null;
  clearNotice: () => void;
  /** Replace all data (import or reset) and wait for it to be saved. */
  replaceAll: (data: AppData) => Promise<void>;
}

export function useAppStore(): AppStore {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [storage, setStorage] = useState<StorageKind | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const persistence = useRef<Persistence | null>(null);
  const saved = useRef<AppData>(EMPTY_DATA);
  const current = useRef<AppData>(EMPTY_DATA);
  current.current = state.data;

  /** Load from storage again and show it, e.g. after another device saved. */
  const reload = useCallback(async (message?: string) => {
    const p = persistence.current;
    if (!p) return;
    const data = migrateData(await p.load());
    saved.current = data;
    dispatch({ type: "loaded", data });
    if (message) setNotice(message);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let p: Persistence;
      let data: AppData;
      try {
        p = await openPersistence();
        data = migrateData(await p.load());
      } catch {
        p = memoryPersistence("Couldn't open your saved data, so changes this visit won't be kept. Reload to try again.");
        data = EMPTY_DATA;
      }
      if (cancelled) return;
      p.onError(setSaveError);
      p.onConflict(() => {
        void reload("Your training was updated on another device, so the latest version is loaded here.").catch(() => {});
      });
      persistence.current = p;
      saved.current = data;
      setStorage(p.kind);
      setStorageWarning(p.warning);
      dispatch({ type: "loaded", data });
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  // Save whatever changed since the last save.
  useEffect(() => {
    const p = persistence.current;
    if (!state.ready || !p) return;
    const prev = saved.current;
    const cur = state.data;
    if (cur.core !== prev.core) p.saveCore(cur.core);
    if (cur.active !== prev.active) p.saveActive(cur.active);
    if (cur.history !== prev.history) {
      const before = new Map(prev.history.map((r) => [r.id, r]));
      for (const r of cur.history) if (before.get(r.id) !== r) p.saveRecord(r);
    }
    saved.current = cur;
  }, [state.data, state.ready]);

  // Push pending writes out when the app is hidden (phone locked, app switched), and pick
  // up changes from another device when it comes back, unless a session is under way here.
  useEffect(() => {
    const onVisibility = () => {
      const p = persistence.current;
      if (!p) return;
      if (document.visibilityState === "hidden") {
        void p.flush();
        return;
      }
      if (current.current.active) return;
      void p
        .changedElsewhere()
        .then((changed) => (changed && !current.current.active ? reload("Loaded the latest from your other device.") : undefined))
        .catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [reload]);

  const replaceAll = useCallback(
    async (data: AppData) => {
      const p = persistence.current;
      if (!p) return;
      try {
        await p.replaceAll(data);
      } finally {
        // Show what storage actually holds, whether or not every write landed.
        await reload().catch(() => {
          saved.current = data;
          dispatch({ type: "loaded", data });
        });
      }
    },
    [reload],
  );

  return {
    ...state,
    dispatch,
    storage,
    saveError,
    clearSaveError: () => setSaveError(null),
    storageWarning,
    notice,
    clearNotice: () => setNotice(null),
    replaceAll,
  };
}

/** Re-render on an interval while `active` is true; returns the current time. */
export function useNow(active: boolean, intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    const onVis = () => setNow(Date.now());
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [active, intervalMs]);
  return now;
}

export const StoreContext = React.createContext<AppStore | null>(null);

export function useStore(): AppStore {
  const s = React.useContext(StoreContext);
  if (!s) throw new Error("StoreContext missing");
  return s;
}
