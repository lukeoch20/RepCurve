import { describe, expect, it } from "vitest";
import { planSessionWith } from "./generate.js";
import { SCHEDULED_DELOAD_WEEKS, applyState, initialTrainingState, recordSession, type TrainingState } from "./state.js";
import { logSession, onTarget, referenceContext } from "./testkit.js";
import type { EngineContext } from "./context.js";

/** Train `n` easy, on-target strength sessions; returns the state and the session numbers where a deload started. */
function run(ctx: EngineContext, n: number, start: TrainingState = initialTrainingState(), opts: { comebackAt?: number } = {}) {
  let state = start;
  const started: number[] = [];
  const reasons: (string | undefined)[] = [];
  const strength = [...Array(n * 3).keys()].filter((i) => planSessionWith(ctx, i).kind === "strength").slice(0, n);
  strength.forEach((index, k) => {
    const applied = applyState(planSessionWith(ctx, index), state, ctx, { daysSinceLastStrength: k === opts.comebackAt ? 20 : 2 });
    if (applied.deload) reasons.push(applied.deloadReason);
    const r = recordSession(state, applied, logSession(applied, onTarget), ctx);
    if (r.deloadStarted) started.push(k + 1);
    state = r.state;
  });
  return { state, started, reasons };
}

describe("scheduled deloads", () => {
  it("novices only deload when sessions turn into grinds, never on a schedule", () => {
    const ctx = referenceContext({ profile: { trainingHistory: "never" } });
    expect(ctx.volumeLevel).toBe("novice");
    expect(run(ctx, 40).started).toEqual([]);
  });

  it("a regular lifter gets a planned light week after eight weeks of easy training, then the count restarts", () => {
    const ctx = referenceContext({ profile: { trainingHistory: "regular" } });
    expect(ctx.volumeLevel).toBe("intermediate");
    const every = SCHEDULED_DELOAD_WEEKS.intermediate! * ctx.strengthPerWeek;
    const total = 2 * every + 2 * ctx.strengthPerWeek;
    const { started, reasons, state } = run(ctx, total);
    // Due after `every` sessions; the deload week itself doesn't count towards the next one.
    expect(started).toEqual([every, 2 * every + ctx.strengthPerWeek]);
    // Two full light weeks, both labelled as planned, the second finished by the last session.
    expect(reasons).toEqual(Array(2 * ctx.strengthPerWeek).fill("scheduled"));
    expect(state.deloadRemaining).toBe(0);
  });

  it("a break of two weeks restarts the count", () => {
    const ctx = referenceContext({ profile: { trainingHistory: "regular" } });
    const every = SCHEDULED_DELOAD_WEEKS.intermediate! * ctx.strengthPerWeek;
    const { started } = run(ctx, every + 4, initialTrainingState(), { comebackAt: every - 2 });
    expect(started).toEqual([]);
  });

  it("a grind-triggered deload is labelled as one, and also restarts the count", () => {
    const ctx = referenceContext({ profile: { trainingHistory: "regular" } });
    const start: TrainingState = { ...initialTrainingState(), deloadRemaining: 1, deloadReason: "strain", sessionsSinceDeload: 30 };
    const plan = planSessionWith(ctx, [...Array(9).keys()].find((i) => planSessionWith(ctx, i).kind === "strength")!);
    const applied = applyState(plan, start, ctx);
    expect(applied.deloadReason).toBe("strain");
    const r = recordSession(start, applied, logSession(applied, onTarget), ctx);
    expect(r.deloadFinished).toBe(true);
    expect(r.state.sessionsSinceDeload).toBe(0);
    expect(r.state.deloadReason).toBeUndefined();
  });

  it("a state saved before scheduled deloads counts from zero rather than deloading at once", () => {
    const ctx = referenceContext({ profile: { trainingHistory: "regular" } });
    const old = { ...initialTrainingState(), strengthSessionsLogged: 200 };
    expect(run(ctx, 3, old).started).toEqual([]);
  });
});
