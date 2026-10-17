import type { SoreLevel, SwapReason } from "@repcurve/engine";
import type { Equipment, Muscle, Profile } from "@repcurve/shared";
import { addActivity, removeActivity } from "../model/activity";
import { atLocation } from "../model/equipment";
import { newCore, rescheduled } from "../model/plan";
import { cautionFine, forgetSwaps, profileFor, retest, settleRetests } from "../model/profile";
import { answerSoreness } from "../model/soreness";
import {
  addSet,
  adjustTimer,
  clearTimer,
  editSet,
  finishSession,
  logSet,
  pause,
  removeAddedSet,
  removeSet,
  setPainArea,
  resume,
  setTimerLength,
  skipSegment,
  skipSession,
  skipSet,
  skipSlot,
  startCardio,
  startSession,
  swapExercise,
  tickCardio,
  toggleWarmup,
  unskipSet,
  unskipSlot,
  type SetRef,
  type SetValues,
} from "../model/session";
import type { AppData, CardioResult, ExtraActivity, Location, Locations, SessionRecord, Settings } from "../model/types";

export interface AppState {
  data: AppData;
  ready: boolean;
  /** The session just finished, shown as a summary until dismissed. */
  finished: SessionRecord | null;
  /** The last action that threw, which changed nothing (see safeReducer). */
  failure?: ActionFailure;
}

export interface ActionFailure {
  action: Action["type"];
  error: unknown;
  at: number;
}

export type Action =
  | { type: "loaded"; data: AppData }
  /** `locations` replaces the places the user trains; leave it out to keep them. */
  | { type: "setup"; profile: Profile; equipment: Equipment; locations?: Locations; now: number }
  /** Train somewhere else today: the plan follows that place's equipment. */
  | { type: "location"; at: Location }
  | { type: "settings"; settings: Partial<Settings> }
  | { type: "addActivity"; activity: ExtraActivity }
  | { type: "removeActivity"; at: number }
  /** "Still sore?" before the next session: `level` for the groups picked out of those asked about. */
  | { type: "soreness"; asked: Muscle[]; level: SoreLevel; picked: Muscle[]; now: number }
  /** Corrections on the "What RepCurve knows" screen. */
  | { type: "cautionFine"; area: string; now: number }
  | { type: "forgetSwaps"; exerciseId: string; now: number }
  | { type: "retest"; exerciseId: string }
  | { type: "start"; now: number; minutes: number | null }
  | { type: "log"; ref: SetRef; values: SetValues; now: number }
  | { type: "edit"; slot: string; setIndex: number; values: SetValues }
  | { type: "remove"; slot: string; setIndex: number }
  /** One more set of an exercise than planned, or take the last added one back. */
  | { type: "addSet"; slot: string }
  | { type: "removeAddedSet"; slot: string }
  | { type: "painArea"; slot: string; setIndex: number; area: string | null }
  | { type: "skipSlot"; slot: string }
  | { type: "skipSet"; slot: string; setIndex: number }
  | { type: "unskipSet"; slot: string; setIndex: number }
  | { type: "unskipSlot"; slot: string }
  | { type: "swap"; slot: string; exerciseId: string; permanent: boolean; reason?: SwapReason; now?: number }
  | { type: "warmup"; name: string }
  | { type: "timerAdjust"; deltaSec: number; now: number }
  | { type: "timerLength"; seconds: number }
  | { type: "timerClear" }
  | { type: "pause"; now: number }
  | { type: "resume"; now: number }
  | { type: "cardioStart"; now: number }
  | { type: "cardioTick"; now: number }
  | { type: "cardioNext"; now: number }
  /** `at` closes the session as of an earlier moment, e.g. its last set when it was left open. */
  | { type: "finish"; now: number; cardio?: CardioResult; at?: number }
  | { type: "discard" }
  | { type: "skip"; now: number }
  | { type: "dismissFinished" };

export const INITIAL: AppState = { data: { core: null, active: null, history: [] }, ready: false, finished: null };

/**
 * The reducer the app runs: an action that throws (an engine error on data it didn't expect)
 * leaves everything as it was and records the failure, so the app can say so and carry on
 * instead of going blank.
 */
export function safeReducer(s: AppState, a: Action): AppState {
  try {
    return reducer(s, a);
  } catch (error) {
    return { ...s, failure: { action: a.type, error, at: Date.now() } };
  }
}

export function reducer(s: AppState, a: Action): AppState {
  const { core, active, history } = s.data;
  const withActive = (next: typeof active): AppState => (next === active ? s : { ...s, data: { ...s.data, active: next } });

  switch (a.type) {
    case "loaded":
      return { ...s, data: a.data, ready: true };
    case "setup": {
      // First run creates the training record; later edits keep history and progress.
      const locations = a.locations ?? core?.locations;
      const here = locations ? atLocation(locations, locations.at) : null;
      const equipment = here && a.locations ? here.equipment : a.equipment;
      const nextCore = core ? rescheduled(core, a.profile, equipment) : newCore(a.profile, equipment, a.now);
      if (locations) {
        // The place being trained at keeps the equipment just saved.
        nextCore.locations = { ...locations, [locations.at]: equipment };
      }
      return { ...s, data: { ...s.data, core: nextCore } };
    }
    case "location": {
      if (!core?.locations || active) return s;
      const here = atLocation(core.locations, a.at);
      if (!here) return s;
      return { ...s, data: { ...s.data, core: { ...rescheduled(core, core.profile, here.equipment), locations: here.locations } } };
    }
    case "settings":
      return core ? { ...s, data: { ...s.data, core: { ...core, settings: { ...core.settings, ...a.settings } } } } : s;
    case "addActivity":
      return core ? { ...s, data: { ...s.data, core: addActivity(core, a.activity) } } : s;
    case "removeActivity":
      return core ? { ...s, data: { ...s.data, core: removeActivity(core, a.at) } } : s;
    case "soreness":
      return core && !active ? { ...s, data: { ...s.data, core: answerSoreness(core, a.asked, a.level, a.picked, a.now) } } : s;
    case "cautionFine":
      return core && !active ? { ...s, data: { ...s.data, core: cautionFine(core, history, a.area, a.now) } } : s;
    case "forgetSwaps":
      return core && !active ? { ...s, data: { ...s.data, core: forgetSwaps(core, history, a.exerciseId, a.now) } } : s;
    case "retest":
      return core && !active ? { ...s, data: { ...s.data, core: retest(core, a.exerciseId) } } : s;
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
    case "addSet":
      return withActive(addSet(active, a.slot));
    case "removeAddedSet":
      return withActive(removeAddedSet(active, a.slot));
    case "painArea":
      return withActive(setPainArea(active, a.slot, a.setIndex, a.area));
    case "skipSlot":
      return withActive(skipSlot(active, a.slot));
    case "unskipSlot":
      return withActive(unskipSlot(active, a.slot));
    case "skipSet":
      return withActive(skipSet(active, a.slot, a.setIndex));
    case "unskipSet":
      return withActive(unskipSet(active, a.slot, a.setIndex));
    case "swap": {
      const r = swapExercise(active, core, a.slot, a.exerciseId, a.permanent, a.reason, profileFor(core, s.data.history, a.now ?? Date.now()));
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
      const r = finishSession(active, core, a.now, a.cardio, a.at);
      return { ...s, data: { core: settleRetests(r.core), active: null, history: [...history, r.record] }, finished: r.record };
    }
    default:
      return s;
  }
}
