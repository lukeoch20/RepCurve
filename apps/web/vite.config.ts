import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Two builds from one codebase:
// - default: an installable web app (bundled React, service worker for offline use, on-device storage)
// - "artifact": a single page for claude.ai (React from cdnjs, no service worker, account storage)
export default defineConfig(({ mode }) => {
  const artifact = mode === "artifact";
  return {
    base: "./",
    esbuild: { jsx: "transform", jsxFactory: "React.createElement", jsxFragment: "React.Fragment" },
    define: { __RUNTIME__: JSON.stringify(artifact ? "artifact" : "pwa") },
    build: artifact
      ? {
          outDir: "dist-artifact",
          emptyOutDir: true,
          cssCodeSplit: false,
          rollupOptions: {
            input: "src/main.tsx",
            external: ["react", "react-dom", "react-dom/client", "virtual:pwa-register"],
            output: {
              format: "iife",
              entryFileNames: "app.js",
              assetFileNames: "app[extname]",
              inlineDynamicImports: true,
              globals: { react: "React", "react-dom": "ReactDOM", "react-dom/client": "ReactDOM", "virtual:pwa-register": "undefined" },
            },
          },
        }
      : { outDir: "dist", emptyOutDir: true },
    plugins: artifact
      ? []
      : [
          VitePWA({
            registerType: "autoUpdate",
            injectRegister: null,
            includeAssets: ["favicon.svg", "apple-touch-icon.png"],
            manifest: {
              name: "RepCurve",
              short_name: "RepCurve",
              description: "Short home workouts that pick your weights and adapt every session.",
              start_url: "./",
              scope: "./",
              display: "standalone",
              background_color: "#eef1ee",
              theme_color: "#1f4fc0",
              icons: [
                { src: "icon-192.png", sizes: "192x192", type: "image/png" },
                { src: "icon-512.png", sizes: "512x512", type: "image/png" },
                { src: "icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
              ],
            },
            workbox: {
              globPatterns: ["**/*.{js,css,html,svg,png}"],
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
