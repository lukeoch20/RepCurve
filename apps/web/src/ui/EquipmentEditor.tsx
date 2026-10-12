import React, { useState } from "react";
import { MACHINES } from "@repcurve/shared";
import type { Band, Dumbbells, Equipment, Machine, Units } from "@repcurve/shared";
import { MACHINE_LABEL, fullGym } from "../model/equipment";
import type { Location } from "../model/types";
import { Icon, Seg, Toggle, type IconName } from "./common";

const LB_WEIGHTS = [3, 5, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
const KG_WEIGHTS = [1, 2, 3, 4, 5, 6, 7.5, 8, 10, 12, 12.5, 15, 17.5, 20, 22.5, 25];

/** Equipment for one place, as edited (numbers kept as typed). */
export interface EqDraft {
  dbKind: Dumbbells["kind"];
  /** The unit printed on the dumbbells, which can differ from the body units. */
  dbUnits: Units;
  weights: number[];
  pairs: boolean;
  adjMin: string;
  adjMax: string;
  adjStep: string;
  treadmill: boolean;
  mat: boolean;
  abRoller: boolean;
  pullupBar: boolean;
  bench: boolean;
  flatBench: boolean;
  adjustableBench: boolean;
  bands: Band[];
  bandAnchor: boolean;
  jumpRope: boolean;
  sliders: boolean;
  suspension: boolean;
  barbell: boolean;
  rack: boolean;
  trapBar: boolean;
  ezBar: boolean;
  cables: boolean;
  machines: Machine[];
  bike: boolean;
  elliptical: boolean;
  rower: boolean;
  stairClimber: boolean;
}

const adjDefaults = (u: Units) => (u === "lb" ? { adjMin: "5", adjMax: "52.5", adjStep: "2.5" } : { adjMin: "2", adjMax: "24", adjStep: "2" });

export function eqDraftFrom(equipment: Equipment | undefined, units: Units, place: Location): EqDraft {
  const e = equipment ?? (place === "gym" ? fullGym(units) : undefined);
  const d = e?.dumbbells;
  const dbUnits = d && d.kind !== "none" ? d.unit : units;
  return {
    dbKind: d?.kind ?? "fixed",
    dbUnits,
    weights: d?.kind === "fixed" ? d.weights : [],
    pairs: d && d.kind !== "none" ? d.pairs : true,
    ...(d?.kind === "adjustable" ? { adjMin: String(d.min), adjMax: String(d.max), adjStep: String(d.step) } : adjDefaults(dbUnits)),
    treadmill: e?.treadmill ?? false,
    mat: e?.mat ?? true,
    abRoller: e?.abRoller ?? false,
    pullupBar: e?.pullupBar ?? false,
    bench: e?.bench ?? true,
    flatBench: e?.flatBench ?? false,
    adjustableBench: e?.adjustableBench ?? false,
    bands: e?.bands ?? [],
    bandAnchor: e?.bandAnchor ?? false,
    jumpRope: e?.jumpRope ?? false,
    sliders: e?.sliders ?? false,
    suspension: e?.suspension ?? false,
    barbell: e?.barbell ?? false,
    rack: e?.rack ?? false,
    trapBar: e?.trapBar ?? false,
    ezBar: e?.ezBar ?? false,
    cables: e?.cables ?? false,
    machines: e?.machines ?? [],
    bike: e?.bike ?? false,
    elliptical: e?.elliptical ?? false,
    rower: e?.rower ?? false,
    stairClimber: e?.stairClimber ?? false,
  };
}

const num = (s: string) => (s.trim() === "" ? NaN : Number(s));

export function toEquipment(d: EqDraft): Equipment | null {
  let dumbbells: Dumbbells = { kind: "none" };
  if (d.dbKind === "fixed") {
    if (d.weights.length === 0) return null;
    dumbbells = { kind: "fixed", weights: [...d.weights].sort((a, b) => a - b), unit: d.dbUnits, pairs: d.pairs };
  } else if (d.dbKind === "adjustable") {
    const min = num(d.adjMin);
    const max = num(d.adjMax);
    const step = num(d.adjStep);
    if (!(min > 0 && max > min && step > 0 && (max - min) / step <= 200)) return null;
    dumbbells = { kind: "adjustable", min, max, step, unit: d.dbUnits, pairs: d.pairs };
  }
  const flatBench = d.flatBench || d.adjustableBench;
  return {
    dumbbells,
    treadmill: d.treadmill,
    mat: d.mat,
    abRoller: d.abRoller,
    pullupBar: d.pullupBar,
    // A flat bench also works as a step or support, so it counts as a bench too.
    bench: d.bench || flatBench,
    flatBench,
    adjustableBench: d.adjustableBench,
    bands: d.bands,
    bandAnchor: d.bands.length > 0 && d.bandAnchor,
    jumpRope: d.jumpRope,
    sliders: d.sliders,
    suspension: d.suspension,
    barbell: d.barbell,
    rack: d.barbell && d.rack,
    trapBar: d.trapBar,
    ezBar: d.ezBar,
    cables: d.cables,
    machines: MACHINES.filter((m) => d.machines.includes(m)),
    bike: d.bike,
    elliptical: d.elliptical,
    rower: d.rower,
    stairClimber: d.stairClimber,
  };
}

/** What one place has: dumbbells first, then everything else, with a gym's bars, cables and machines. */
export function EquipmentEditor(props: { place: Location; draft: EqDraft; onChange: (patch: Partial<EqDraft>) => void }): React.ReactElement {
  const d = props.draft;
  const up = props.onChange;
  const gym = props.place === "gym";
  const hasGymKit = d.barbell || d.cables || d.machines.length > 0;
  const [showGymKit, setShowGymKit] = useState(gym || hasGymKit);
  const id = (k: string) => `${props.place}-${k}`;

  /** Dumbbells keep their own unit; changing it means re-picking what's printed on them. */
  const switchDbUnits = (dbUnits: Units) => {
    if (dbUnits !== d.dbUnits) up({ dbUnits, weights: [], ...adjDefaults(dbUnits) });
  };

  return (
    <div className="stack-lg">
      {gym ? (
        <p className="meta small">
          Filled in for a typical gym. Untick anything yours doesn't have; RepCurve only plans what's ticked.
        </p>
      ) : null}
      <div className="field">
        <span className="label">Dumbbells</span>
        <Seg
          label="Dumbbells"
          value={d.dbKind}
          onChange={(dbKind) => up({ dbKind })}
          options={[{ value: "fixed", label: gym ? "Some weights" : "Fixed set" }, { value: "adjustable", label: gym ? "A full rack" : "Adjustable" }, { value: "none", label: "None" }]}
        />
      </div>
      {d.dbKind !== "none" ? (
        <div className="field">
          <span className="label">Marked in</span>
          <Seg label="Dumbbell units" value={d.dbUnits} onChange={switchDbUnits} options={[{ value: "lb", label: "lb" }, { value: "kg", label: "kg" }]} />
        </div>
      ) : null}
      {d.dbKind === "fixed" ? (
        <div className="field">
          <span className="label">Tap every weight you have ({d.dbUnits})</span>
          <div className="weights" role="group" aria-label="Dumbbell weights">
            {(d.dbUnits === "lb" ? LB_WEIGHTS : KG_WEIGHTS).map((w) => {
              const on = d.weights.includes(w);
              return (
                <button key={w} type="button" className="chip" aria-pressed={on} onClick={() => up({ weights: on ? d.weights.filter((x) => x !== w) : [...d.weights, w] })}>
                  {w}
                </button>
              );
            })}
          </div>
          {d.weights.length === 0 ? <span className="meta small">Pick at least one weight, or choose None.</span> : null}
        </div>
      ) : null}
      {d.dbKind === "adjustable" ? (
        <div className="row-wrap">
          {([
            ["adjMin", "Lightest"],
            ["adjMax", "Heaviest"],
            ["adjStep", "Step"],
          ] as const).map(([k, label]) => (
            <div className="field" key={k} style={{ flex: "1 1 5rem" }}>
              <label htmlFor={id(k)}>{label} ({d.dbUnits})</label>
              <input id={id(k)} className="input num" inputMode="decimal" value={d[k]} onChange={(e) => up({ [k]: e.target.value } as Partial<EqDraft>)} />
            </div>
          ))}
        </div>
      ) : null}
      {d.dbKind !== "none" ? <Toggle id={id("pairs")} label="I have pairs" hint="Two of each weight, for presses and rows with both hands" checked={d.pairs} onChange={(pairs) => up({ pairs })} /> : null}

      <div className="field">
        <span className="label">{gym ? "Benches, bars and floor" : "What else do you have?"}</span>
        <span className="meta small">Select all that apply. A flat bench is a padded bench you lie on to press; an adjustable one inclines too.</span>
        <div className="tiles" style={{ marginTop: 4 }}>
          <Tile icon="bench" label="Sturdy chair, step or couch" checked={d.bench} onChange={(bench) => up({ bench })} />
          <Tile icon="bench" label="Flat bench" hint="to lie on" checked={d.flatBench} onChange={(flatBench) => up({ flatBench })} />
          <Tile icon="bench" label="Adjustable bench" hint="inclines too" checked={d.adjustableBench} onChange={(adjustableBench) => up({ adjustableBench })} />
          <Tile icon="mat" label="Mat or rug" checked={d.mat} onChange={(mat) => up({ mat })} />
          <Tile icon="bar" label="Pull-up bar" checked={d.pullupBar} onChange={(pullupBar) => up({ pullupBar })} />
          <Tile icon="wheel" label="Ab roller" checked={d.abRoller} onChange={(abRoller) => up({ abRoller })} />
          <Tile icon="band" label="Bands" checked={d.bands.length > 0} onChange={(on) => up({ bands: on ? ["medium"] : [] })} />
          <Tile icon="slider" label="Sliders" hint="or towels on a smooth floor" checked={d.sliders} onChange={(sliders) => up({ sliders })} />
          <Tile icon="suspension" label="Suspension trainer" checked={d.suspension} onChange={(suspension) => up({ suspension })} />
        </div>
      </div>
      {d.bands.length > 0 ? (
        <Toggle
          id={id("anchor")}
          label="A door anchor or sturdy post for the bands"
          hint="Rows and pulldowns need the band fixed at chest or head height. Without one, band pulling is left out."
          checked={d.bandAnchor}
          onChange={(bandAnchor) => up({ bandAnchor })}
        />
      ) : null}

      <div className="field">
        <span className="label">Cardio</span>
        <div className="tiles" style={{ marginTop: 4 }}>
          <Tile icon="treadmill" label="Treadmill" checked={d.treadmill} onChange={(treadmill) => up({ treadmill })} />
          <Tile icon="bike" label="Exercise bike" checked={d.bike} onChange={(bike) => up({ bike })} />
          <Tile icon="rower" label="Rower" checked={d.rower} onChange={(rower) => up({ rower })} />
          <Tile icon="elliptical" label="Elliptical" checked={d.elliptical} onChange={(elliptical) => up({ elliptical })} />
          <Tile icon="stairs" label="Stair climber" checked={d.stairClimber} onChange={(stairClimber) => up({ stairClimber })} />
          <Tile icon="rope" label="Jump rope" checked={d.jumpRope} onChange={(jumpRope) => up({ jumpRope })} />
        </div>
      </div>

      {!showGymKit ? (
        <button type="button" className="btn ghost" style={{ alignSelf: "flex-start" }} onClick={() => setShowGymKit(true)}>
          Barbell or cables at home?
        </button>
      ) : (
        <>
          <div className="field">
            <span className="label">Bars and cables</span>
            <div className="tiles" style={{ marginTop: 4 }}>
              <Tile icon="barbell" label="Barbell and plates" checked={d.barbell} onChange={(barbell) => up({ barbell })} />
              {d.barbell ? <Tile icon="machine" label="Rack" hint="with safeties" checked={d.rack} onChange={(rack) => up({ rack })} /> : null}
              <Tile icon="barbell" label="Trap bar" checked={d.trapBar} onChange={(trapBar) => up({ trapBar })} />
              <Tile icon="barbell" label="EZ bar" checked={d.ezBar} onChange={(ezBar) => up({ ezBar })} />
              <Tile icon="cable" label="Cable station" checked={d.cables} onChange={(cables) => up({ cables })} />
            </div>
            {d.barbell && !d.rack ? <span className="meta small">Without a rack, squats and barbell presses stay on dumbbells or machines; deadlifts and hip thrusts still use the bar.</span> : null}
          </div>
          <div className="field">
            <div className="spread">
              <span className="label">Machines</span>
              <button type="button" className="btn ghost small" onClick={() => up({ machines: d.machines.length === MACHINES.length ? [] : [...MACHINES] })}>
                {d.machines.length === MACHINES.length ? "None" : "All"}
              </button>
            </div>
            <div className="row-wrap" role="group" aria-label="Machines">
              {MACHINES.map((m) => {
                const on = d.machines.includes(m);
                return (
                  <button key={m} type="button" className="chip" aria-pressed={on} onClick={() => up({ machines: on ? d.machines.filter((x) => x !== m) : [...d.machines, m] })}>
                    {MACHINE_LABEL[m]}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Tile(props: { icon: IconName; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }): React.ReactElement {
  return (
    <button type="button" role="switch" aria-checked={props.checked} className="tile" onClick={() => props.onChange(!props.checked)}>
      <span className="badge" aria-hidden="true"><Icon name="check" size={13} strokeWidth={2.6} /></span>
      <Icon name={props.icon} size={26} />
      <span>
        {props.label}
        {props.hint ? <span className="tile-hint">{props.hint}</span> : null}
      </span>
    </button>
  );
}
