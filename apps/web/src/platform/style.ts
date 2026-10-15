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
  // Before the first change, so the look in use until now is kept.
  keepLooks([familyOf(id).id]);
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // per-device convenience only
  }
}

/** A look, light and dark together. */
export type LookId = StyleFamily["id"];

const KEPT_KEY = storageKey("looks-kept");
const isLook = (v: unknown): v is LookId => FAMILIES.some((f) => f.id === v);

/**
 * Looks this device keeps open whatever the badges say: the one in use when looks became
 * rewards (recorded the first time this is read), and every look used or earned here since,
 * so a look never locks again.
 */
export function keptLooks(): Set<LookId> {
  try {
    const raw = localStorage.getItem(KEPT_KEY);
    if (raw !== null) {
      const v: unknown = JSON.parse(raw);
      return new Set(Array.isArray(v) ? v.filter(isLook) : []);
    }
    const first = new Set([familyOf(loadStyle()).id]);
    localStorage.setItem(KEPT_KEY, JSON.stringify([...first]));
    return first;
  } catch {
    return new Set([familyOf(loadStyle()).id]);
  }
}

/** Keeps looks open on this device for good. */
export function keepLooks(ids: Iterable<LookId>): void {
  const kept = keptLooks();
  const before = kept.size;
  for (const id of ids) kept.add(id);
  if (kept.size === before) return;
  try {
    localStorage.setItem(KEPT_KEY, JSON.stringify([...kept]));
  } catch {
    // per-device convenience only
  }
}

/** A look's version that matches the one in use now: dark if that's dark (or Classic matching a dark phone), else light. */
export function versionLike(f: StyleFamily, current: StyleId, phoneDark: boolean): StyleId {
  const dark = current === "classic" ? phoneDark : LOOKS[current].theme === "dark";
  return dark ? f.dark : f.light;
}

/**
 * What Settings needs to draw a small preview of each version in its own colours and fonts
 * without loading its stylesheet over the active one: a handful of its tokens, copied from the
 * stylesheets (style.test.ts checks them against the real ones), and how it paints its main button.
 */
export interface LookPreview {
  tokens: Partial<Record<PreviewToken, string>>;
  /** The main button's background, from the tokens above. */
  button: string;
  buttonRadius: string;
  headWeight: number;
  /** Headings in capitals. */
  caps?: boolean;
}

export type PreviewToken =
  | "--bg" | "--card" | "--ink" | "--muted" | "--line" | "--accent" | "--accent-ink" | "--accent-line" | "--chart"
  | "--chrome" | "--chrome-ink" | "--font-display" | "--font-body" | "--radius"
  | "--button-top" | "--gold-low" | "--button-lo" | "--button-hi";

const BLUEBIRD_BODY = '"Liberation Sans", Arial, Helvetica, sans-serif';
const CLASSIC_FONTS = {
  "--font-display": '"Newsreader", "Iowan Old Style", "Palatino Linotype", Georgia, serif',
  "--font-body": '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  "--radius": "16px",
} as const;

