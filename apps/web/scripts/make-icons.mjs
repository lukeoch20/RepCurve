// Render the app icons from SVG with headless Chromium. Run: pnpm --filter @repcurve/web icons
// Two sets: the real app (charcoal stack on white) and the test app (the same mark, colours swapped).
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const out = resolve(dirname(fileURLToPath(import.meta.url)), "../public");
const INK = "#2a2e33";
const WHITE = "#ffffff";
// The mark on a 100 × 100 grid: three rising blocks joined by short bars. Keep in step with CurveMark in src/ui/common.tsx.
const MARK =
  `<rect x="9" y="40" width="22" height="34.5" rx="5.8"/>` +
  `<rect x="30" y="52.8" width="7.8" height="7.1"/>` +
  `<rect x="36.8" y="29" width="23.8" height="46.8" rx="6"/>` +
  `<rect x="59.6" y="52.8" width="8.1" height="7.1"/>` +
  `<rect x="66.7" y="17.6" width="24.3" height="64.8" rx="6.5"/>`;

const sets = [
  { prefix: "", bg: WHITE, fg: INK },
  { prefix: "test-", bg: INK, fg: WHITE },
];

// Full-bleed square art; the OS rounds the corners. `inset` < 1 keeps the mark inside the maskable safe zone.
const art = ({ bg, fg }, inset) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">` +
  `<rect width="100" height="100" fill="${bg}"/>` +
  `<g fill="${fg}" transform="translate(50 50) scale(${inset}) translate(-50 -50)">${MARK}</g></svg>`;

// The browser-tab icon keeps its own rounded corners. The white one has a hairline so it doesn't vanish on a white tab bar.
const favicon = ({ bg, fg }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="1.5" y="1.5" width="97" height="97" rx="24" fill="${bg}" stroke="${bg === WHITE ? "#c9ced4" : bg}" stroke-width="3"/>` +
  `<g fill="${fg}" transform="translate(50 50) scale(0.82) translate(-50 -50)">${MARK}</g></svg>\n`;

const browser = await chromium.launch();
const page = await browser.newPage();
for (const set of sets) {
  writeFileSync(resolve(out, `${set.prefix}favicon.svg`), favicon(set));
  for (const [name, size, inset] of [
    ["apple-touch-icon.png", 180, 0.78],
    ["icon-192.png", 192, 0.78],
    ["icon-512.png", 512, 0.78],
    ["icon-512-maskable.png", 512, 0.62],
  ]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0">${art(set, inset).replace("<svg", `<svg width="${size}" height="${size}"`)}</body></html>`);
    await page.screenshot({ path: resolve(out, set.prefix + name) });
    console.log("wrote", set.prefix + name);
  }
}
await browser.close();
