import { storageKey } from "./channel";

/**
 * The app's look. Bluebird (cobalt header bands, ivory cards, bevelled green buttons) is the
 * default; Fired Forge (charcoal plates, warm ash panels, ember buttons) and Pixel Press
 * (game-sprite pixels, violet blocks, grid lettering) and Gold Plated (ivory or black enamel, gold
 * plating, faceted frames, Art Deco headings) are the other artist styles, each in light
 * or dark. Classic is the original forest-green look, which follows the
 * phone's light or dark mode. Per device, like the tips, so it applies before anything loads.
 */
export type StyleId = "bluebird-light" | "bluebird-dark" | "forge-light" | "forge-dark" | "pixel-light" | "pixel-dark" | "gold-light" | "gold-dark" | "classic";

export const DEFAULT_STYLE: StyleId = "bluebird-light";

export const STYLES: readonly { id: StyleId; name: string; hint: string }[] = [
  { id: "bluebird-light", name: "Bluebird light", hint: "Cobalt headers, ivory cards and green buttons." },
  { id: "bluebird-dark", name: "Bluebird dark", hint: "The same look on deep navy, easier on the eyes at night." },
  { id: "forge-light", name: "Fired Forge light", hint: "Warm ash panels, charcoal headers and ember buttons." },
  { id: "forge-dark", name: "Fired Forge dark", hint: "Banked embers on charcoal." },
  { id: "pixel-light", name: "Pixel Press light", hint: "Game-sprite pixels: violet blocks and grid lettering on lavender paper." },
  { id: "pixel-dark", name: "Pixel Press dark", hint: "Night sprites: soft violet and mint on deep indigo." },
  { id: "gold-light", name: "Gold Plated light", hint: "Ivory and champagne gold, faceted frames and Art Deco headings." },
  { id: "gold-dark", name: "Gold Plated dark", hint: "Gold plating on black enamel." },
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

/** Each artist style: its data-style name, light or dark, and its page colour for the browser's toolbar. */
const LOOKS: Record<Exclude<StyleId, "classic">, { style: string; theme: "light" | "dark"; bg: string }> = {
  "bluebird-light": { style: "bluebird", theme: "light", bg: "#eaf1fb" },
  "bluebird-dark": { style: "bluebird", theme: "dark", bg: "#0e1726" },
  "forge-light": { style: "forge", theme: "light", bg: "#f0ece5" },
  "forge-dark": { style: "forge", theme: "dark", bg: "#12100f" },
  "pixel-light": { style: "pixel", theme: "light", bg: "#f2f0ff" },
  "pixel-dark": { style: "pixel", theme: "dark", bg: "#121226" },
  "gold-light": { style: "gold", theme: "light", bg: "#f5f1e8" },
  "gold-dark": { style: "gold", theme: "dark", bg: "#10110f" },
};
/** Classic follows the phone. */
const CLASSIC_BG = { light: "#f4f5f2", dark: "#0e1210" } as const;

/** Puts a style on the page: data-style picks the look, data-theme pins light or dark. */
export function applyStyle(id: StyleId, doc: Document = document): void {
  const root = doc.documentElement;
  const look = id === "classic" ? null : LOOKS[id];
  if (look) {
    root.dataset["style"] = look.style;
    root.dataset["theme"] = look.theme;
  } else {
    delete root.dataset["style"];
    delete root.dataset["theme"];
  }
  for (const meta of doc.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = look ? look.bg : CLASSIC_BG[meta.media.includes("dark") ? "dark" : "light"];
  }
}
