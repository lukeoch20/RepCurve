import { hasGymEquipment } from "@repcurve/engine";
import type { Equipment, Units } from "@repcurve/shared";
import { fullGym } from "./equipment";
import type { Core, Locations, SessionSetup, TrainingSetup, TrainingSetups } from "./types";

/**
 * Training setups: saved equipment for each place someone trains, and which one the next workout
 * uses. The usual setup is the default and sets the week's schedule; "This workout" picks another
 * for one session; "Keep using this setup" picks another until changed. Bodyweight only is always
 * there and needs nothing.
 */

/** The built-in setup that needs no equipment. Never saved in the list, never renamed or deleted. */
export const BODYWEIGHT_ID = "bodyweight";
export const BODYWEIGHT_NAME = "Bodyweight only";
export const NO_EQUIPMENT: Equipment = {
  dumbbells: { kind: "none" },
  treadmill: false,
  mat: false,
  abRoller: false,
  pullupBar: false,
  bench: false,
  bands: [],
};

export const MAX_NAME = 40;
export const MAX_SETUPS = 20;

/** A setup to show or use: a saved one, or Bodyweight only. */
export interface SetupView extends TrainingSetup {
  builtIn: boolean;
}

/** How the next workout's setup was chosen. */
export type SetupMode = "usual" | "once" | "kept";

const BODYWEIGHT: SetupView = { id: BODYWEIGHT_ID, name: BODYWEIGHT_NAME, equipment: NO_EQUIPMENT, builtIn: true };

/** A name as saved: spaces tidied, at most MAX_NAME characters. */
export function cleanName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, MAX_NAME).trim();
}

export function findSetup(setups: TrainingSetups, id: string): SetupView | null {
  if (id === BODYWEIGHT_ID) return BODYWEIGHT;
  const s = setups.list.find((x) => x.id === id);
  return s ? { ...s, builtIn: false } : null;
}

export const usualSetup = (setups: TrainingSetups): SetupView => findSetup(setups, setups.usual) ?? BODYWEIGHT;

/** The setup in use beyond the next workout: the kept one, else the usual one. */
export const ongoingSetup = (setups: TrainingSetups): SetupView => (setups.kept ? findSetup(setups, setups.kept) : null) ?? usualSetup(setups);

/** The setup the next workout (the session at `nextIndex`) uses, and how it was chosen. */
export function selectedSetup(setups: TrainingSetups, nextIndex: number): SetupView & { mode: SetupMode } {
  const once = setups.once && setups.once.index === nextIndex ? findSetup(setups, setups.once.id) : null;
  if (once && once.id !== setups.usual) return { ...once, mode: "once" };
  const kept = setups.kept ? findSetup(setups, setups.kept) : null;
  if (kept && kept.id !== setups.usual) return { ...kept, mode: "kept" };
  return { ...usualSetup(setups), mode: "usual" };
}

/** The setup the next workout uses (see selectedSetup). */
export const currentSetup = (core: Pick<Core, "setups" | "nextIndex">) => selectedSetup(core.setups, core.nextIndex);

/** Equipment the week's schedule is set from: the usual setup's. */
export const scheduleEquipment = (setups: TrainingSetups): Equipment => usualSetup(setups).equipment;

/**
 * Setups with nothing pointing at what isn't there: a usual setup that's gone becomes the first
 * one left (or Bodyweight only), and a choice that's gone, used up or the same as usual is dropped.
 */
export function tidySetups(setups: TrainingSetups, nextIndex: number): TrainingSetups {
  const exists = (id: string) => findSetup(setups, id) !== null;
  const usual = exists(setups.usual) ? setups.usual : (setups.list[0]?.id ?? BODYWEIGHT_ID);
  const out: TrainingSetups = { list: setups.list, usual };
  if (setups.kept && setups.kept !== usual && exists(setups.kept)) out.kept = setups.kept;
  const once = setups.once;
  if (once && once.index === nextIndex && once.id !== usual && once.id !== out.kept && exists(once.id)) out.once = once;
  return out;
}

