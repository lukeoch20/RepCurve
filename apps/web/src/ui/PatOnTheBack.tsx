import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { Cheer } from "../model/cheer";
import { useFocusTrap } from "./focusTrap";

/** How long a pat on the back stays up before getting out of the way, ms. The last one stays. */
export const PAT_MS = 6000;

/**
 * A pat on the back when an exercise is done: a cheer, something fun and a number to be proud
 * of. Tap anywhere, Escape or "Keep going" to close; it also steps aside on its own after a few
 * seconds, so the rest of the workout isn't held up. After the last exercise it waits, with a
 * way to finish.
 */
export function PatOnTheBack(props: { cheer: Cheer; onClose: () => void; onFinish: () => void }): React.ReactElement {
  const { cheer } = props;
  const card = useRef<HTMLDivElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  useFocusTrap(card, { onEscape: props.onClose, initialFocus: primary, contentKey: cheer.headline + cheer.line });

  const onClose = useRef(props.onClose);
  onClose.current = props.onClose;
  useEffect(() => {
    if (cheer.lastOne) return;
    const t = window.setTimeout(() => onClose.current(), PAT_MS);
    return () => window.clearTimeout(t);
  }, [cheer]);

  return createPortal(
    <div className="scrim pat-scrim" onClick={props.onClose}>
      <div
        ref={card}
        tabIndex={-1}
        className={`card pat pat-${cheer.kind}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pat-title"
        aria-describedby="pat-line"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pat-confetti" aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => (
            <i key={i} style={{ "--i": i } as React.CSSProperties} />
          ))}
        </div>
        <svg className="pat-badge" viewBox="0 0 64 64" aria-hidden="true">
          <path
            d="M32 3l6.2 8.4 10.3-1.7 1.7 10.3L58.6 26 54 32l4.6 6-8.4 6.2-1.7 10.3-10.3-1.7L32 61l-6.2-8.4-10.3 1.7-1.7-10.3L5.4 38 10 32l-4.6-6 8.4-6.2 1.7-10.3 10.3 1.7z"
            className="pat-burst"
          />
          {cheer.kind === "best" ? (
            <path d="M32 18l4.1 8.4 9.2 1.3-6.7 6.5 1.6 9.2L32 39.1l-8.2 4.3 1.6-9.2-6.7-6.5 9.2-1.3z" className="pat-mark" />
          ) : (
            <path d="M21 33l7.5 7.5L44 25" className="pat-tick" />
          )}
        </svg>
        <h2 id="pat-title" className="h2 pat-title">{cheer.headline}</h2>
        <p id="pat-line" className="pat-line">{cheer.line}</p>
        {cheer.stat ? <p className="pat-stat num">{cheer.stat}</p> : null}
        <div className="pat-actions">
          {cheer.lastOne ? (
            <>
              <button ref={primary} type="button" className="btn primary" onClick={props.onFinish}>
                Finish workout
              </button>
              <button type="button" className="btn ghost" onClick={props.onClose}>
                Not yet
              </button>
            </>
          ) : (
            <button ref={primary} type="button" className="btn primary" onClick={props.onClose}>
              Keep going
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
