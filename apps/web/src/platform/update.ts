/**
 * A new version of the installed app is waiting. The app shows an "Update" button when no
 * session is running, instead of reloading itself mid-workout.
 */
let apply: (() => Promise<void>) | null = null;
const listeners = new Set<() => void>();

export function setUpdateReady(fn: () => Promise<void>): void {
  apply = fn;
  for (const l of listeners) l();
}

export function updateReady(): boolean {
  return apply !== null;
}

export function onUpdateReady(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function applyUpdate(): void {
  void apply?.();
}
