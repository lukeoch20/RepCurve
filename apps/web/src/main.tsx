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
      });
    })
    .catch(() => {
      // offline support is a bonus; the app works without it
    });
}