export const PREVIEWS: Record<Exclude<StyleId, "classic">, LookPreview> = {
  "bluebird-light": {
    tokens: { "--bg": "#eaf1fb", "--card": "#fffef8", "--ink": "#18263c", "--muted": "#536174", "--line": "#c0cbda", "--accent": "#286b32", "--accent-ink": "#ffffff", "--accent-line": "#56834b", "--chart": "#1f5ebd", "--chrome": "#1754b8", "--chrome-ink": "#ffffff", "--font-display": BLUEBIRD_BODY, "--font-body": BLUEBIRD_BODY, "--radius": "8px", "--button-top": "#34793d" },
    button: "linear-gradient(var(--button-top), var(--accent))", buttonRadius: "var(--radius)", headWeight: 700,
  },
  "bluebird-dark": {
    tokens: { "--bg": "#0e1726", "--card": "#17253b", "--ink": "#edf3ff", "--muted": "#b2c2db", "--line": "#344965", "--accent": "#87d797", "--accent-ink": "#082411", "--accent-line": "#74ac83", "--chart": "#89b8ff", "--chrome": "#244a89", "--chrome-ink": "#ffffff", "--font-display": BLUEBIRD_BODY, "--font-body": BLUEBIRD_BODY, "--radius": "8px", "--button-top": "#a3e5ad" },
    button: "linear-gradient(var(--button-top), var(--accent))", buttonRadius: "var(--radius)", headWeight: 700,
  },
  "forge-light": {
    tokens: { "--bg": "#f0ece5", "--card": "#fffcf6", "--ink": "#26211e", "--muted": "#665c54", "--line": "#cdc0b2", "--accent": "#a43f15", "--accent-ink": "#ffffff", "--accent-line": "#a25731", "--chart": "#a74318", "--chrome": "#302721", "--chrome-ink": "#fff4e6", "--font-display": '"Liberation Sans Narrow", "Arial Narrow", "Archivo Narrow", sans-serif', "--font-body": BLUEBIRD_BODY, "--radius": "3px" },
    button: "var(--accent)", buttonRadius: "var(--radius)", headWeight: 700,
  },
  "forge-dark": {
    tokens: { "--bg": "#12100f", "--card": "#211c19", "--ink": "#fff1e5", "--muted": "#c8b7a7", "--line": "#493a30", "--accent": "#ff9b54", "--accent-ink": "#2d1408", "--accent-line": "#c58354", "--chart": "#ffad6b", "--chrome": "#302721", "--chrome-ink": "#fff4e6", "--font-display": '"Liberation Sans Narrow", "Arial Narrow", "Archivo Narrow", sans-serif', "--font-body": BLUEBIRD_BODY, "--radius": "3px" },
    button: "var(--accent)", buttonRadius: "var(--radius)", headWeight: 700,
  },
  "pixel-light": {
    tokens: { "--bg": "#f2f0ff", "--card": "#ffffff", "--ink": "#24213d", "--muted": "#605a78", "--line": "#cbc4df", "--accent": "#6535bf", "--accent-ink": "#ffffff", "--accent-line": "#8359b5", "--chart": "#00777d", "--chrome": "#ffffff", "--chrome-ink": "#24213d", "--font-display": '"Pixel Press 5x7", ui-monospace, monospace', "--font-body": BLUEBIRD_BODY, "--radius": "0px" },
    button: "var(--accent)", buttonRadius: "var(--radius)", headWeight: 400, caps: true,
  },
  "pixel-dark": {
    tokens: { "--bg": "#121226", "--card": "#20203b", "--ink": "#f5f0ff", "--muted": "#bbb4d3", "--line": "#44415f", "--accent": "#c1a3ff", "--accent-ink": "#251340", "--accent-line": "#a88cd2", "--chart": "#61ddcc", "--chrome": "#20203b", "--chrome-ink": "#f5f0ff", "--font-display": '"Pixel Press 5x7", ui-monospace, monospace', "--font-body": BLUEBIRD_BODY, "--radius": "0px" },
    button: "var(--accent)", buttonRadius: "var(--radius)", headWeight: 400, caps: true,
  },
  "gold-light": {
    tokens: { "--bg": "#f5f1e8", "--card": "#fffdf6", "--ink": "#242218", "--muted": "#68604e", "--line": "#d8ceb8", "--accent": "#d7b85e", "--accent-ink": "#251e0b", "--accent-line": "#97772a", "--chart": "#82601b", "--chrome": "#fffdf6", "--chrome-ink": "#242218", "--font-display": '"Cinzel", Georgia, serif', "--font-body": '"Manrope", system-ui, sans-serif', "--radius": "0px", "--button-top": "#f5e5ad", "--gold-low": "#c5a24a" },
    button: "linear-gradient(90deg, var(--gold-low), var(--button-top) 50%, var(--accent))", buttonRadius: "var(--radius)", headWeight: 600,
  },
  "gold-dark": {
    tokens: { "--bg": "#10110f", "--card": "#1b1d19", "--ink": "#f5f0df", "--muted": "#beb8a4", "--line": "#3c3d30", "--accent": "#e8cb79", "--accent-ink": "#251e0b", "--accent-line": "#b3984e", "--chart": "#e6c875", "--chrome": "#1b1d19", "--chrome-ink": "#f5f0df", "--font-display": '"Cinzel", Georgia, serif', "--font-body": '"Manrope", system-ui, sans-serif', "--radius": "0px", "--button-top": "#fff0bf", "--gold-low": "#d5b45f" },
    button: "linear-gradient(90deg, var(--gold-low), var(--button-top) 50%, var(--accent))", buttonRadius: "var(--radius)", headWeight: 600,
  },
  "diamond-light": {
    tokens: { "--bg": "#f0f2f3", "--card": "#ffffff", "--ink": "#171e25", "--muted": "#55636f", "--line": "#cbd3d9", "--accent": "#293a49", "--accent-ink": "#ffffff", "--accent-line": "#6f8294", "--chart": "#365d7f", "--chrome": "#151c24", "--chrome-ink": "#f4f8fc", "--font-display": '"Bodoni Moda", Georgia, serif', "--font-body": '"Hanken Grotesk", system-ui, sans-serif', "--radius": "0px", "--button-lo": "#18212a", "--button-hi": "#445361" },
    button: "linear-gradient(110deg, var(--button-lo), var(--button-hi) 42%, var(--accent))", buttonRadius: "var(--radius)", headWeight: 600,
  },
  "diamond-dark": {
    tokens: { "--bg": "#080c11", "--card": "#121a23", "--ink": "#f4f8fc", "--muted": "#adbdc9", "--line": "#344351", "--accent": "#dae7f0", "--accent-ink": "#101a24", "--accent-line": "#91acbf", "--chart": "#b5daef", "--chrome": "#0d141d", "--chrome-ink": "#f4f8fc", "--font-display": '"Bodoni Moda", Georgia, serif', "--font-body": '"Hanken Grotesk", system-ui, sans-serif', "--radius": "0px", "--button-lo": "#b9c9d6", "--button-hi": "#fafcfe" },
    button: "linear-gradient(110deg, var(--button-lo), var(--button-hi) 42%, var(--accent))", buttonRadius: "var(--radius)", headWeight: 600,
  },
  // Classic has no header band of its own: its header in the preview is a plain card.
  "classic-light": {
    tokens: { "--bg": "#f4f5f2", "--card": "#ffffff", "--ink": "#161a17", "--muted": "#6a726c", "--line": "#e3e6e1", "--accent": "#1e5b3b", "--accent-ink": "#ffffff", "--accent-line": "#c5d8cb", "--chart": "#2b7a4e", ...CLASSIC_FONTS },
    button: "var(--accent)", buttonRadius: "999px", headWeight: 500,
  },
  "classic-dark": {
    tokens: { "--bg": "#0e1210", "--card": "#161b18", "--ink": "#e8ece9", "--muted": "#9aa59e", "--line": "#29312c", "--accent": "#6cc495", "--accent-ink": "#0b1a12", "--accent-line": "#2c4a39", "--chart": "#46a270", ...CLASSIC_FONTS },
    button: "var(--accent)", buttonRadius: "999px", headWeight: 500,
  },
};

