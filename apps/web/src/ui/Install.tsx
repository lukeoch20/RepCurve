import React, { useEffect, useState } from "react";
import { canSuggestInstall, installPromptReady, iosBrowser, isIOS, onInstallPromptChange, promptInstall } from "../platform/install";
import { Icon } from "./common";

/** The Safari share icon, drawn so the instructions match what's on screen. */
function ShareGlyph(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Share" role="img" style={{ verticalAlign: "-2px" }}>
      <path d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
    </svg>
  );
}

/**
 * How to put RepCurve on the home screen. Shown only in the installable build when it's open
 * in a browser tab. `beforeSetup` adds the reason to install first: home-screen apps keep
 * their own storage, separate from the browser.
 */
export function InstallCard(props: { beforeSetup?: boolean }): React.ReactElement | null {
  const [, refresh] = useState(0);
  useEffect(() => onInstallPromptChange(() => refresh((n) => n + 1)), []);
  if (!canSuggestInstall()) return null;
  const ios = isIOS();
  const browser = ios ? iosBrowser() : null;
  return (
    <section className="card tint stack" aria-label="Install RepCurve">
      <div className="row" style={{ gap: 10 }}>
        <Icon name="today" size={20} />
        <b style={{ fontWeight: 600 }}>Put RepCurve on your home screen</b>
      </div>
      {ios && browser !== "safari" ? (
        <p className="meta small" style={{ color: "var(--ink)" }}>
          {browser === "in-app"
            ? "This app's built-in browser can't add RepCurve to your home screen. Open this page in Safari (look for \"Open in Safari\" in the ••• menu), then follow the steps there."
            : "Open this page in Safari to add it to your home screen: other iPhone browsers can't do it reliably."}
        </p>
      ) : ios ? (
        <ol className="howto-steps" style={{ fontSize: "0.92rem" }}>
          <li>Tap the Share button <ShareGlyph /> in Safari's toolbar (on newer iPhones it may be under the ••• button).</li>
          <li>Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.</li>
          <li>Open RepCurve from its new icon.</li>
        </ol>
      ) : installPromptReady() ? (
        <button type="button" className="btn primary" style={{ alignSelf: "flex-start" }} onClick={() => void promptInstall()}>
          Install app
        </button>
      ) : (
        <p className="meta small" style={{ color: "var(--ink)" }}>Use your browser's menu and choose Install app or Add to Home Screen.</p>
      )}
      <p className="meta small">
        {props.beforeSetup
          ? "Do this before setting up: the home-screen app keeps its own saved data, separate from this browser tab. It then opens full screen and works offline."
          : "It opens full screen, works offline, and your phone won't clear its data when you go a while without opening it. Data here in the browser doesn't move across, so export a backup first and import it in the app."}
      </p>
    </section>
  );
}
