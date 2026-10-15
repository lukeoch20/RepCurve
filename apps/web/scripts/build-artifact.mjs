// Assemble the claude.ai page from the "artifact" Vite build: one HTML file with the app's CSS and JS inline,
// React bundled in (no third-party scripts to trust), and no document wrapper tags (the Artifact publisher adds its own skeleton).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist-artifact");
const css = readFileSync(resolve(dist, "app.css"), "utf8");
const js = readFileSync(resolve(dist, "app.js"), "utf8").replace(/<\/script/gi, "<\\/script");

// Fonts are bundled: the artifact build inlines them into app.css as data URIs (vite.config.ts), so the page
// asks no font service for anything. Stop if any asset was left as a separate file the page could not load.
const loose = [...css.matchAll(/url\((?!["']?data:)[^)]*\)/g)].map((m) => m[0]);
if (loose.length) throw new Error(`app.css points at files that are not inline: ${loose.join(", ")}`);

const html = `<title>RepCurve</title>
<meta name="description" content="Short home workouts that pick your weights and adapt every session.">
<style>
${css}
</style>
<div id="root"></div>
<script>
${js}
</script>
`;

mkdirSync(resolve(root, "artifact"), { recursive: true });
writeFileSync(resolve(root, "artifact/repcurve.html"), html);
console.log(`artifact/repcurve.html ${(html.length / 1024).toFixed(0)} KB`);
