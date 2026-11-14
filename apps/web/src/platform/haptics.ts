/**
 * Small buzzes: a tick when a main button is tapped, a bigger one when a set or a session is done.
 *
 * Android: the Vibration API, called from code.
 *
 * iPhone has no vibration API. The one thing in a web page that reaches its haptic engine is a
 * native switch (<input type="checkbox" switch>, Safari 17.4) toggled by the person's own tap.
 * WebKit plays the tick only for a click it trusts, made during a touch, so since iOS 26.5 a
 * toggle made from code is silent, and nothing in this file can tick an iPhone. The controls that
 * should tick carry <TapTick/> instead (ui/TapTick.tsx): a see-through label over the control
 * with a hidden switch inside it. The finger lands on the label, WebKit hands that tap to the
 * switch as the person's own click, and the phone ticks. It is one light tick, always the same,
 * and only ever from a tap: an iPhone can't be buzzed by a timer.
 */

export type Ticks = "vibrate" | "switch" | "none";

/** What a device can do. "switch" is the iPhone route; iPads are left out, having no haptic engine. */
export function ticksFor(env: { vibrate: boolean; switchControl: boolean; userAgent: string }): Ticks {
  if (env.vibrate) return "vibrate";
  return env.switchControl && /iPhone|iPod/.test(env.userAgent) ? "switch" : "none";
}

export const TICKS: Ticks =
  typeof navigator === "undefined" || typeof document === "undefined"
    ? "none"
    : ticksFor({
        vibrate: typeof navigator.vibrate === "function",
        switchControl: typeof HTMLInputElement !== "undefined" && "switch" in HTMLInputElement.prototype,
        userAgent: navigator.userAgent ?? "",
      });

export type Haptic = "tap" | "set" | "session";

/** Milliseconds: short enough to feel like a click rather than a buzz. */
export const PULSE: Record<Haptic, number | number[]> = { tap: 15, set: 30, session: [40, 70, 40, 70, 120] };

let on = true;
// A set or session buzz went out while the tap in hand was being handled.
let buzzed = false;
let waiting = false;

/** Follows the Vibration setting. Off also hides the iPhone tap labels (styles.css). */
export function setHaptics(enabled: boolean, doc: Document | null = typeof document === "undefined" ? null : document): void {
  on = enabled;
  if (!doc) return;
  if (enabled) delete doc.documentElement.dataset["haptics"];
  else doc.documentElement.dataset["haptics"] = "off";
}

/** Android only: see the note above for iPhone. */
export function haptic(kind: Haptic, vibrate: ((pattern: number | number[]) => unknown) | null = TICKS === "vibrate" ? (p) => navigator.vibrate(p) : null): void {
  if (!on || !vibrate) return;
  if (kind !== "tap") buzzed = true;
  try {
    vibrate(PULSE[kind]);
  } catch {
    // haptics are a nicety
  }
}

/**
 * One tap, one buzz. A tap on a control that carries <TapTick/> gets the short pulse, unless
 * handling that tap already buzzed for a set or a session. `after` runs its callback once the
 * tap's own handlers have finished.
 */
export function tapPulse(after: (run: () => void) => void, buzz: () => void = () => haptic("tap")): void {
  if (waiting) return; // a label passing its click on to a checkbox is still the same tap
  waiting = true;
  buzzed = false;
  after(() => {
    waiting = false;
    if (!buzzed) buzz();
  });
}

/** True for a control that should pulse when clicked: it holds a tap mark and isn't switched off. */
export function carriesTick(target: EventTarget | null): boolean {
  const host = typeof Element !== "undefined" && target instanceof Element ? target.closest("button, .toggle") : null;
  return !!host && !host.matches(":disabled, [aria-disabled='true']") && host.querySelector(":scope > .tap-mark") !== null;
}

/** Android: listen for taps on the controls that carry <TapTick/>. Call once, at startup. */
export function startTapPulses(doc: Document = document): void {
  if (TICKS !== "vibrate") return;
  doc.addEventListener(
    "click",
    (e) => {
      if (carriesTick(e.target)) tapPulse((run) => window.setTimeout(run, 0));
    },
    true,
  );
}
