import { storageKey } from "./channel";

/** Which tutorial tips this device has seen, and whether tips are off. Per device, best effort. */
const KEY = storageKey("tips");

export interface TipsState {
  off: boolean;
  seen: string[];
}

export function loadTips(): TipsState {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      return { off: o["off"] === true, seen: Array.isArray(o["seen"]) ? o["seen"].filter((s): s is string => typeof s === "string") : [] };
    }
  } catch {
    // unreadable: start the tutorial fresh
  }
  return { off: false, seen: [] };
}

export function saveTips(state: TipsState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // per-device convenience only
  }
}
