import { findExercise } from "@repcurve/exercises";
import { meetsRequirements, type Equipment, type Profile } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { INITIAL, reducer, type Action, type AppState } from "../store/reducer";
import { exportBackup, parseBackup } from "./backup";
import { fullGym } from "./equipment";
import { migrateData } from "./migrate";
import { contextFor, planExerciseIds, regenerateToday, todayPlan } from "./plan";
import { nextUp, sessionCore } from "./session";
import {
  BODYWEIGHT_ID,
  NO_EQUIPMENT,
  copyName,
  currentSetup,
  deleteOutcome,
  equipmentSummary,
  scheduleEquipment,
  templateEquipment,
} from "./setups";
import { DATA_VERSION, type AppData, type TrainingSetups } from "./types";

const profile: Profile = {
  sex: "female", age: 31, heightCm: 168, bodyweightKg: 64, trainingHistory: "a_little", goal: "both",
  daysPerWeek: 4, minutesPerSession: 30, injuries: [], units: "lb",
};
const home: Equipment = {
  dumbbells: { kind: "fixed", weights: [10, 15, 20, 25, 30], unit: "lb", pairs: true },
  treadmill: true, mat: true, abRoller: true, pullupBar: false, bench: true, bands: [],
};
const gym = fullGym("lb");
// Travel: kilogram dumbbells and nothing else.
const travel: Equipment = { ...NO_EQUIPMENT, dumbbells: { kind: "adjustable", min: 2, max: 20, step: 2, unit: "kg", pairs: true } };
const setups: TrainingSetups = {
  list: [{ id: "home", name: "Home", equipment: home }, { id: "gym", name: "Gym", equipment: gym }, { id: "trip", name: "Travel", equipment: travel }],
  usual: "home",
};
const T0 = Date.UTC(2026, 9, 5, 12);
const MIN = 60_000;

const run = (s: AppState, ...actions: Action[]) => actions.reduce(reducer, s);
const start = (p: Profile = profile, s: TrainingSetups = setups): AppState =>
  run(reducer(INITIAL, { type: "loaded", data: { core: null, active: null, history: [] } }), { type: "setup", profile: p, setups: s, now: T0 });
/** As after closing the app and opening it again: saved, then loaded. */
const reload = (s: AppState): AppState => ({ ...s, data: migrateData(JSON.parse(JSON.stringify(s.data))) });
/** Log one set of whatever comes next, and finish. */
const logAndFinish = (s: AppState, at: number): AppState => {
  const ref = nextUp(s.data.active!)!;
  return run(s, { type: "log", ref, values: { loadKg: null, reps: 10, rir: 2 }, now: at }, { type: "finish", now: at + MIN });
};
const allowed = (ids: string[], equipment: Equipment) => ids.every((id) => meetsRequirements(findExercise(id)!.requires, equipment));
const usesGym = (ids: string[]) => !allowed(ids, home);

