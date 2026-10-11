import { storageKey } from "./channel";

/**
 * The app's look. Bluebird (cobalt header bands, ivory cards, bevelled green buttons) is the
 * default, in light or dark. Classic is the original forest-green look, which follows the
 * phone's light or dark mode. Per device, like the tips, so it applies before anything loads.
 */
export type StyleId = "bluebird-light" | "bluebird-dark" | "classic";

export const DEFAULT_STYLE: StyleId = "bluebird-light";

export const STYLES: readonly { id: StyleId; name: string; hint: string }[] = [
  { id: "bluebird-light", name: "Bluebird light", hint: "Cobalt headers, ivory cards and green buttons." },
  { id: "bluebird-dark", name: "Bluebird dark", hint: "The same look on deep navy, easier on the eyes at night." },
  { id: "classic", name: "Classic", hint: "The original forest green and serif headings. Follows your phone's light or dark mode." },
];

const KEY = storageKey("style");

const isStyle = (v: unknown): v is StyleId => STYLES.some((s) => s.id === v);

export function loadStyle(): StyleId {
  try {
    const v = localStorage.getItem(KEY);
    if (isStyle(v)) return v;
  } catch {
    // unreadable: use the default
  }
  return DEFAULT_STYLE;
}

export function saveStyle(id: StyleId): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // per-device convenience only
  }
}

/** The page colour behind each style, for the browser's toolbar. Classic follows the phone. */
const BG = { "bluebird-light": "#eaf1fb", "bluebird-dark": "#0e1726" } as const;
const CLASSIC_BG = { light: "#f4f5f2", dark: "#0e1210" } as const;

/** Puts a style on the page: data-style picks the look, data-theme pins light or dark. */
export function applyStyle(id: StyleId, doc: Document = document): void {
  const root = doc.documentElement;
  if (id === "classic") {
    delete root.dataset["style"];
    delete root.dataset["theme"];
  } else {
    root.dataset["style"] = "bluebird";
    root.dataset["theme"] = id === "bluebird-dark" ? "dark" : "light";
  }
  for (const meta of doc.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const scheme = meta.media.includes("dark") ? "dark" : "light";
    meta.content = id === "classic" ? CLASSIC_BG[scheme] : BG[id];
  }
}
