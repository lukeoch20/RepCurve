import { coreProblem, migrateData } from "./migrate";
import type { AppData } from "./types";

export const BACKUP_FORMAT = "repcurve-backup";
export const BACKUP_VERSION = 1;

export function exportBackup(data: AppData, now: number): string {
  return JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date(now).toISOString(), ...data }, null, 1);
}

/**
 * Read a backup the person picked or pasted. Values the app can't plan with are repaired (see
 * migrate); a backup is refused, with what's wrong, only when restoring it would lose or invent
 * something that matters: the person's body details, their equipment or their sessions.
 */
export function parseBackup(text: string): { ok: true; data: AppData } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "That isn't a RepCurve backup: it isn't valid JSON." };
  }
  const o = raw as { format?: unknown; version?: unknown; core?: unknown; history?: unknown } | null;
  if (!o || typeof o !== "object" || Array.isArray(o) || o.format !== BACKUP_FORMAT) return { ok: false, error: "That isn't a RepCurve backup file." };
  if (typeof o.version === "number" && o.version > BACKUP_VERSION) {
    return { ok: false, error: "This backup is from a newer version of RepCurve. Update the app, then restore it." };
  }
  if (o.core !== null && o.core !== undefined) {
    const problem = coreProblem(o.core);
    if (problem === "profile") return { ok: false, error: "This backup's profile is damaged (sex, age, height or weight can't be read), so it can't be restored." };
    if (problem === "equipment") return { ok: false, error: "This backup's equipment list is damaged, so it can't be restored." };
  }
  // Restoring replaces every session, so a history that can't be read is refused rather than emptied.
  if (o.history !== undefined && o.history !== null && !Array.isArray(o.history)) {
    return { ok: false, error: "This backup's session history is damaged, so it can't be restored." };
  }
  const data = migrateData(o);
  const given = Array.isArray(o.history) ? o.history.length : 0;
  if (given > 0 && data.history.length === 0) return { ok: false, error: "None of the sessions in this backup could be read." };
  return { ok: true, data };
}
