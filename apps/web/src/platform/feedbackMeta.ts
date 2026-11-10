import type { Core, SessionRecord } from "../model/types";
import { CHANNEL } from "./channel";
import { isStandalone } from "./install";
import { loadStyle } from "./style";

declare const __BUILD__: string;

/** The build this app came from: a commit's short hash, or "dev". */
export const BUILD = typeof __BUILD__ === "undefined" ? "dev" : __BUILD__;

/**
 * What goes with a piece of feedback besides the words, as the feedback form says: enough to find
 * and reproduce a problem, and nothing about the person's body or training beyond a count.
 */
export function feedbackMeta(core: Core, history: SessionRecord[]): Record<string, string | number | boolean> {
  return {
    build: BUILD,
    channel: CHANNEL,
    style: loadStyle(),
    installed: isStandalone(),
    screen: `${window.innerWidth}x${window.innerHeight}`,
    browser: navigator.userAgent.slice(0, 300),
    workouts: history.filter((r) => !r.skipped).length,
    dataVersion: core.version,
  };
}
