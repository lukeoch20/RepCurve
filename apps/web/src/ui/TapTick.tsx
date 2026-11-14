import React from "react";
import { TICKS } from "../platform/haptics";

// React doesn't know the attribute; it passes it through to the page as written.
const SWITCH = { switch: "" } as unknown as React.InputHTMLAttributes<HTMLInputElement>;

// A tap on the label reaches the control's onClick, and then the label passes the tap on to the
// switch as a second click, which comes up through the control again. That second click must not
// run onClick twice. Any other click on the switch has to get through: a screen reader's
// "activate" goes straight to the switch, and that is the only click the control will see.
let passingOn = false;
const fromLabel = (e: React.MouseEvent<HTMLLabelElement>): void => {
  if (e.target !== e.currentTarget) return;
  passingOn = true;
  // The tap may have taken the control off the page before the label passes it on: forget it then.
  window.setTimeout(() => {
    passingOn = false;
  }, 0);
};
const atSwitch = (e: React.MouseEvent<HTMLInputElement>): void => {
  if (!passingOn) return;
  passingOn = false;
  e.stopPropagation();
};
const quiet = (e: React.SyntheticEvent): void => e.stopPropagation();

/**
 * Put it last inside a button that should tick when it's tapped.
 *
 * iPhone: a see-through label over the button, holding a hidden native switch. The tap lands on
 * the label and reaches the button's own onClick; WebKit then passes it on to the switch as the
 * person's own click, which is the only thing that makes an iPhone tick (platform/haptics.ts).
 * The switch itself stays out from under the finger, because a touch that starts on a switch
 * can't scroll the page. The label is hidden while the button is disabled or the setting is off
 * (styles.css).
 *
 * Android: an unseen mark; a tap on a control that holds one gets a short pulse.
 */
export function TapTick(): React.ReactElement | null {
  if (TICKS === "switch") {
    return (
      <label className="tap-tick" aria-hidden="true" onClick={fromLabel}>
        <input type="checkbox" {...SWITCH} onClick={atSwitch} onChange={quiet} />
      </label>
    );
  }
  return TICKS === "vibrate" ? <i className="tap-mark" hidden /> : null;
}

/**
 * For a switch row, which isn't a button: Android pulses when its words or its switch are tapped.
 * An iPhone gets nothing here. A label laid over the row would sit between a screen reader's
 * finger and the switch.
 */
export function TapMark(): React.ReactElement | null {
  return TICKS === "vibrate" ? <i className="tap-mark" hidden /> : null;
}
