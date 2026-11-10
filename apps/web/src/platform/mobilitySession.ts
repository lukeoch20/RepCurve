import { storageKey } from "./channel";

/** The mobility session under way, kept on this device so a reload picks it up where it was. Best effort. */
const KEY = storageKey("mobility");

export function loadMobilitySession(): unknown {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
}

export function saveMobilitySession(session: object | null): void {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  } catch {
    // per-device convenience only
  }
}
