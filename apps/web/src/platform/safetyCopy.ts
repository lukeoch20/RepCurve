import { createStore, del, get, set } from "idb-keyval";
import type { AppData } from "../model/types";
import { STORAGE_PREFIX } from "./channel";

/**
 * The data as it was just before a restore, kept on this device so a restore can be undone.
 * One copy; best effort (storage may be unavailable).
 */
interface SafetyCopy {
  savedAt: number;
  data: AppData;
}

const KEY = "beforeRestore";
let store: ReturnType<typeof createStore> | null = null;
const db = () => (store ??= createStore(`${STORAGE_PREFIX}-safety`, "copy"));

export async function keepSafetyCopy(data: AppData, now: number): Promise<boolean> {
  try {
    await set(KEY, JSON.parse(JSON.stringify({ savedAt: now, data })) as SafetyCopy, db());
    return true;
  } catch {
    return false;
  }
}

export async function safetyCopy(): Promise<SafetyCopy | null> {
  try {
    const c = (await get(KEY, db())) as SafetyCopy | undefined;
    return c && typeof c.savedAt === "number" && c.data ? c : null;
  } catch {
    return null;
  }
}

export async function dropSafetyCopy(): Promise<void> {
  try {
    await del(KEY, db());
  } catch {
    // best effort
  }
}
