// Assemble the claude.ai page from the "artifact" Vite build: one HTML file with the app's CSS and JS inline,
// React bundled in (no third-party scripts to trust), and no document wrapper tags (the Artifact publisher adds its own skeleton).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist-artifact");
const css = readFileSync(resolve(dist, "app.css"), "utf8");
const js = readFileSync(resolve(dist, "app.js"), "utf8").replace(/<\/script/gi, "<\\/script");

const fonts =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap";

const html = `<title>RepCurve</title>
<meta name="description" content="Short home workouts that pick your weights and adapt every session.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fonts}">
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