describe("training setups: which one the next workout uses", () => {
  it("uses the usual setup until another is chosen", () => {
    const s = start();
    expect(currentSetup(s.data.core!)).toMatchObject({ id: "home", mode: "usual" });
    expect(s.data.core!.equipment).toEqual(home);
  });

  it("'This workout': the preview follows it, it survives a reload, and the started workout uses it", () => {
    let s = run(start(), { type: "chooseSetup", id: "gym", mode: "once" });
    expect(currentSetup(s.data.core!)).toMatchObject({ id: "gym", mode: "once" });
    expect(s.data.core!.setups.usual).toBe("home");
    expect(usesGym(planExerciseIds(todayPlan(s.data.core!, [], T0)))).toBe(true);

    s = reload(s);
    expect(currentSetup(s.data.core!)).toMatchObject({ id: "gym", mode: "once" });
    s = run(s, { type: "start", now: T0, minutes: null });
    expect(s.data.active!.setup).toEqual({ id: "gym", name: "Gym", equipment: gym });
    expect(usesGym(planExerciseIds(s.data.active!.plan))).toBe(true);

    // Resumed after a reload, it's still the gym's workout.
    s = reload(s);
    expect(s.data.active!.setup).toEqual({ id: "gym", name: "Gym", equipment: gym });

    s = logAndFinish(s, T0 + 5 * MIN);
    expect(s.data.history[0]!.setup).toEqual({ id: "gym", name: "Gym" });
    // Used up: back to the usual setup.
    expect(currentSetup(s.data.core!)).toMatchObject({ id: "home", mode: "usual" });
    expect(s.data.core!.setups.once).toBeUndefined();
    expect(s.data.core!.equipment).toEqual(home);
  });

  it("'This workout' ends when that workout is skipped or discarded", () => {
    const skipped = run(start(), { type: "chooseSetup", id: "gym", mode: "once" }, { type: "skip", now: T0 });
    expect(currentSetup(skipped.data.core!)).toMatchObject({ id: "home", mode: "usual" });
    // A skipped workout wasn't done anywhere.
    expect(skipped.data.history[0]!.setup).toBeUndefined();

    const discarded = run(start(), { type: "chooseSetup", id: "gym", mode: "once" }, { type: "start", now: T0, minutes: null }, { type: "discard" });
    expect(currentSetup(discarded.data.core!)).toMatchObject({ id: "home", mode: "usual" });
    expect(discarded.data.core!.nextIndex).toBe(0);
    expect(discarded.data.history).toHaveLength(0);
  });

  it("is for the upcoming session, not a calendar day: it waits however long that takes", () => {
    let s = run(start(), { type: "chooseSetup", id: "gym", mode: "once" });
    s = reload(s);
    // Days later, nothing done in between: still the gym.
    expect(todayPlan(s.data.core!, [], T0 + 5 * 86_400_000)).toBeDefined();
    expect(currentSetup(s.data.core!)).toMatchObject({ id: "gym", mode: "once" });
  });

  it("'Keep using this setup' lasts through workouts and reloads, without changing the usual one", () => {
    let s = run(start(), { type: "chooseSetup", id: "gym", mode: "kept" });
    s = run(s, { type: "start", now: T0, minutes: null });
    s = logAndFinish(s, T0 + 5 * MIN);
    s = run(s, { type: "skip", now: T0 + 86_400_000 });
    s = reload(s);
    expect(currentSetup(s.data.core!)).toMatchObject({ id: "gym", mode: "kept" });
    expect(s.data.core!.setups.usual).toBe("home");
    s = run(s, { type: "backToUsual" });
    expect(currentSetup(s.data.core!)).toMatchObject({ id: "home", mode: "usual" });
    expect(s.data.core!.setups.kept).toBeUndefined();
  });

  it("a one-workout setup over a kept one hands back to the kept one; the kept one for this workout only stops being kept", () => {
    let s = run(start(), { type: "chooseSetup", id: "gym", mode: "kept" }, { type: "chooseSetup", id: "trip", mode: "once" });
    expect(currentSetup(s.data.core!)).toMatchObject({ id: "trip", mode: "once" });
    s = run(s, { type: "skip", now: T0 });
    expect(currentSetup(s.data.core!)).toMatchObject({ id: "gym", mode: "kept" });

    s = run(s, { type: "chooseSetup", id: "gym", mode: "once" });
    expect(currentSetup(s.data.core!)).toMatchObject({ id: "gym", mode: "once" });
    expect(s.data.core!.setups.kept).toBeUndefined();
    s = run(s, { type: "skip", now: T0 + MIN });
    expect(currentSetup(s.data.core!)).toMatchObject({ id: "home", mode: "usual" });
  });

  it("choosing the usual setup is going back to it", () => {
    const s = run(start(), { type: "chooseSetup", id: "gym", mode: "kept" }, { type: "chooseSetup", id: "home", mode: "once" });
    expect(s.data.core!.setups).toEqual({ list: setups.list, usual: "home" });
    expect(s.data.core!.equipment).toEqual(home);
  });

  it("can't be chosen for a setup that isn't there", () => {
    const s = start();
    expect(run(s, { type: "chooseSetup", id: "moon", mode: "once" }).data.core).toBe(s.data.core);
  });
});

