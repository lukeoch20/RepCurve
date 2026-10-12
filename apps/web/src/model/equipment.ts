import { MACHINES } from "@repcurve/shared";
import type { Equipment, EquipmentItem, Machine, Units } from "@repcurve/shared";
import type { Core, Location, Locations } from "./types";

export const MACHINE_LABEL: Record<Machine, string> = {
  leg_press: "Leg press",
  chest_press: "Chest press",
  lat_pulldown: "Lat pulldown",
  seated_row: "Seated cable row",
  shoulder_press: "Shoulder press",
  leg_extension: "Leg extension",
  seated_leg_curl: "Seated leg curl",
  lying_leg_curl: "Lying leg curl",
  assisted_pull_up: "Assisted pull-up",
  standing_calf: "Standing calf raise",
  seated_calf: "Seated calf raise",
  supported_row: "Chest-supported row",
  reverse_fly: "Reverse fly",
  preacher_curl: "Preacher curl",
  hack_squat: "Hack squat",
  smith: "Smith machine",
  hip_thrust: "Hip thrust",
  hip_abduction: "Hip abduction",
  hip_adduction: "Hip adduction",
  back_extension: "Back extension (45°)",
};

const BASE_ITEM_LABEL: Record<Exclude<EquipmentItem, `machine:${string}`>, string> = {
  dumbbells: "dumbbells",
  treadmill: "a treadmill",
  mat: "a mat",
  ab_roller: "an ab roller",
  pullup_bar: "a pull-up bar",
  bench: "a sturdy chair, step or bench",
  flat_bench: "a flat bench you can lie on",
  adjustable_bench: "an adjustable (incline) bench",
  bands: "a resistance band",
  band_anchor: "a door anchor or sturdy post for the band",
  sliders: "sliders (or towels on a smooth floor)",
  suspension: "a suspension trainer",
  jump_rope: "a jump rope",
  barbell: "a barbell and plates",
  rack: "a rack with safeties",
  trap_bar: "a trap bar",
  ez_bar: "an EZ bar",
  cables: "a cable station",
};

/** Plain-language names for what an exercise needs. */
export function itemLabel(item: EquipmentItem): string {
  if (item.startsWith("machine:")) {
    const m = MACHINE_LABEL[item.slice(8) as Machine];
    return m ? `the ${m.toLowerCase()} machine` : item.slice(8);
  }
  return BASE_ITEM_LABEL[item as keyof typeof BASE_ITEM_LABEL] ?? item;
}

/** A typical commercial gym: most people only need to untick what theirs lacks. */
export function fullGym(units: Units): Equipment {
  return {
    dumbbells: units === "lb"
      ? { kind: "adjustable", min: 5, max: 100, step: 5, unit: "lb", pairs: true }
      : { kind: "adjustable", min: 2, max: 50, step: 2, unit: "kg", pairs: true },
    treadmill: true,
    mat: true,
    abRoller: true,
    pullupBar: true,
    bench: true,
    flatBench: true,
    adjustableBench: true,
    bands: ["light", "medium", "heavy"],
    bandAnchor: true,
    jumpRope: true,
    barbell: true,
    rack: true,
    trapBar: true,
    ezBar: true,
    cables: true,
    machines: [...MACHINES],
    bike: true,
    elliptical: true,
    rower: true,
    stairClimber: true,
  };
}

/** Where the user trains, as set up. Older setups without locations count as one place. */
export function placesOf(core: Pick<Core, "locations">): Location[] {
  const l = core.locations;
  if (!l) return [];
  return (["home", "gym"] as const).filter((p) => l[p] !== undefined);
}

/** Switch where today's training happens; the plan follows that place's equipment. */
export function atLocation(locations: Locations, at: Location): { equipment: Equipment; locations: Locations } | null {
  const equipment = locations[at];
  return equipment ? { equipment, locations: { ...locations, at } } : null;
}

/** Older band setups: the band row always assumed a door anchor, so keep offering it. */
export function upgradeEquipment(e: Equipment): Equipment {
  if (e.bands.length > 0 && e.bandAnchor === undefined) return { ...e, bandAnchor: true };
  return e;
}