/** The core with these setups, tidied, and its equipment set to the next workout's. */
export function withSetups(core: Core, setups: TrainingSetups): Core {
  const tidy = tidySetups(setups, core.nextIndex);
  return { ...core, setups: tidy, equipment: selectedSetup(tidy, core.nextIndex).equipment };
}

const sameEquipment = (a: Equipment, b: Equipment) => a === b || JSON.stringify(a) === JSON.stringify(b);

/**
 * As withSetups, for a change the person makes. When the next workout's equipment changes, a
 * regenerated session lapses: what it left out was picked to suit the old equipment.
 */
function reselect(core: Core, setups: TrainingSetups): Core {
  const next = withSetups(core, setups);
  if (!next.regenerated || sameEquipment(next.equipment, core.equipment)) return next;
  const { regenerated: _, ...rest } = next;
  return rest;
}

/**
 * Use a setup for the next workout only ("once"), or from now on until changed ("kept"). Choosing
 * the usual setup goes back to it either way. Pickers leave a tap on the setup already in use alone.
 */
export function chooseSetup(core: Core, id: string, mode: "once" | "kept"): Core {
  const s = core.setups;
  if (!findSetup(s, id)) return core;
  if (id === s.usual) return backToUsual(core);
  const { once: _, kept: __, ...rest } = s;
  if (mode === "kept") return reselect(core, { ...rest, kept: id });
  // The kept setup for this workout only: it stops being kept, and the usual one comes back after.
  if (s.kept === id) return reselect(core, { ...rest, once: { id, index: core.nextIndex } });
  // Another setup for this workout: one kept in use comes back after it.
  return reselect(core, { ...rest, ...(s.kept ? { kept: s.kept } : {}), once: { id, index: core.nextIndex } });
}

/** Back to the usual setup: one-off and kept choices both end. */
export function backToUsual(core: Core): Core {
  const { once: _, kept: __, ...rest } = core.setups;
  return reselect(core, rest);
}

/** The "This workout" choice has been used (or the workout was dropped): back to the kept or usual setup. */
export function endOneOff(core: Core): Core {
  if (!core.setups.once) return core;
  const { once: _, ...rest } = core.setups;
  return reselect(core, rest);
}

/** A new id, unlike any saved one's or one used before at the same moment. */
export function newSetupId(setups: TrainingSetups, now: number): string {
  const base = `s${Math.max(0, Math.floor(now)).toString(36)}`;
  let id = base;
  for (let n = 2; setups.list.some((x) => x.id === id) || id === BODYWEIGHT_ID; n++) id = `${base}-${n}`;
  return id;
}

/** Save a new setup. It isn't selected: choosing it is up to the person. */
export function addSetup(core: Core, name: string, equipment: Equipment, now: number): Core {
  const s = core.setups;
  if (s.list.length >= MAX_SETUPS) return core;
  const setup: TrainingSetup = { id: newSetupId(s, now), name: cleanName(name) || "Setup", equipment };
  return reselect(core, { ...s, list: [...s.list, setup] });
}

/** Rename a setup or replace its equipment. A workout already started keeps what it started with. */
export function updateSetup(core: Core, id: string, patch: { name?: string; equipment?: Equipment }): Core {
  const s = core.setups;
  if (!s.list.some((x) => x.id === id)) return core;
  const list = s.list.map((x) =>
    x.id !== id ? x : { ...x, ...(patch.name !== undefined && cleanName(patch.name) ? { name: cleanName(patch.name) } : {}), ...(patch.equipment ? { equipment: patch.equipment } : {}) },
  );
  return reselect(core, { ...s, list });
}

