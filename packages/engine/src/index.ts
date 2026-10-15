export * from "./types.js";
export { generateProgram, missingPatterns, planSession, planSessionWith, weekAndDay, alternateBlock, BASE_ROUNDS, BLOCK_WEEKS } from "./generate.js";
export type { PlanOptions } from "./generate.js";
export { makeContext } from "./context.js";
export type { EngineContext, ContextHistory } from "./context.js";
export { trainingLevel, progressedLevel, volumeTarget, volumeCeiling, deltHeadTarget, deltHeadCeiling, PROMOTION_SESSIONS } from "./level.js";
export { weeklyTemplate, strengthDaysPerWeek, effectiveSplit, SPLIT_MIN_STRENGTH_DAYS } from "./template.js";
export { buildPool, pickExercise, hasGymEquipment, classOf } from "./pool.js";
export { coverageNotes, needsRampSet, needsRack, MAX_SUPERSETS } from "./session.js";
export { cardioOptions } from "./cardio.js";
export {
  buildProfile,
  applyProfile,
  markCaution,
  cautionAreasFor,
  cautionFor,
  swapSticks,
  resetWorkingWeight,
  bringBack,
  clearPainChecks,
  CAUTION_CLEAR_SESSIONS,
  CAUTION_MAX_DAYS,
} from "./profile.js";
export type { TrainingProfile, Caution, SwapEvent, FeedbackSession, ProfileOverrides, SoreRecord } from "./profile.js";
export { applySoreness, primeMovers, recordSoreSession, sessionMuscles, soreQuestion, sorenessSummary, verySore, SORE_GROUP_NAME, SORE_WINDOW_HOURS } from "./soreness.js";
export type { RecentSession, SoreLevel, Soreness, SoreQuestion } from "./soreness.js";
export {
  progressExercise,
  calibrate,
  freshProgress,
  ladderNeighbour,
  convertLoad,
} from "./progression.js";
export type { ExerciseProgress, ProgressionAction, ProgressionResult } from "./progression.js";
export {
  initialTrainingState,
  applyState,
  recordSession,
  fitToBudget,
  resolveExercise,
  preferExercise,
  prescriptionFor,
  prescriptionsOf,
  alternativesFor,
  type SwapReason,
  swapPrescription,
  COMEBACK_DAYS,
  STRAIN_THRESHOLD,
  STRAINED_SESSIONS_FOR_DELOAD,
  SCHEDULED_DELOAD_WEEKS,
} from "./state.js";
export type { TrainingState, ApplyOptions, ExerciseChange, RecordResult, DeloadReason } from "./state.js";
export { judgedSets, recordSessionWithExtras } from "./extra.js";
export { adviseNextSet } from "./advice.js";
export type { SetAdvice } from "./advice.js";
export { weeklyVolume, hardSets, MUSCLES, ceilingVolume, weeklyDeltHeads, deltHeadSets, isDeltRaise, DELT_HEADS } from "./volume.js";
export type { DeltHead } from "./volume.js";
export { startingLoadKg, repRangeFor, isLoaded } from "./loads.js";
export { TARGET_RIR, defaultTargetReps } from "./prescribe.js";
export { setSeconds, supersetSeconds, TRANSITION_SEC, RAMP_SET_SEC } from "./timing.js";
export { simulateTraining, DEFAULT_LIFTER } from "./simulate.js";
export type { SimulationResult, SimulatedSession, VirtualLifter } from "./simulate.js";
export { project, personalFactor, leanBodyMassKg, HORIZONS } from "./projection.js";
export type { Projection, ProjectionPoint, ProjectionInput, Band, LiftObservation } from "./projection.js";
