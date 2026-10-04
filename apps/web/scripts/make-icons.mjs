// Render the app icons from SVG with headless Chromium. Run: pnpm --filter @repcurve/web icons
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const out = resolve(dirname(fileURLToPath(import.meta.url)), "../public");

// Full-bleed square art; rounded corners are added by the OS. Maskable keeps the mark in the safe zone.
const art = (scale) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
  <rect width="100" height="100" fill="#1f4fc0"/>
  <g transform="translate(50 50) scale(${scale}) translate(-50 -50)">
    <line x1="18" y1="80" x2="84" y2="80" stroke="#ffffff" stroke-opacity="0.28" stroke-width="3" stroke-linecap="round"/>
    <path d="M18 76 C 36 74, 44 62, 52 48 S 68 24, 82 21" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round"/>
    <circle cx="82" cy="21" r="7.5" fill="#ffffff"/>
  </g>
</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, scale] of [
  ["apple-touch-icon.png", 180, 1],
  ["icon-192.png", 192, 1],
  ["icon-512.png", 512, 1],
  ["icon-512-maskable.png", 512, 0.78],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${art(scale)}</body></html>`);
  await page.screenshot({ path: resolve(out, name), omitBackground: false });
  console.log("wrote", name);
}
await browser.close();
