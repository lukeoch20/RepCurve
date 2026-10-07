import type { Equipment, Profile } from "@repcurve/shared";
import { newCore, rescheduled } from "../model/plan";
import {
  adjustTimer,
  clearTimer,
  editSet,
  finishSession,
  logSet,
  pause,
  removeSet,
  resume,
  setTimerLength,
  skipSegment,
  skipSession,
  skipSlot,
  startCardio,
  startSession,
  swapExercise,
  tickCardio,
  toggleWarmup,
  unskipSlot,
  type SetRef,
  type SetValues,
} from "../model/session";
import type { AppData, CardioResult, SessionRecord, Settings } from "../model/types";

export interface AppState {
  data: AppData;
  ready: boolean;
  /** The session just finished, shown as a summary until dismissed. */
  finished: SessionRecord | null;
}

export type Action =
  | { type: "loaded"; data: AppData }
  | { type: "setup"; profile: Profile; equipment: Equipment; now: number }
  | { type: "settings"; settings: Partial<Settings> }
  | { type: "start"; now: number; minutes: number | null }
  | { type: "log"; ref: SetRef; values: SetValues; now: number }
  | { type: "edit"; slot: string; setIndex: number; values: SetValues }
  | { type: "remove"; slot: string; setIndex: number }
  | { type: "skipSlot"; slot: string }
  | { type: "unskipSlot"; slot: string }
  | { type: "swap"; slot: string; exerciseId: string; permanent: boolean }
  | { type: "warmup"; name: string }
  | { type: "timerAdjust"; deltaSec: number; now: number }
  | { type: "timerLength"; seconds: number }
  | { type: "timerClear" }
  | { type: "pause"; now: number }
  | { type: "resume"; now: number }
  | { type: "cardioStart"; now: number }
  | { type: "cardioTick"; now: number }
  | { type: "cardioNext"; now: number }
  | { type: "finish"; now: number; cardio?: CardioResult }
  | { type: "discard" }
  | { type: "skip"; now: number }
  | { type: "dismissFinished" };

export const INITIAL: AppState = { data: { core: null, active: null, history: [] }, ready: false, finished: null };

export function reducer(s: AppState, a: Action): AppState {
  const { core, active, history } = s.data;
  const withActive = (next: typeof active): AppState => (next === active ? s : { ...s, data: { ...s.data, active: next } });

  switch (a.type) {
    case "loaded":
      return { ...s, data: a.data, ready: true };
    case "setup": {
      // First run creates the training record; later edits keep history and progress.
      const nextCore = core ? rescheduled(core, a.profile, a.equipment) : newCore(a.profile, a.equipment, a.now);
      return { ...s, data: { ...s.data, core: nextCore } };
    }
    case "settings":
      return core ? { ...s, data: { ...s.data, core: { ...core, settings: { ...core.settings, ...a.settings } } } } : s;
    case "start":
      if (!core || active) return s;
      return { ...s, data: { ...s.data, active: startSession(core, history, a.now, a.minutes) } };
    case "dismissFinished":
      return { ...s, finished: null };
    case "skip": {
      if (!core || active) return s;
      const r = skipSession(core, history, a.now);
      return { ...s, data: { ...s.data, core: r.core, history: [...history, r.record] } };
    }
  }

  if (!core || !active) return s;
  switch (a.type) {
    case "log":
      return withActive(logSet(active, a.ref, a.values, core, a.now));
    case "edit":
      return withActive(editSet(active, a.slot, a.setIndex, a.values, core));
    case "remove":
      return withActive(removeSet(active, a.slot, a.setIndex, core));
    case "skipSlot":
      return withActive(skipSlot(active, a.slot));
    case "unskipSlot":
      return withActive(unskipSlot(active, a.slot));
    case "swap": {
      const r = swapExercise(active, core, a.slot, a.exerciseId, a.permanent);
      return { ...s, data: { ...s.data, active: r.active, core: r.core } };
    }
    case "warmup":
      return withActive(toggleWarmup(active, a.name));
    case "timerAdjust":
      return withActive(adjustTimer(active, a.deltaSec, a.now));
    case "timerLength":
      return withActive(setTimerLength(active, a.seconds));
    case "timerClear":
      return withActive(clearTimer(active));
    case "pause":
      return withActive(pause(active, a.now));
    case "resume":
      return withActive(resume(active, a.now));
    case "cardioStart":
      return withActive(startCardio(active, a.now));
    case "cardioTick":
      return withActive(tickCardio(active, a.now).active);
    case "cardioNext":
      return withActive(skipSegment(active, a.now));
    case "discard":
      return { ...s, data: { ...s.data, active: null } };
    case "finish": {
      const r = finishSession(active, core, a.now, a.cardio);
      return { ...s, data: { core: r.core, active: null, history: [...history, r.record] }, finished: r.record };
    }
    default:
      return s;
  }
}