describe("training setups: the programme and progress are shared", () => {
  it("a setup for one workout changes neither the week's schedule nor the programme position", () => {
    // Strength first: without a treadmill, cardio days would become lifting days.
    const p: Profile = { ...profile, goal: "strength_muscle" };
    const noTreadmill: Equipment = { ...home, treadmill: false };
    const s = start(p, { list: [...setups.list, { id: "park", name: "Park", equipment: noTreadmill }], usual: "home" });
    const before = contextFor(s.data.core!).template;
    expect(contextFor({ ...s.data.core!, equipment: noTreadmill, setups: { list: [], usual: BODYWEIGHT_ID } }).template).not.toEqual(before);

    const away = run(s, { type: "chooseSetup", id: "park", mode: "kept" });
    expect(away.data.core!.equipment).toEqual(noTreadmill);
    expect(contextFor(away.data.core!).template).toEqual(before);
    expect(away.data.core!.nextIndex).toBe(s.data.core!.nextIndex);
    expect(away.data.core!.positionOffset).toBe(s.data.core!.positionOffset);
  });

  it("switching keeps the training state as it is: progression and benchmarks carry across", () => {
    let s = run(start(), { type: "start", now: T0, minutes: null });
    s = logAndFinish(s, T0 + 5 * MIN);
    const state = s.data.core!.state;
    expect(state.strengthSessionsLogged).toBe(1);
    for (const a of [
      { type: "chooseSetup", id: "gym", mode: "once" },
      { type: "chooseSetup", id: "trip", mode: "kept" },
      { type: "backToUsual" },
      { type: "chooseSetup", id: BODYWEIGHT_ID, mode: "once" },
    ] as Action[]) {
      s = run(s, a);
      expect(s.data.core!.state).toBe(state);
      expect(s.data.history).toHaveLength(1);
    }
  });

  it("never plans equipment the setup lacks, and loads follow each setup's own weights and units", () => {
    for (const id of ["home", "gym", "trip", BODYWEIGHT_ID]) {
      const s = run(start(), { type: "chooseSetup", id, mode: "once" });
      const core = s.data.core!;
      for (let i = 0; i < 4; i++) {
        const plan = todayPlan({ ...core, nextIndex: i, setups: { ...core.setups, ...(core.setups.once ? { once: { id, index: i } } : {}) } }, [], T0);
        if (plan.kind !== "strength") continue;
        expect(allowed(planExerciseIds(plan), core.equipment), `${id}, session ${i + 1}`).toBe(true);
        expect(planExerciseIds(plan).length).toBeGreaterThan(0);
      }
    }
    // Travel's dumbbells are 2 kg steps; home's are 10–30 lb. Each plan's dumbbell loads are ones it has.
    const trip = todayPlan(run(start(), { type: "chooseSetup", id: "trip", mode: "once" }).data.core!, [], T0);
    const atHome = todayPlan(start().data.core!, [], T0);
    const loads = (plan: typeof trip) => plan.supersets.flatMap((ss) => ss.items).filter((p) => p.loadKg !== null && ["single_dumbbell", "dumbbell_pair"].includes(findExercise(p.exerciseId)!.loadType)).map((p) => p.loadKg!);
    expect(loads(trip).length).toBeGreaterThan(0);
    for (const kg of loads(trip)) expect(Math.abs(kg / 2 - Math.round(kg / 2))).toBeLessThan(1e-6);
    for (const kg of loads(atHome)) expect([10, 15, 20, 25, 30].some((lb) => Math.abs(lb * 0.45359237 - kg) < 0.01)).toBe(true);
  });

  it("Bodyweight only needs no equipment and still plans a full session", () => {
    const s = run(start(), { type: "chooseSetup", id: BODYWEIGHT_ID, mode: "once" });
    expect(s.data.core!.equipment).toEqual(NO_EQUIPMENT);
    const plan = todayPlan(s.data.core!, [], T0);
    expect(plan.kind).toBe("strength");
    expect(planExerciseIds(plan).length).toBeGreaterThanOrEqual(4);
    expect(allowed(planExerciseIds(plan), NO_EQUIPMENT)).toBe(true);
    expect(equipmentSummary(NO_EQUIPMENT)).toBe("No equipment needed");
  });

  it("a regenerated session lapses when the equipment for it changes, and stays when it doesn't", () => {
    const s = start();
    const regenerated = regenerateToday(s.data.core!, [], T0)!;
    expect(regenerated.regenerated).toBeDefined();
    const withRegen: AppState = { ...s, data: { ...s.data, core: regenerated } };
    expect(run(withRegen, { type: "chooseSetup", id: "gym", mode: "once" }).data.core!.regenerated).toBeUndefined();
    // Renaming the setup in use, or editing another, leaves it alone.
    expect(run(withRegen, { type: "updateSetup", id: "home", name: "Flat" }).data.core!.regenerated).toEqual(regenerated.regenerated);
    expect(run(withRegen, { type: "updateSetup", id: "gym", equipment: home }).data.core!.regenerated).toEqual(regenerated.regenerated);
  });
});

