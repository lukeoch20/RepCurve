import { storageKey } from "./channel";

/** Monthly backup nudge for data kept only on this device. Per-device, best effort. */
const KEY = storageKey("lastBackup");
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export function markBackedUp(now: number): void {
  try {
    localStorage.setItem(KEY, String(now));
  } catch {
    // per-device convenience only
  }
}

export function lastBackup(): number | null {
  try {
    const v = Number(localStorage.getItem(KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

/** True when device-only data has gone a month without a backup. */
export function backupDue(storage: string | null, firstSessionAt: number | null, now: number, last = lastBackup()): boolean {
  if (storage !== "device" || firstSessionAt === null) return false;
  return now - (last ?? firstSessionAt) >= MONTH_MS;
}
