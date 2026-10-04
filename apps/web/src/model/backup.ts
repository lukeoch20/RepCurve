import type { AppData } from "./types";

export const BACKUP_FORMAT = "repcurve-backup";

export function exportBackup(data: AppData, now: number): string {
  return JSON.stringify({ format: BACKUP_FORMAT, version: 1, exportedAt: new Date(now).toISOString(), ...data }, null, 1);
}

export function parseBackup(text: string): { ok: true; data: AppData } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "That isn't a RepCurve backup: it isn't valid JSON." };
  }
  const o = raw as Partial<AppData> & { format?: string };
  if (!o || typeof o !== "object" || o.format !== BACKUP_FORMAT) return { ok: false, error: "That isn't a RepCurve backup file." };
  const core = o.core ?? null;
  if (core && (typeof core !== "object" || !core.profile || !core.equipment || !core.state)) {
    return { ok: false, error: "The backup is missing your profile or training state." };
  }
  const history = Array.isArray(o.history) ? o.history : [];
  return { ok: true, data: { core, active: o.active ?? null, history } };
}
