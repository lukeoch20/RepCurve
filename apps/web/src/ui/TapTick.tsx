import React from "react";
import { TICKS } from "../platform/haptics";

// React doesn't know the attribute; it passes it through to the page as written.
const SWITCH = { switch: "" } as unknown as React.InputHTMLAttributes<HTMLInputElement>;
const stop = (e: React.SyntheticEvent): void => e.stopPropagation();

/**
 * Put it last inside a button (or a row) that should tick when it's tapped.
 *
 * iPhone: a see-through label over the control, holding a hidden native switch. The tap lands on
 * the label and still reaches the control's own onClick; WebKit then passes it to the switch as
 * the person's own click, which is the only thing that makes an iPhone tick (platform/haptics.ts).
 * The switch itself stays out from under the finger, because a touch that starts on a switch
 * can't scroll the page. The click the label passes on stops at the switch, so the control's
 * onClick runs once. The label is hidden while the control is disabled or the setting is off.
 *
 * Android: an unseen mark; a tap on a control that holds one gets a short pulse.
 *
 * `onTap` is for a row that isn't a button: it runs when the label is tapped.
 */
export function TapTick(props: { onTap?: () => void }): React.ReactElement | null {
  if (TICKS === "switch") {
    return (
      <label className="tap-tick" aria-hidden="true" onClick={props.onTap}>
        <input type="checkbox" {...SWITCH} tabIndex={-1} onClick={stop} onChange={stop} />
      </label>
    );
  }
  return TICKS === "vibrate" ? <i className="tap-mark" hidden /> : null;
}
