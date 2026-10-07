import { migrateData } from "./migrate";
import type { AppData } from "./types";

export const BACKUP_FORMAT = "repcurve-backup";
export const BACKUP_VERSION = 1;

export function exportBackup(data: AppData, now: number): string {
  return JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date(now).toISOString(), ...data }, null, 1);
}

export function parseBackup(text: string): { ok: true; data: AppData } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "That isn't a RepCurve backup: it isn't valid JSON." };
  }
  const o = raw as { format?: unknown; version?: unknown; core?: unknown; history?: unknown } | null;
  if (!o || typeof o !== "object" || o.format !== BACKUP_FORMAT) return { ok: false, error: "That isn't a RepCurve backup file." };
  if (typeof o.version === "number" && o.version > BACKUP_VERSION) {
    return { ok: false, error: "This backup is from a newer version of RepCurve. Update the app, then restore it." };
  }
  const data = migrateData(o);
  if (o.core !== null && o.core !== undefined && data.core === null) {
    return { ok: false, error: "The backup's profile or equipment is damaged, so it can't be restored." };
  }
  const given = Array.isArray(o.history) ? o.history.length : 0;
  if (given > 0 && data.history.length === 0) return { ok: false, error: "None of the sessions in this backup could be read." };
  return { ok: true, data };
}