/** "Gym copy", "Gym copy 2", …: a name for a copy that isn't taken. */
export function copyName(setups: TrainingSetups, name: string): string {
  const taken = new Set(setups.list.map((x) => x.name.toLowerCase()));
  const base = cleanName(`${name.slice(0, MAX_NAME - 7)} copy`);
  let out = base;
  for (let n = 2; taken.has(out.toLowerCase()); n++) out = cleanName(`${name.slice(0, MAX_NAME - 9)} copy ${n}`);
  return out;
}

/** A copy of a setup, saved right after it. Bodyweight only can't be copied: there's nothing to copy. */
export function duplicateSetup(core: Core, id: string, now: number): Core {
  const s = core.setups;
  const i = s.list.findIndex((x) => x.id === id);
  if (i < 0 || s.list.length >= MAX_SETUPS) return core;
  const from = s.list[i]!;
  const copy: TrainingSetup = { id: newSetupId(s, now), name: copyName(s, from.name), equipment: structuredClone(from.equipment) };
  return reselect(core, { ...s, list: [...s.list.slice(0, i + 1), copy, ...s.list.slice(i + 1)] });
}

/** What deleting a setup leads to, said before it happens. */
export function deleteOutcome(setups: TrainingSetups, id: string, nextIndex: number): string {
  const after = tidySetups({ ...setups, list: setups.list.filter((x) => x.id !== id) }, nextIndex);
  const usualAfter = usualSetup(after).name;
  const parts: string[] = ["Past workouts keep its name."];
  if (setups.usual === id) parts.push(`${usualAfter} becomes your usual setup.`);
  else if (selectedSetup(setups, nextIndex).id === id) parts.push(`Your next workout goes back to ${selectedSetup(after, nextIndex).name}.`);
  return parts.join(" ");
}

/** Delete a saved setup. Whatever pointed at it falls back safely (see tidySetups). */
export function deleteSetup(core: Core, id: string): Core {
  const s = core.setups;
  if (!s.list.some((x) => x.id === id)) return core;
  const after: TrainingSetups = { ...s, list: s.list.filter((x) => x.id !== id) };
  // The new usual setup is the first one left (or Bodyweight only); a one-off or kept choice of it
  // says nothing new, so tidySetups drops it.
  return reselect(core, after);
}

/** Make a setup the usual one. The week's schedule follows it from the next session. */
export function makeUsual(core: Core, id: string): Core {
  const s = core.setups;
  if (!findSetup(s, id)) return core;
  return reselect(core, { ...s, usual: id });
}

/** Where a session is done: kept with it, so renaming or deleting the setup later changes nothing. */
export function sessionSetup(core: Pick<Core, "setups" | "nextIndex">): SessionSetup & { equipment: Equipment } {
  const s = currentSetup(core);
  return { id: s.id, name: s.name, equipment: s.equipment };
}

/** Setups for someone who had one equipment list, or home and gym, before setups existed. */
export function setupsFrom(equipment: Equipment, locations?: Locations): TrainingSetups {
  if (locations && (locations.home || locations.gym)) {
    const list: TrainingSetup[] = [];
    if (locations.home) list.push({ id: "home", name: "Home", equipment: locations.home });
    if (locations.gym) list.push({ id: "gym", name: "Gym", equipment: locations.gym });
    // The place in use becomes the usual setup, so the next workout and the week stay as they were.
    const at = locations[locations.at] ? locations.at : list[0]!.id;
    return { list, usual: at };
  }
  const gym = hasGymEquipment(equipment);
  return { list: [{ id: gym ? "gym" : "home", name: gym ? "Gym" : "Home", equipment }], usual: gym ? "gym" : "home" };
}

// ---------------------------------------------------------------- describing equipment

const num = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1).replace(/\.0$/, ""));

