import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STYLES, type StyleId } from "./style";

/**
 * Every look keeps text readable: the colour tokens each style sets on the page, read from the
 * stylesheets the way the browser cascades them, meet WCAG AA contrast (4.5:1 for text, 3:1 for
 * control edges).
 */

const SRC = new URL("../", import.meta.url);
/** Stylesheets in the order main.tsx loads them: styles.css (Classic) first, then each artist's. */
const SHEETS = ["styles.css", ...readdirSync(SRC).filter((f) => f.endsWith(".css") && f !== "styles.css").sort()];

type Tokens = Record<string, string>;
interface Rule { selector: string; tokens: Tokens; darkMedia: boolean }

function declarations(body: string): Tokens {
  const out: Tokens = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]!] = m[2]!.trim();
  return out;
}

/** Top-level rules, and the rules inside `@media (prefers-color-scheme: dark)`, in source order. */
function rules(css: string): Rule[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: Rule[] = [];
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf("{", i);
    if (open < 0) break;
    const head = text.slice(i, open).trim();
    // Find the matching close brace.
    let depth = 1;
    let j = open + 1;
    while (j < text.length && depth > 0) {
      if (text[j] === "{") depth++;
      else if (text[j] === "}") depth--;
      j++;
    }
    const body = text.slice(open + 1, j - 1);
    if (head.startsWith("@media")) {
      if (/prefers-color-scheme:\s*dark/.test(head)) for (const r of rules(body)) out.push({ ...r, darkMedia: true });
    } else if (!head.startsWith("@")) {
      out.push({ selector: head.replace(/\s+/g, " "), tokens: declarations(body), darkMedia: false });
    }
    i = j;
  }
  return out;
}

const ALL = SHEETS.flatMap((f) => rules(readFileSync(new URL(f, SRC), "utf8")));

/** The root tokens for a look, as the cascade resolves them (equal specificity: later wins). */
function tokensFor(style: string | null, theme: "light" | "dark", auto: boolean): Tokens {
  const applies = (r: Rule, selector: string): boolean => {
    for (const s of selector.split(",").map((x) => x.trim())) {
      if (s === ":root") return true;
      if (theme === "dark" && !auto && s === ':root[data-theme="dark"]') return true;
      if (theme === "dark" && r.darkMedia && s === ':root:not([data-theme="light"])') return true;
      if (style && s === `:root[data-style="${style}"]`) return true;
      if (style && theme === "dark" && s === `:root[data-style="${style}"][data-theme="dark"]`) return true;
    }
    return false;
  };
  // More specific selectors (style and theme together) win over source order.
  const weight = (s: string) => (s.match(/\[/g) ?? []).length;
  const matching = ALL.filter((r) => applies(r, r.selector)).map((r, order) => ({ r, order }));
  matching.sort((a, b) => weight(a.r.selector) - weight(b.r.selector) || a.order - b.order);
  return Object.assign({}, ...matching.map(({ r }) => r.tokens)) as Tokens;
}

function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Not a #rrggbb colour: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((k) => parseInt(m[1]!.slice(k, k + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const PAIRS: [fg: string, bg: string, min: number][] = [
  ["--ink", "--card", 4.5],
  ["--ink", "--bg", 4.5],
  ["--muted", "--card", 4.5],
  ["--accent-ink", "--accent", 4.5],
  ["--stop", "--stop-wash", 4.5],
  ["--warn", "--warn-wash", 4.5],
  ["--control-line", "--card", 3],
];

/** Each look-and-version to check: its data-style, and light, dark or both (Classic matching the phone). */
function versions(id: StyleId): { style: string | null; theme: "light" | "dark"; auto: boolean }[] {
  if (id === "classic") return [{ style: null, theme: "light", auto: true }, { style: null, theme: "dark", auto: true }];
  const [family, theme] = id.split("-") as [string, "light" | "dark"];
  return [{ style: family === "classic" ? null : family, theme, auto: false }];
}

describe("colour contrast in every style", () => {
  it("measures contrast as WCAG does", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(contrast("#ffffff", "#777777")).toBeCloseTo(4.48, 2);
  });

  it("reads each style's tokens from the stylesheets", () => {
    expect(STYLES.length).toBeGreaterThanOrEqual(13);
    for (const s of STYLES) for (const v of versions(s.id)) expect(tokensFor(v.style, v.theme, v.auto)["--ink"], s.id).toMatch(/^#/);
    // Dark versions really are dark.
    expect(luminance(tokensFor("bluebird", "dark", false)["--bg"]!)).toBeLessThan(0.05);
    expect(luminance(tokensFor(null, "dark", true)["--bg"]!)).toBeLessThan(0.05);
    expect(luminance(tokensFor("bluebird", "light", false)["--bg"]!)).toBeGreaterThan(0.5);
  });

  for (const s of STYLES) {
    for (const v of versions(s.id)) {
      const name = v.auto ? `${s.name} (${v.theme})` : s.name;
      it(`${name}: text and controls meet WCAG AA`, () => {
        const t = tokensFor(v.style, v.theme, v.auto);
        const failures: string[] = [];
        for (const [fg, bg, min] of PAIRS) {
          // Classic draws control edges with --line and doesn't set --control-line.
          if (!t[fg] || !t[bg]) {
            expect(fg, `${name} is missing ${fg} or ${bg}`).toBe("--control-line");
            continue;
          }
          const ratio = contrast(t[fg]!, t[bg]!);
          if (ratio < min) failures.push(`${fg} ${t[fg]} on ${bg} ${t[bg]}: ${ratio.toFixed(2)} (needs ${min})`);
        }
        expect(failures).toEqual([]);
      });
    }
  }
});