describe("training setups: a workout in progress, and the ones done, never change", () => {
  it("editing, renaming or deleting the setup mid-workout leaves the workout as it started", () => {
    let s = run(start(), { type: "chooseSetup", id: "gym", mode: "once" }, { type: "start", now: T0, minutes: null });
    const active = s.data.active!;
    s = run(s, { type: "updateSetup", id: "gym", name: "Old gym", equipment: NO_EQUIPMENT }, { type: "deleteSetup", id: "gym" });
    expect(s.data.active).toBe(active);
    // Logging and swapping work from the workout's own equipment.
    expect(sessionCore(s.data.core!, s.data.active!).equipment).toEqual(gym);
    // No switching setups mid-workout.
    expect(run(s, { type: "chooseSetup", id: "trip", mode: "once" })).toBe(s);
    expect(run(s, { type: "backToUsual" })).toBe(s);

    s = logAndFinish(s, T0 + 5 * MIN);
    expect(s.data.history[0]!.setup).toEqual({ id: "gym", name: "Gym" });
  });

  it("past workouts keep the setup's name after it's renamed or deleted", () => {
    let s = run(start(), { type: "start", now: T0, minutes: null });
    s = logAndFinish(s, T0 + 5 * MIN);
    const history = s.data.history;
    s = run(s, { type: "updateSetup", id: "home", name: "Apartment", equipment: gym }, { type: "deleteSetup", id: "home" });
    expect(s.data.history).toBe(history);
    expect(history[0]!.setup).toEqual({ id: "home", name: "Home" });
    expect(history[0]!.plan).toEqual(reload(s).data.history[0]!.plan);
  });
});

describe("training setups: managing them", () => {
  it("adding, editing and duplicating never select a setup, and copies are independent", () => {
    let s = start();
    s = run(s, { type: "addSetup", name: "  Hotel   gym ", equipment: gym, now: T0 });
    const added = s.data.core!.setups.list.at(-1)!;
    expect(added.name).toBe("Hotel gym");
    expect(currentSetup(s.data.core!).id).toBe("home");

    s = run(s, { type: "duplicateSetup", id: "home", now: T0 + 1 });
    const list = s.data.core!.setups.list;
    expect(list.map((x) => x.name)).toEqual(["Home", "Home copy", "Gym", "Travel", "Hotel gym"]);
    const copy = list[1]!;
    expect(copy.id).not.toBe("home");
    expect(copy.equipment).toEqual(home);
    expect(copy.equipment).not.toBe(home);
    expect(currentSetup(s.data.core!).id).toBe("home");

    s = run(s, { type: "updateSetup", id: copy.id, equipment: { ...home, pullupBar: true } });
    expect(s.data.core!.setups.list[0]!.equipment).toEqual(home);
    expect(s.data.core!.equipment).toEqual(home);
    expect(copyName(s.data.core!.setups, "Home")).toBe("Home copy 2");
  });

  it("a blank name is refused, and names are kept to 40 characters", () => {
    let s = run(start(), { type: "updateSetup", id: "home", name: "   " });
    expect(s.data.core!.setups.list[0]!.name).toBe("Home");
    s = run(s, { type: "updateSetup", id: "home", name: "x".repeat(60) });
    expect(s.data.core!.setups.list[0]!.name).toHaveLength(40);
  });

  it("deleting the usual setup makes the first one left usual, and says so first", () => {
    const s = run(start(), { type: "chooseSetup", id: "gym", mode: "kept" });
    expect(deleteOutcome(s.data.core!.setups, "home", 0)).toBe("Past workouts keep its name. Gym becomes your usual setup.");
    const after = run(s, { type: "deleteSetup", id: "home" });
    expect(after.data.core!.setups.usual).toBe("gym");
    // Kept "Gym" is now simply the usual one.
    expect(after.data.core!.setups.kept).toBeUndefined();
    expect(currentSetup(after.data.core!)).toMatchObject({ id: "gym", mode: "usual" });
  });

  it("deleting the setup chosen for the next workout goes back to the kept or usual one", () => {
    const s = run(start(), { type: "chooseSetup", id: "trip", mode: "kept" }, { type: "chooseSetup", id: "gym", mode: "once" });
    expect(deleteOutcome(s.data.core!.setups, "gym", 0)).toBe("Past workouts keep its name. Your next workout goes back to Travel.");
    const after = run(s, { type: "deleteSetup", id: "gym" });
    expect(currentSetup(after.data.core!)).toMatchObject({ id: "trip", mode: "kept" });
    expect(after.data.core!.equipment).toEqual(travel);
  });

  it("deleting every saved setup leaves Bodyweight only, which needs nothing", () => {
    let s = start();
    for (const id of ["home", "gym", "trip"]) s = run(s, { type: "deleteSetup", id });
    expect(s.data.core!.setups).toEqual({ list: [], usual: BODYWEIGHT_ID });
    expect(s.data.core!.equipment).toEqual(NO_EQUIPMENT);
    expect(todayPlan(s.data.core!, [], T0).kind).toBe("strength");
  });

  it("making another setup usual moves the week's schedule to it, and Bodyweight only can be usual", () => {
    let s = run(start(), { type: "makeUsual", id: "gym" });
    expect(scheduleEquipment(s.data.core!.setups)).toEqual(gym);
    expect(currentSetup(s.data.core!)).toMatchObject({ id: "gym", mode: "usual" });
    s = run(s, { type: "makeUsual", id: BODYWEIGHT_ID });
    expect(currentSetup(s.data.core!)).toMatchObject({ id: BODYWEIGHT_ID, mode: "usual" });
  });

  it("templates are a starting point: a typical gym filled in, travel bands, or nothing", () => {
    expect(templateEquipment("gym", "kg")).toEqual(fullGym("kg"));
    expect(templateEquipment("travel", "lb")).toMatchObject({ dumbbells: { kind: "none" }, bands: ["light", "medium", "heavy"], bandAnchor: false, loopBands: true });
    expect(templateEquipment("empty", "lb")).toEqual(NO_EQUIPMENT);
  });
});

