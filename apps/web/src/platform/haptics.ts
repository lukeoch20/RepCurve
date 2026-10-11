/**
 * A little buzz when you finish a set, and a bigger one when you finish a session.
 *
 * Android: the Vibration API. iPhone has no web vibration API, but since iOS 18 Safari taps
 * the haptic engine when a switch-style checkbox is toggled, so a hidden one stands in. It only
 * works inside a tap (which is when we call it), and gives one light tick rather than a pattern.
 * Best effort: on anything else this does nothing.
 */

let iosSwitch: HTMLLabelElement | null = null;

function iosTick(): void {
  if (typeof document === "undefined") return;
  if (!iosSwitch) {
    const label = document.createElement("label");
    label.setAttribute("aria-hidden", "true");
    label.style.display = "none";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    iosSwitch = label;
  }
  iosSwitch.click();
}

export type Haptic = "set" | "session";

export function haptic(kind: Haptic): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(kind === "set" ? 30 : [40, 70, 40, 70, 120]);
      return;
    }
    iosTick();
    // A session gets a short run of ticks; the first is inside the tap, the rest best effort.
    if (kind === "session") {
      window.setTimeout(iosTick, 120);
      window.setTimeout(iosTick, 240);
    }
  } catch {
    // haptics are a nicety
  }
}