/** The dumbbells in a few words, e.g. "dumbbells 10–30 lb" or "adjustable dumbbells 5–52.5 lb". */
function dumbbellPhrase(e: Equipment): string | null {
  const d = e.dumbbells;
  if (d.kind === "none") return null;
  if (d.kind === "adjustable") return `adjustable dumbbell${d.pairs ? "s" : ""} ${num(d.min)}–${num(d.max)} ${d.unit}`;
  const lo = d.weights[0];
  const hi = d.weights[d.weights.length - 1];
  if (lo === undefined || hi === undefined) return null;
  const range = lo === hi ? `${num(lo)} ${d.unit}` : `${num(lo)}–${num(hi)} ${d.unit}`;
  if (!d.pairs) return d.weights.length === 1 ? `one ${range} dumbbell` : `single dumbbells ${range}`;
  return `dumbbells ${range}`;
}

/** Everything a setup has, most telling first, in a few words each. */
export function equipmentParts(e: Equipment): string[] {
  const out: string[] = [];
  const db = dumbbellPhrase(e);
  if (db) out.push(db);
  if (e.barbell) out.push(e.rack ? "barbell and rack" : "barbell");
  if (e.cables) out.push("cables");
  const machines = e.machines?.length ?? 0;
  if (machines > 0) out.push(machines === 1 ? "1 machine" : `${machines} machines`);
  if (e.adjustableBench) out.push("adjustable bench");
  else if (e.flatBench) out.push("flat bench");
  else if (e.bench) out.push("chair or step");
  if (e.pullupBar) out.push("pull-up bar");
  if (e.bands.length > 0) out.push(e.bandAnchor ? "bands with anchor" : "long bands");
  if (e.loopBands) out.push("mini bands");
  if (e.suspension) out.push("suspension trainer");
  if (e.trapBar) out.push("trap bar");
  if (e.ezBar) out.push("EZ bar");
  if (e.abRoller) out.push("ab roller");
  if (e.sliders) out.push("sliders");
  const cardio = ([
    [e.treadmill, "treadmill"],
    [e.bike, "bike"],
    [e.rower, "rower"],
    [e.elliptical, "elliptical"],
    [e.stairClimber, "stair climber"],
    [e.jumpRope, "jump rope"],
  ] as const).filter(([on]) => on).map(([, name]) => name);
  out.push(...cardio);
  return out;
}

/** A short summary for a list: "Dumbbells 10–30 lb, chair or step, long bands and 2 more". */
export function equipmentSummary(e: Equipment, max = 3): string {
  const parts = equipmentParts(e);
  if (parts.length === 0) return "No equipment needed";
  const shown = parts.slice(0, max);
  const more = parts.length - shown.length;
  const text = more > 0 ? `${shown.join(", ")} and ${more} more` : shown.length > 1 ? `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}` : shown[0]!;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// ---------------------------------------------------------------- starting points for a new setup

export type SetupTemplate = "empty" | "gym" | "travel";

export const TEMPLATES: { id: SetupTemplate; label: string; hint: string; name: string }[] = [
  { id: "empty", label: "Start empty", hint: "Tick what's there", name: "" },
  { id: "gym", label: "A typical gym", hint: "Filled in; untick what yours lacks", name: "Gym" },
  { id: "travel", label: "Travel bands", hint: "Long and mini bands, a jump rope", name: "Travel" },
];

/** A template's equipment: a starting suggestion, reviewed before it's saved. */
export function templateEquipment(t: SetupTemplate, units: Units): Equipment {
  if (t === "gym") return fullGym(units);
  if (t === "travel") return { ...NO_EQUIPMENT, bands: ["light", "medium", "heavy"], bandAnchor: false, loopBands: true, jumpRope: true };
  return NO_EQUIPMENT;
}

/** A name for a new setup that isn't taken: "Gym", else "Gym 2". */
export function freeName(setups: TrainingSetups, name: string): string {
  if (!name) return "";
  const taken = new Set(setups.list.map((x) => x.name.toLowerCase()));
  let out = name;
  for (let n = 2; taken.has(out.toLowerCase()); n++) out = `${name} ${n}`;
  return out;
}