describe("training setups: saved data and backups", () => {
  // Data version 4: one place, or home and gym with the one in use.
  const v4 = (extra: Record<string, unknown>): AppData => {
    const core = start().data.core!;
    const { setups: _, ...old } = core;
    return { core: { ...old, version: 4, equipment: home, ...extra } as never, active: null, history: [] };
  };

  it("one equipment list becomes a single usual setup, with nothing else changed", () => {
    const data = migrateData(JSON.parse(JSON.stringify(v4({}))));
    expect(data.core!.version).toBe(DATA_VERSION);
    expect(data.core!.setups).toEqual({ list: [{ id: "home", name: "Home", equipment: home }], usual: "home" });
    expect(data.core!.equipment).toEqual(home);

    const gymOnly = migrateData(JSON.parse(JSON.stringify(v4({ equipment: gym }))));
    expect(gymOnly.core!.setups).toEqual({ list: [{ id: "gym", name: "Gym", equipment: gym }], usual: "gym" });
  });

  it("home and gym become two setups, and the place in use stays in use", () => {
    const data = migrateData(JSON.parse(JSON.stringify(v4({ equipment: gym, locations: { home, gym, at: "gym" } }))));
    expect(data.core!.setups).toEqual({ list: [{ id: "home", name: "Home", equipment: home }, { id: "gym", name: "Gym", equipment: gym }], usual: "gym" });
    expect(data.core!.equipment).toEqual(gym);
    expect("locations" in data.core!).toBe(false);
  });

  it("a workout left open by an older version keeps the equipment it started with", () => {
    let s = run(start(), { type: "start", now: T0, minutes: null });
    const { setup: _, ...active } = s.data.active!;
    const old = { ...v4({ equipment: gym, locations: { home, gym, at: "gym" } }), active };
    const data = migrateData(JSON.parse(JSON.stringify(old)));
    expect(data.active!.setup).toEqual({ id: "gym", name: "Gym", equipment: gym });
    // Older records stay as they were, with no place made up for them.
    s = logAndFinish(s, T0 + 5 * MIN);
    const { setup: __, ...record } = s.data.history[0]!;
    expect(migrateData(JSON.parse(JSON.stringify({ ...data, history: [record] }))).history[0]!.setup).toBeUndefined();
  });

  it("a backup round-trips setups, the choice for the next workout, and where workouts were done", () => {
    let s = run(start(), { type: "chooseSetup", id: "trip", mode: "kept" }, { type: "chooseSetup", id: "gym", mode: "once" }, { type: "start", now: T0, minutes: null });
    s = logAndFinish(s, T0 + 5 * MIN);
    s = run(s, { type: "chooseSetup", id: BODYWEIGHT_ID, mode: "once" }, { type: "start", now: T0 + 86_400_000, minutes: null });
    const parsed = parseBackup(exportBackup(s.data, T0 + 86_400_000 + MIN));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.data.core!.setups).toEqual(s.data.core!.setups);
    expect(parsed.data.core!.equipment).toEqual(NO_EQUIPMENT);
    expect(parsed.data.active!.setup).toEqual({ id: BODYWEIGHT_ID, name: "Bodyweight only", equipment: NO_EQUIPMENT });
    expect(parsed.data.history[0]!.setup).toEqual({ id: "gym", name: "Gym" });
  });
});
