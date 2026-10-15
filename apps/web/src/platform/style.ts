import { storageKey } from "./channel";

/**
 * The app's look. Bluebird (cobalt header bands, ivory cards, bevelled green buttons) is the
 * default; Fired Forge (charcoal plates, warm ash panels, ember buttons), Pixel Press (game-sprite
 * pixels, violet blocks, grid lettering), Gold Plated (ivory or black enamel, gold plating,
 * faceted frames, Art Deco headings) and Cut Like a Diamond (white diamond or black crystal,
 * platinum frames, a brilliant-cut crest: the highest reward) are the other artist styles. Classic is the original
 * forest-green look. Each comes light or dark, and Classic can also follow the phone's mode.
 * Per device, like the tips, so it applies before anything loads.
 */
export type StyleId =
  | "bluebird-light"
  | "bluebird-dark"
  | "forge-light"
  | "forge-dark"
  | "pixel-light"
  | "pixel-dark"
  | "gold-light"
  | "gold-dark"
  | "diamond-light"
  | "diamond-dark"
  | "classic-light"
  | "classic-dark"
  | "classic";

export const DEFAULT_STYLE: StyleId = "bluebird-light";

/** A look and its versions. Settings lists the looks; choosing one asks which version. */
export interface StyleFamily {
  id: "bluebird" | "forge" | "pixel" | "gold" | "diamond" | "classic";
  name: string;
  hint: string;
  light: StyleId;
  dark: StyleId;
  /** A version that follows the phone's light or dark mode. */
  auto?: StyleId;
}

export const FAMILIES: readonly StyleFamily[] = [
  { id: "bluebird", name: "Bluebird", hint: "Cobalt headers, ivory cards and green buttons; deep navy in the dark.", light: "bluebird-light", dark: "bluebird-dark" },
  { id: "forge", name: "Fired Forge", hint: "Warm ash panels, charcoal headers and ember buttons; banked embers in the dark.", light: "forge-light", dark: "forge-dark" },
  { id: "pixel", name: "Pixel Press", hint: "Game-sprite pixels and grid lettering: violet on lavender, or violet and mint on indigo.", light: "pixel-light", dark: "pixel-dark" },
  { id: "gold", name: "Gold Plated", hint: "Champagne gold, faceted frames and Art Deco headings, on ivory or black enamel.", light: "gold-light", dark: "gold-dark" },
  { id: "diamond", name: "Cut Like a Diamond", hint: "Platinum frames, polished crystal and a brilliant-cut diamond, as white diamond or black crystal.", light: "diamond-light", dark: "diamond-dark" },
  { id: "classic", name: "Classic", hint: "The original forest green and serif headings.", light: "classic-light", dark: "classic-dark", auto: "classic" },
];

/** Every look-and-version, named for where one name is needed. */
export const STYLES: readonly { id: StyleId; name: string }[] = FAMILIES.flatMap((f) => [
  { id: f.light, name: `${f.name} light` },
  { id: f.dark, name: `${f.name} dark` },
  ...(f.auto ? [{ id: f.auto, name: `${f.name}, matching the phone` }] : []),
]);

export const familyOf = (id: StyleId): StyleFamily => FAMILIES.find((f) => f.light === id || f.dark === id || f.auto === id)!;

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

/** Each fixed version: its data-style name (none for Classic), light or dark, and its page colour for the browser's toolbar. */
const LOOKS: Record<Exclude<StyleId, "classic">, { style: string | null; theme: "light" | "dark"; bg: string }> = {
  "bluebird-light": { style: "bluebird", theme: "light", bg: "#eaf1fb" },
  "bluebird-dark": { style: "bluebird", theme: "dark", bg: "#0e1726" },
  "forge-light": { style: "forge", theme: "light", bg: "#f0ece5" },
  "forge-dark": { style: "forge", theme: "dark", bg: "#12100f" },
  "pixel-light": { style: "pixel", theme: "light", bg: "#f2f0ff" },
  "pixel-dark": { style: "pixel", theme: "dark", bg: "#121226" },
  "gold-light": { style: "gold", theme: "light", bg: "#f5f1e8" },
  "gold-dark": { style: "gold", theme: "dark", bg: "#10110f" },
  "diamond-light": { style: "diamond", theme: "light", bg: "#f0f2f3" },
  "diamond-dark": { style: "diamond", theme: "dark", bg: "#080c11" },
  "classic-light": { style: null, theme: "light", bg: "#f4f5f2" },
  "classic-dark": { style: null, theme: "dark", bg: "#0e1210" },
};
/** Classic matching the phone. */
const CLASSIC_BG = { light: "#f4f5f2", dark: "#0e1210" } as const;

/** Puts a style on the page: data-style picks the look, data-theme pins light or dark. */
export function applyStyle(id: StyleId, doc: Document = document): void {
  const root = doc.documentElement;
  const look = id === "classic" ? null : LOOKS[id];
  if (look) {
    if (look.style) root.dataset["style"] = look.style;
    else delete root.dataset["style"];
    root.dataset["theme"] = look.theme;
  } else {
    delete root.dataset["style"];
    delete root.dataset["theme"];
  }
  for (const meta of doc.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = look ? look.bg : CLASSIC_BG[meta.media.includes("dark") ? "dark" : "light"];
  }
}
