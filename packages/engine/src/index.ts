export * from "./types.js";
export { generateProgram, missingPatterns, planSession, planSessionWith, weekAndDay, BASE_ROUNDS } from "./generate.js";
export type { PlanOptions } from "./generate.js";
export { makeContext } from "./context.js";
export type { EngineContext } from "./context.js";
export { trainingLevel, volumeTarget } from "./level.js";
export { weeklyTemplate } from "./template.js";
export { buildPool, pickExercise } from "./pool.js";
export {
  progressExercise,
  calibrate,
  freshProgress,
  ladderNeighbour,
  alternativeOnOtherLadder,
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
  swapPrescription,
  COMEBACK_DAYS,
  STRAIN_THRESHOLD,
  STRAINED_SESSIONS_FOR_DELOAD,
} from "./state.js";
export type { TrainingState, ApplyOptions, ExerciseChange, RecordResult } from "./state.js";
export { adviseNextSet } from "./advice.js";
export type { SetAdvice } from "./advice.js";
export { weeklyVolume, hardSets, MUSCLES } from "./volume.js";
export { startingLoadKg, repRangeFor, isLoaded } from "./loads.js";
export { TARGET_RIR, defaultTargetReps } from "./prescribe.js";
export { setSeconds, supersetSeconds, TRANSITION_SEC } from "./timing.js";
export { simulateTraining, DEFAULT_LIFTER } from "./simulate.js";
export type { SimulationResult, SimulatedSession, VirtualLifter } from "./simulate.js";
export { project, personalFactor, leanBodyMassKg, HORIZONS } from "./projection.js";
export type { Projection, ProjectionPoint, ProjectionInput, Band, LiftObservation } from "./projection.js";
