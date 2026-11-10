import type { SoreLevel, SwapReason } from "@repcurve/engine";
import { findRoutine } from "@repcurve/exercises";
import type { Equipment, Muscle, Profile } from "@repcurve/shared";
import { addActivity, removeActivity } from "../model/activity";
import { atLocation } from "../model/equipment";
import {
  anotherRound,
  endBlock,
  finishMobility,
  handsFreeOn,
  MOBILITY_STALE_MS,
  nextMobility,
  pauseBlock,
  pauseMobility,
  restartStep,
  restoreMobility,
  resumeBlock,
  resumeMobility,
  routinePlan,
  sessionHandsFree,
  setBlockLevel,
  setHandsFree,
  setLeftOut,
  skipDrill,
  startBlock,
  startMobility,
  tickMobility,
  trainedFamilies,
  type ActiveMobility,
  type MobilityEntry,
} from "../model/mobility";
import { newCore, originalToday, regenerateToday, rescheduled } from "../model/plan";
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
  /** A mobility session under way. Kept on this device only, not with the saved data (see useAppStore). */
  mobility: ActiveMobility | null;
  /** The mobility session just finished, shown as a summary until dismissed. */
  mobilityDone: MobilityEntry | null;
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
  /** Not feeling today's session: the same day with other exercises, or back to the original. */
  | { type: "regenerate"; now: number; minutes: number | null }
  | { type: "originalToday" }
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
  | { type: "dismissFinished" }
  /** Mobility: start a routine's session at a level (0-based), as a one-off or as the block's next. */
  | { type: "mobilityStart"; routine: string; level: number; block: boolean; now: number }
  | { type: "mobilityTick"; now: number }
  /** Move on: start what was waiting, finish the reps, or end a hold early. */
  | { type: "mobilityNext"; now: number }
  | { type: "mobilityPause"; now: number }
  | { type: "mobilityResume"; now: number }
  /** Leave the rest of the current drill; `hurt` when it's stopped for pain. */
  | { type: "mobilitySkip"; now: number; hurt?: boolean }
  | { type: "mobilityRestart"; now: number }
  /** Holds follow on by themselves, or wait for a tap: for this session and from now on. */
  | { type: "mobilityHandsFree"; on: boolean; now: number }
  /** End the session, keeping what was done. `hurt`: ended because the drill under way hurt, which is noted. */
  | { type: "mobilityFinish"; now: number; hurt?: boolean }
  | { type: "mobilityDiscard" }
  | { type: "mobilityDismiss" }
  /** A session read back from this device after a reload. */
  | { type: "mobilityRestore"; saved: unknown; now: number }
  | { type: "blockStart"; routine: string; now: number }
  | { type: "blockPause"; now: number }
  | { type: "blockResume" }
  | { type: "blockEnd" }
  /** After the review: the same block again. */
  | { type: "blockAgain"; now: number }
  /** Stay at a level (0-based), or null for the block's own pace. */
  | { type: "blockLevel"; level: number | null }
  | { type: "mobilityLeaveOut"; routine: string; drill: string; out: boolean };

export const INITIAL: AppState = { data: { core: null, active: null, history: [] }, ready: false, finished: null, mobility: null, mobilityDone: null };

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
  const withCore = (next: typeof core): AppState => (next === core ? s : { ...s, data: { ...s.data, core: next } });
  const withMobility = (next: ActiveMobility | null): AppState => (next === s.mobility ? s : { ...s, mobility: next });

  switch (a.type) {
    case "loaded":
      // With the setup gone (a reset), a mobility session under way goes with it.
      return { ...s, data: a.data, ready: true, ...(a.data.core ? {} : { mobility: null, mobilityDone: null }) };
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
    case "regenerate": {
      if (!core || active) return s;
      const next = regenerateToday(core, history, a.now, a.minutes);
      return next ? { ...s, data: { ...s.data, core: next } } : s;
    }
    case "originalToday":
      return core && !active && core.regenerated ? { ...s, data: { ...s.data, core: originalToday(core) } } : s;
    case "start":
      if (!core || active || s.mobility) return s;
      return { ...s, data: { ...s.data, active: startSession(core, history, a.now, a.minutes) } };
    case "dismissFinished":
      return { ...s, finished: null };
    case "mobilityStart": {
      const routine = findRoutine(a.routine);
      if (!core || active || s.mobility || !routine) return s;
      const plan = routinePlan(core, routine, a.level, trainedFamilies(core, history, a.now));
      if (plan.steps.length === 0) return s;
      return { ...s, mobility: startMobility(plan, { block: a.block, handsFree: handsFreeOn(core) }, a.now), mobilityDone: null };
    }
    case "mobilityRestore": {
      const saved = core && !s.mobility ? restoreMobility(a.saved, a.now) : null;
      if (!core || !saved) return s;
      // Left open for hours, or a workout is under way (started in another tab): closed as of when
      // it last moved, keeping what was done. Only one session runs at a time.
      if (active || a.now - saved.touchedAt > MOBILITY_STALE_MS) return withCore(finishMobility(saved, core, a.now, saved.touchedAt).core);
      return { ...s, mobility: saved };
    }
    case "mobilityTick":
      return s.mobility ? withMobility(tickMobility(s.mobility, a.now)) : s;
    case "mobilityNext":
      return s.mobility ? withMobility(nextMobility(s.mobility, a.now)) : s;
    case "mobilityPause":
      return s.mobility ? withMobility(pauseMobility(s.mobility, a.now)) : s;
    case "mobilityResume":
      return s.mobility ? withMobility(resumeMobility(s.mobility, a.now)) : s;
    case "mobilitySkip":
      return s.mobility ? withMobility(skipDrill(s.mobility, a.now, a.hurt === true)) : s;
    case "mobilityRestart":
      return s.mobility ? withMobility(restartStep(s.mobility, a.now)) : s;
    case "mobilityHandsFree":
      if (!core) return s;
      return { ...s, data: { ...s.data, core: setHandsFree(core, a.on) }, mobility: s.mobility ? sessionHandsFree(s.mobility, a.on, a.now) : null };
    case "mobilityFinish": {
      if (!core || !s.mobility) return s;
      const r = finishMobility(a.hurt ? skipDrill(s.mobility, a.now, true) : s.mobility, core, a.now);
      return { ...s, data: { ...s.data, core: r.core }, mobility: null, mobilityDone: r.entry };
    }
    case "mobilityDiscard":
      return withMobility(null);
    case "mobilityDismiss":
      return { ...s, mobilityDone: null };
    case "blockStart":
      return core ? withCore(startBlock(core, a.routine, a.now)) : s;
    case "blockPause":
      return core ? withCore(pauseBlock(core, a.now)) : s;
    case "blockResume":
      return core ? withCore(resumeBlock(core)) : s;
    case "blockEnd":
      return core ? withCore(endBlock(core)) : s;
    case "blockAgain":
      return core ? withCore(anotherRound(core, a.now)) : s;
    case "blockLevel":
      return core ? withCore(setBlockLevel(core, a.level)) : s;
    case "mobilityLeaveOut":
      return core ? withCore(setLeftOut(core, a.routine, a.drill, a.out)) : s;
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