/** A preview's CSS variables, named --pv-… so they never touch the active look's own. */
export function previewVars(id: Exclude<StyleId, "classic">): Record<string, string> {
  const p = PREVIEWS[id];
  const t = p.tokens;
  // Resolve var(--x) against this version's own tokens.
  const own = (css: string) => css.replace(/var\((--[a-z-]+)\)/g, (_, name: PreviewToken) => t[name] ?? "transparent");
  return {
    "--pv-bg": t["--bg"]!,
    "--pv-card": t["--card"]!,
    "--pv-ink": t["--ink"]!,
    "--pv-muted": t["--muted"]!,
    "--pv-line": t["--line"]!,
    "--pv-head": t["--chrome"] ?? t["--card"]!,
    "--pv-head-ink": t["--chrome-ink"] ?? t["--ink"]!,
    "--pv-button": own(p.button),
    "--pv-button-ink": t["--accent-ink"]!,
    "--pv-button-edge": t["--accent-line"]!,
    "--pv-button-radius": own(p.buttonRadius),
    "--pv-chart": t["--chart"]!,
    "--pv-display": t["--font-display"]!,
    "--pv-body": t["--font-body"]!,
    "--pv-radius": t["--radius"]!,
    "--pv-head-weight": String(p.headWeight),
    "--pv-caps": p.caps ? "uppercase" : "none",
  };
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
