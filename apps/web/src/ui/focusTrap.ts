import React, { useEffect, useRef } from "react";

/**
 * Keep keyboard focus inside a dialog while it's open, as a modal should: focus moves to its
 * first control (or `initialFocus`) when it opens, Tab and Shift+Tab cycle through its controls
 * only, Escape calls `onEscape` when the dialog has a close action, and focus goes back to
 * whatever opened it when it closes. Only the topmost open dialog responds.
 */

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(",");

/** Open dialogs, topmost last. */
const open: HTMLElement[] = [];

/** The controls Tab reaches inside `root`, in order. Hidden ones are left out. */
export function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.closest("[hidden], [inert]") && el.getClientRects().length > 0);
}

export function useFocusTrap(
  ref: React.RefObject<HTMLElement>,
  options: {
    onEscape?: () => void;
    /** Focused on open instead of the first control. */
    initialFocus?: React.RefObject<HTMLElement>;
    /** Focus moves in again when this changes (new content in the same dialog). */
    contentKey?: unknown;
  } = {},
): void {
  const onEscape = useRef(options.onEscape);
  onEscape.current = options.onEscape;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    open.push(dialog);
    const topmost = () => open[open.length - 1] === dialog;

    const onKey = (e: KeyboardEvent) => {
      if (!topmost()) return;
      if (e.key === "Escape" && onEscape.current) {
        e.preventDefault();
        onEscape.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables(dialog);
      const active = document.activeElement;
      if (items.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (!(active instanceof Node) || !dialog.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && (active === first || active === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    // Focus that lands outside (a screen reader's own navigation, say) comes back in.
    const onFocusIn = (e: FocusEvent) => {
      if (!topmost() || !(e.target instanceof Node) || dialog.contains(e.target)) return;
      (focusables(dialog)[0] ?? dialog).focus({ preventScroll: true });
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocusIn);
      const at = open.indexOf(dialog);
      if (at >= 0) open.splice(at, 1);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
    // Set up once per dialog: the opener is whatever had focus when it opened.
  }, []);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const target = options.initialFocus?.current ?? focusables(dialog)[0] ?? dialog;
    target.focus({ preventScroll: true });
  }, [options.contentKey]);
}
