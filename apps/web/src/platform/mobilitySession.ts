import { storageKey } from "./channel";

/** The mobility session under way, kept on this device so a reload picks it up where it was. Best effort. */
const KEY = storageKey("mobility");
/** Raised when a saved session's shape changes, so one saved by another version is dropped, not misread. */
const FORMAT = 1;

export function loadMobilitySession(): unknown {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
    const o = stored as { v?: unknown; session?: unknown } | null;
    return o && typeof o === "object" && o.v === FORMAT ? o.session : null;
  } catch {
    return null;
  }
}

export function saveMobilitySession(session: object | null): void {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify({ v: FORMAT, session }));
    else localStorage.removeItem(KEY);
  } catch {
    // per-device convenience only
  }
}
