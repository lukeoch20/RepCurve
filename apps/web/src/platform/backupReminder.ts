import { storageKey } from "./channel";

/** Backup nudges for data kept only on this device. Per-device, best effort. */
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

/** Sessions in before the first nudge, and between nudges however recent the last backup. */
export const FIRST_BACKUP_AFTER = 3;
export const BACKUP_EVERY_SESSIONS = 12;

/**
 * Why device-only data needs a backup now, or null: after the third session (there's real
 * progress to lose), then after a month or twelve more sessions since the last one.
 */
export function backupDue(storage: string | null, finishedAt: number[], now: number, last = lastBackup()): "first" | "due" | null {
  if (storage !== "device" || finishedAt.length < FIRST_BACKUP_AFTER) return null;
  if (last === null) return "first";
  const since = finishedAt.filter((t) => t > last).length;
  return now - last >= MONTH_MS || since >= BACKUP_EVERY_SESSIONS ? "due" : null;
}
