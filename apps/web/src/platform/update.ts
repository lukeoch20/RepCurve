/**
 * A new version of the installed app is waiting. The app shows an "Update" button when no
 * session is running, instead of reloading itself mid-workout.
 */
let apply: (() => Promise<void>) | null = null;
const listeners = new Set<() => void>();

/** A new version is downloaded. Nothing reloads until the person taps Update. */
export function setUpdateReady(fn: () => Promise<void>): void {
  apply = fn;
  for (const l of listeners) l();
}

export function updateReady(): boolean {
  return apply !== null;
}

/** Whether to offer the update now: never while a session is under way. */
export function updateOffered(sessionActive: boolean): boolean {
  return apply !== null && !sessionActive;
}

export function onUpdateReady(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Reload into the new version, unless a session is under way: that would lose the timer and the set in hand. */
export function applyUpdate(sessionActive = false): void {
  if (!apply || sessionActive) return;
  void apply().catch(() => {
    // The page stays as it is; the button is still there to try again.
  });
}
