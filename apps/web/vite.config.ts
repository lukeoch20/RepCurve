import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Builds from one codebase:
// - default: the installable web app (bundled React, service worker for offline use, on-device storage)
// - "staging": the same app as "RepCurve Test", built into dist/test so it's served at /test/ beside
//   the real one, with its own name, inverted icon and storage. New features land here first.
// - "artifact": a single page for claude.ai (React bundled in, no service worker, account storage)

/** The installed app's name and icons, and the page title and icons in index.html. */
function appIdentity(test: boolean): Plugin {
  return {
    name: "repcurve-identity",
    transformIndexHtml(html) {
      if (!test) return html;
      return html
        .replace("<title>RepCurve</title>", "<title>RepCurve Test</title>")
        .replace('content="RepCurve" />', 'content="RepCurve Test" />')
        .replace('href="./favicon.svg"', 'href="./test-favicon.svg"')
        .replace('href="./apple-touch-icon.png"', 'href="./test-apple-touch-icon.png"');
    },
  };
}

export default defineConfig(({ mode }) => {
  const artifact = mode === "artifact";
  const test = mode === "staging";
  const icon = (name: string) => (test ? `test-${name}` : name);
  return {
    base: "./",
    esbuild: { jsx: "transform", jsxFactory: "React.createElement", jsxFragment: "React.Fragment" },
    define: {
      __RUNTIME__: JSON.stringify(artifact ? "artifact" : "pwa"),
      __CHANNEL__: JSON.stringify(test ? "test" : "main"),
    },
    build: artifact
      ? {
          outDir: "dist-artifact",
          emptyOutDir: true,
          cssCodeSplit: false,
          rollupOptions: {
            input: "src/main.tsx",
            external: ["virtual:pwa-register"],
            output: {
              format: "iife",
              entryFileNames: "app.js",
              assetFileNames: "app[extname]",
              inlineDynamicImports: true,
              globals: { "virtual:pwa-register": "undefined" },
            },
          },
        }
      : { outDir: test ? "dist/test" : "dist", emptyOutDir: true },
    plugins: artifact
      ? []
      : [
          appIdentity(test),
          VitePWA({
            // Updates wait for the user (and never interrupt a session): see platform/update.ts.
            registerType: "prompt",
            injectRegister: null,
            includeAssets: [icon("favicon.svg"), icon("apple-touch-icon.png")],
            manifest: {
              name: test ? "RepCurve Test" : "RepCurve",
              short_name: test ? "RepCurve Test" : "RepCurve",
              description: "Short home workouts that pick your weights and adapt every session.",
              start_url: "./",
              scope: "./",
              display: "standalone",
              background_color: "#f4f5f2",
              theme_color: "#1e5b3b",
              icons: [
                { src: icon("icon-192.png"), sizes: "192x192", type: "image/png" },
                { src: icon("icon-512.png"), sizes: "512x512", type: "image/png" },
                { src: icon("icon-512-maskable.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
              ],
            },
            workbox: {
              globPatterns: ["**/*.{js,css,html,svg,png}"],
              // The real app's offline worker covers /RepCurve/, which contains /RepCurve/test/. It must
              // never answer for the test app: no test files cached, and test pages go to the network.
              ...(test ? {} : { globIgnores: ["test/**"], navigateFallbackDenylist: [/\/test\//] }),
              runtimeCaching: [
                {
                  urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com",
                  handler: "StaleWhileRevalidate",
                  options: { cacheName: "fonts", expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 } },
                },
              ],
            },
          }),
        ],
  };
});
