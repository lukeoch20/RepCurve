import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { nextTip, TIPS, tipById, type TipId } from "../model/tips";
import { loadTips, saveTips, type TipsState } from "../platform/tips";
import { useFocusTrap } from "./focusTrap";

interface TipsApi {
  state: TipsState;
  /** Attach (or, with null, detach) the element a tip points at. */
  register: (id: TipId, el: HTMLElement | null, prev?: HTMLElement | null) => void;
  setOff: (off: boolean) => void;
  /** Show every tip again, from the start. */
  replay: () => void;
}

const TipsContext = createContext<TipsApi | null>(null);

export function useTips(): TipsApi | null {
  return useContext(TipsContext);
}

/**
 * Point tip `id` at the element this ref is attached to, while `when` holds. The tip shows
 * once, when it's the next unseen tip in tutorial order with its element on screen.
 */
export function useTip(id: TipId, when = true): (el: HTMLElement | null) => void {
  const register = useContext(TipsContext)?.register;
  const last = useRef<HTMLElement | null>(null);
  return useCallback(
    (el: HTMLElement | null) => {
      if (!register) return;
      if (el && when) {
        last.current = el;
        register(id, el);
      } else {
        register(id, null, last.current);
        last.current = null;
      }
    },
    [register, id, when],
  );
}

export function TipsProvider(props: { children: React.ReactNode }): React.ReactElement {
  const [state, setState] = useState<TipsState>(loadTips);
  const els = useRef(new Map<TipId, HTMLElement>());
  const [version, setVersion] = useState(0);

  const register = useCallback((id: TipId, el: HTMLElement | null, prev?: HTMLElement | null) => {
    const m = els.current;
    if (el) {
      if (m.get(id) === el) return;
      m.set(id, el);
    } else {
      // Only the element that registered can take the tip away again.
      if (!m.has(id) || (prev && m.get(id) !== prev)) return;
      m.delete(id);
    }
    setVersion((v) => v + 1);
  }, []);

  const save = useCallback((next: TipsState) => {
    setState(next);
    saveTips(next);
  }, []);

  const api = useMemo<TipsApi>(
    () => ({
      state,
      register,
      setOff: (off) => save({ ...state, off }),
      replay: () => save({ off: false, seen: [] }),
    }),
    [state, register, save],
  );

  return (
    <TipsContext.Provider value={api}>
      {props.children}
      <TipsLayer state={state} els={els.current} version={version} onSeen={(id) => save({ ...state, seen: [...state.seen, id] })} onSkipAll={() => save({ ...state, off: true })} />
    </TipsContext.Provider>
  );
}

const onScreen = (el: HTMLElement | undefined): el is HTMLElement => !!el && el.isConnected && el.getClientRects().length > 0;
/** A sheet or dialog is open: tips wait until it closes. */
const dialogOpen = () => document.querySelector(".sheet") !== null;

function TipsLayer(props: { state: TipsState; els: Map<TipId, HTMLElement>; version: number; onSeen: (id: TipId) => void; onSkipAll: () => void }): React.ReactElement | null {
  const { state, els } = props;
  // Re-check now and then: anchors can appear or a sheet can close without a re-render here.
  const [tick, setTick] = useState(0);
  const pending = !state.off && TIPS.some((t) => !state.seen.includes(t.id));
  useEffect(() => {
    if (!pending) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 400);
    return () => window.clearInterval(t);
  }, [pending]);

  const current = useMemo(() => {
    if (!pending || dialogOpen()) return null;
    const available = new Set([...els.entries()].filter(([, el]) => onScreen(el)).map(([id]) => id));
    return nextTip(available, new Set(state.seen), state.off);
    // `version` and `tick` re-run this when anchors change.
  }, [pending, els, state, props.version, tick]);

  const el = current ? els.get(current) : undefined;
  const rect = useAnchorRect(el, current);
  if (!current || !el || !rect) return null;
  return createPortal(<TipCard id={current} rect={rect} onSeen={() => props.onSeen(current)} onSkipAll={props.onSkipAll} />, document.body);
}

/** Fixed to the screen (the timer, the tab bar): never scrolled to. */
const FIXED = ".dock, .tabbar, .runner-head";

/** The anchor's place on screen, followed as the page scrolls. It's first scrolled to just below any sticky header. */
function useAnchorRect(el: HTMLElement | undefined, id: TipId | null): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    setRect(null);
    if (!el) return;
    if (!el.closest(FIXED)) {
      // Clear of the sticky session header, or of the status bar on pages without one.
      const header = document.querySelector(".runner-head")?.getBoundingClientRect().bottom;
      const offset = header !== undefined ? header + 16 : 56;
      window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - offset, behavior: "smooth" });
    }
    let frame = 0;
    let last = "";
    const follow = () => {
      const r = el.getBoundingClientRect();
      const key = `${Math.round(r.top)},${Math.round(r.left)},${Math.round(r.width)},${Math.round(r.height)}`;
      if (key !== last) {
        last = key;
        setRect(r);
      }
      frame = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(frame);
  }, [el, id]);
  return rect;
}

function TipCard(props: { id: TipId; rect: DOMRect; onSeen: () => void; onSkipAll: () => void }): React.ReactElement {
  const tip = tipById(props.id);
  const gotIt = useRef<HTMLButtonElement>(null);
  const { rect } = props;
  const vh = window.innerHeight;
  const pad = 6;

  const card = useRef<HTMLDivElement>(null);
  // "Got it" has focus for each tip, Tab stays on the card, and Escape counts as "Got it".
  useFocusTrap(card, { onEscape: props.onSeen, initialFocus: gotIt, contentKey: props.id });

  // The card goes on whichever side of the highlight has more room, or along the bottom
  // when neither side has enough (a tall highlight).
  const gap = pad + 10;
  const below = vh - rect.bottom - gap;
  const above = rect.top - gap;
  const place: React.CSSProperties =
    Math.max(below, above) < 200
      ? { bottom: 16 }
      : below >= above
        ? { top: rect.bottom + gap, maxHeight: below - 16 }
        : { bottom: vh - rect.top + gap, maxHeight: above - 16 };

  return (
    <div className="tip-layer">
      <div className="tip-catch" aria-hidden="true" />
      <div
        className="tip-spot"
        aria-hidden="true"
        style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
      />
      <div ref={card} tabIndex={-1} className="tip-card" role="dialog" aria-modal="true" aria-labelledby="tip-title" aria-describedby="tip-body" style={place}>
        <p className="eyebrow accent">{tip.kind === "lifting" ? "Lifting basics" : "Using RepCurve"}</p>
        <h2 id="tip-title" className="h3">{tip.title}</h2>
        <p id="tip-body" className="prose">{tip.body}</p>
        <div className="tip-actions">
          <button type="button" className="btn ghost" onClick={props.onSkipAll}>Skip all tips</button>
          <button ref={gotIt} type="button" className="btn primary" onClick={props.onSeen}>Got it</button>
        </div>
      </div>
    </div>
  );
}
