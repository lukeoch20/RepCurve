import React, { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { EMPTY_DATA, type AppData } from "../model/types";
import { memoryPersistence, openPersistence, type Persistence, type StorageKind } from "./persistence";
import { INITIAL, reducer, type Action, type AppState } from "./reducer";

export interface AppStore extends AppState {
  dispatch: (a: Action) => void;
  storage: StorageKind | null;
  saveError: string | null;
  clearSaveError: () => void;
  /** Replace all data (import or reset) and wait for it to be saved. */
  replaceAll: (data: AppData) => Promise<void>;
}

export function useAppStore(): AppStore {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [storage, setStorage] = useState<StorageKind | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const persistence = useRef<Persistence | null>(null);
  const saved = useRef<AppData>(EMPTY_DATA);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let p: Persistence;
      let data: AppData;
      try {
        p = await openPersistence();
        data = await p.load();
      } catch {
        p = memoryPersistence();
        data = EMPTY_DATA;
        setSaveError("Couldn't open your saved data. Changes this visit won't be kept.");
      }
      if (cancelled) return;
      p.onError(setSaveError);
      persistence.current = p;
      saved.current = data;
      setStorage(p.kind);
      dispatch({ type: "loaded", data });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  // Push pending writes out when the app is hidden (phone locked, app switched).
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void persistence.current?.flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  const replaceAll = useCallback(async (data: AppData) => {
    const p = persistence.current;
    if (p) await p.replaceAll(data);
    saved.current = data;
    dispatch({ type: "loaded", data });
  }, []);

  return {
    ...state,
    dispatch,
    storage,
    saveError,
    clearSaveError: () => setSaveError(null),
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
