/**
 * Installing the web app to the home screen. iPhone Safari has no install prompt, so the app
 * explains Share → Add to Home Screen itself; Chrome and Edge offer a prompt we can trigger.
 */
declare const __RUNTIME__: "pwa" | "artifact";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPrompt;
    for (const l of listeners) l();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    for (const l of listeners) l();
  });
}

/** Running from the home screen (or as an installed desktop app). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches === true;
}

/** iPhone or iPad, including iPads that report themselves as a Mac. */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

/** Whether to suggest installing: the installable build, opened in a browser tab. */
export function canSuggestInstall(): boolean {
  return __RUNTIME__ === "pwa" && !isStandalone();
}

export function installPromptReady(): boolean {
  return deferred !== null;
}

export function onInstallPromptChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Show the browser's own install prompt where there is one. */
export async function promptInstall(): Promise<boolean> {
  const d = deferred;
  if (!d) return false;
  deferred = null;
  await d.prompt();
  const { outcome } = await d.userChoice;
  for (const l of listeners) l();
  return outcome === "accepted";
}
