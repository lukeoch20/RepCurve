import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { setUpdateReady } from "./platform/update";
import "./styles.css";

declare const __RUNTIME__: "pwa" | "artifact";

createRoot(document.getElementById("root")!).render(<App />);

if (__RUNTIME__ === "pwa" && "serviceWorker" in navigator && import.meta.env.PROD) {
  void import("virtual:pwa-register")
    .then(({ registerSW }) => {
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh: () => setUpdateReady(() => updateSW(true)),
        // A home-screen app resumes without reloading, so look for a new version whenever it
        // comes back to the foreground, and hourly while it stays open.
        onRegisteredSW: (_url, registration) => {
          if (!registration) return;
          const check = () => void registration.update().catch(() => {});
          document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") check();
          });
          setInterval(check, 60 * 60 * 1000);
        },
      });
    })
    .catch(() => {
      // offline support is a bonus; the app works without it
    });
}
