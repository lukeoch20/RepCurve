/**
 * Which app this build is: the real RepCurve ("main") or RepCurve Test ("test"), where new
 * features are tried first. Both can be installed side by side, so the test app keeps its data
 * under its own names and never reads or writes the real app's.
 */
declare const __CHANNEL__: "main" | "test";

export const CHANNEL: "main" | "test" = typeof __CHANNEL__ === "undefined" ? "main" : __CHANNEL__;
export const IS_TEST = CHANNEL === "test";

/** The app's name as the person sees it. */
export const APP_NAME = IS_TEST ? "RepCurve Test" : "RepCurve";

/** Name prefix for everything this app stores on the device: the database and every saved setting. */
export const STORAGE_PREFIX = IS_TEST ? "repcurve-test" : "repcurve";

/** A device storage key for this app, e.g. storageKey("tab") → "repcurve.tab" or "repcurve-test.tab". */
export function storageKey(name: string): string {
  return `${STORAGE_PREFIX}.${name}`;
}
