import { APP_NAME, CHANNEL, storageKey } from "./channel";

/**
 * The last few errors, kept on this device. There's no server to report to, so a person who hits
 * a problem can copy this and send it along. Best effort: storage may be unavailable or full.
 */
const KEY = storageKey("crashes");
export const CRASH_LOG_MAX = 20;
const STACK_MAX = 1024;
const MESSAGE_MAX = 500;

export interface CrashEntry {
  /** Epoch ms. */
  at: number;
  /** What was happening, e.g. "showing a screen" or "action: finish". */
  where: string;
  message: string;
  stack?: string;
}

const trim = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

function describe(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) return { message: `${error.name}: ${error.message}`, ...(error.stack ? { stack: error.stack } : {}) };
  try {
    return { message: typeof error === "string" ? error : JSON.stringify(error) ?? String(error) };
  } catch {
    return { message: String(error) };
  }
}

export function crashLog(): CrashEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((e): e is CrashEntry => typeof e === "object" && e !== null && typeof e.at === "number" && typeof e.message === "string") : [];
  } catch {
    return [];
  }
}

/** Keep an error, newest last, dropping the oldest beyond the last 20. */
export function logCrash(where: string, error: unknown, now = Date.now()): void {
  const { message, stack } = describe(error);
  const entry: CrashEntry = { at: now, where: trim(where, 100), message: trim(message, MESSAGE_MAX), ...(stack ? { stack: trim(stack, STACK_MAX) } : {}) };
  const list = [...crashLog(), entry].slice(-CRASH_LOG_MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Storage full or blocked: try once with just this error, then give up.
    try {
      localStorage.setItem(KEY, JSON.stringify([entry]));
    } catch {
      // best effort
    }
  }
}

export function clearCrashLog(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // best effort
  }
}

/** The log as plain text to paste into a message, with what browser and app it came from. */
export function crashLogText(entries: CrashEntry[] = crashLog()): string {
  const head = [
    `${APP_NAME} error log (${CHANNEL})`,
    typeof navigator !== "undefined" ? navigator.userAgent : "",
    entries.length === 0 ? "No errors recorded." : `${entries.length} error${entries.length === 1 ? "" : "s"}, oldest first.`,
  ].filter(Boolean);
  const body = entries.map((e) => [`${new Date(e.at).toISOString()}  ${e.where}`, e.message, e.stack ?? ""].filter(Boolean).join("\n"));
  return [...head, ...body].join("\n\n");
}

/** Copy the log to the clipboard. False when the browser refused. */
export async function copyCrashLog(): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(crashLogText());
    return true;
  } catch {
    return false;
  }
}
