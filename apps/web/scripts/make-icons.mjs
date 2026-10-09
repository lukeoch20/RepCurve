// Render the app icons from SVG with headless Chromium. Run: pnpm --filter @repcurve/web icons
// Two sets: the real app (white curve on green) and the test app (the same mark, colours swapped).
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const out = resolve(dirname(fileURLToPath(import.meta.url)), "../public");
const GREEN = "#1e5b3b";
const WHITE = "#ffffff";
const CURVE = "M6 24 C 12 23, 15 19, 17 15 S 22 8, 26 7";

const sets = [
  { prefix: "", bg: GREEN, fg: WHITE },
  { prefix: "test-", bg: WHITE, fg: GREEN },
];

// Full-bleed square art; the OS rounds the corners. `inset` < 1 keeps the mark inside the maskable safe zone.
const art = ({ bg, fg }, inset) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="100%" height="100%">` +
  `<rect width="32" height="32" fill="${bg}"/>` +
  `<g transform="translate(16 16) scale(${inset}) translate(-16 -16)"><path d="${CURVE}" fill="none" stroke="${fg}" stroke-width="2.6" stroke-linecap="round"/></g></svg>`;

// The browser-tab icon keeps its own rounded corners. The test one has a hairline so white doesn't vanish on white.
const favicon = ({ bg, fg }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill="${bg}" stroke="${bg === WHITE ? GREEN : bg}" stroke-width="1"/><path d="${CURVE}" fill="none" stroke="${fg}" stroke-width="2.6" stroke-linecap="round"/></svg>\n`;

const browser = await chromium.launch();
const page = await browser.newPage();
for (const set of sets) {
  writeFileSync(resolve(out, `${set.prefix}favicon.svg`), favicon(set));
  for (const [name, size, inset] of [
    ["apple-touch-icon.png", 180, 0.9],
    ["icon-192.png", 192, 0.9],
    ["icon-512.png", 512, 0.9],
    ["icon-512-maskable.png", 512, 0.68],
  ]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0">${art(set, inset).replace("<svg", `<svg width="${size}" height="${size}"`)}</body></html>`);
    await page.screenshot({ path: resolve(out, set.prefix + name) });
    console.log("wrote", set.prefix + name);
  }
}
await browser.close();
