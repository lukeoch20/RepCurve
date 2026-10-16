import { storageKey } from "./channel";

/** Whether this device shows a pat on the back after each exercise. Per device, on unless turned off. */
const KEY = storageKey("pats");

export function patsOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setPatsOn(on: boolean): void {
  try {
    if (on) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, "off");
  } catch {
    // per-device convenience only
  }
}
