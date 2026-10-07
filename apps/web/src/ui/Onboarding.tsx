import React, { useMemo, useState } from "react";
import { kgToLb, lbToKg, loadUnitsFor } from "@repcurve/shared";
import type { Band, Dumbbells, Equipment, Goal, Injury, Profile, Sex, TrainingHistory, Units } from "@repcurve/shared";
import { Choice, CurveMark, Icon, Seg, Toggle, type IconName } from "./common";
import { Lineup } from "./Lineup";
import { previewProgram, previewProjection } from "../model/projection";
import { ProjectionCard } from "./ProjectionCard";

const LB_WEIGHTS = [3, 5, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
const KG_WEIGHTS = [1, 2, 3, 4, 5, 6, 7.5, 8, 10, 12, 12.5, 15, 17.5, 20, 22.5, 25];

interface Draft {
  units: Units;
  sex: Sex | undefined;
  age: string;
  heightFt: string;
  heightIn: string;
  heightCm: string;
  weight: string;
  history: TrainingHistory | undefined;
  goal: Goal;
  days: number;
  minutes: number;
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
  bands: Band[];
  injuries: Injury[];
}

function defaultUnits(): Units {
  const lang = typeof navigator !== "undefined" ? navigator.language : "en-US";
  return /^en-(US|LR)|^my/i.test(lang) ? "lb" : "kg";
}

function draftFrom(profile?: Profile, equipment?: Equipment): Draft {
  const units = profile?.units ?? defaultUnits();
  const totalIn = profile ? profile.heightCm / 2.54 : 0;
  const d = equipment?.dumbbells;
  const dbUnits = d && d.kind !== "none" ? d.unit : units;
  return {
    units,
    sex: profile?.sex,
    age: profile ? String(profile.age) : "",
    heightFt: profile ? String(Math.floor(totalIn / 12)) : "",
    heightIn: profile ? String(Math.round(totalIn % 12)) : "",
    heightCm: profile ? String(Math.round(profile.heightCm)) : "",
    weight: profile ? String(Math.round(units === "lb" ? kgToLb(profile.bodyweightKg) : profile.bodyweightKg)) : "",
    history: profile?.trainingHistory,
    goal: profile?.goal ?? "both",
    days: profile?.daysPerWeek ?? 4,
    minutes: profile?.minutesPerSession ?? 20,
    dbKind: d?.kind ?? "fixed",
    dbUnits,
    weights: d?.kind === "fixed" ? d.weights : [],
    pairs: d && d.kind !== "none" ? d.pairs : true,
    adjMin: d?.kind === "adjustable" ? String(d.min) : dbUnits === "lb" ? "5" : "2",
    adjMax: d?.kind === "adjustable" ? String(d.max) : dbUnits === "lb" ? "52.5" : "24",
    adjStep: d?.kind === "adjustable" ? String(d.step) : dbUnits === "lb" ? "2.5" : "2",
    treadmill: equipment?.treadmill ?? false,
    mat: equipment?.mat ?? true,
    abRoller: equipment?.abRoller ?? false,
    pullupBar: equipment?.pullupBar ?? false,
    bench: equipment?.bench ?? true,
    bands: equipment?.bands ?? [],
    injuries: profile?.injuries ?? [],
  };
}

const num = (s: string) => (s.trim() === "" ? NaN : Number(s));

function body(d: Draft): { age: number; weight: number; heightCm: number } | null {
  const age = num(d.age);
  const weight = num(d.weight);
  const heightCm = d.units === "lb" ? (num(d.heightFt) * 12 + (num(d.heightIn) || 0)) * 2.54 : num(d.heightCm);
  const okWeight = d.units === "lb" ? weight >= 60 && weight <= 700 : weight >= 25 && weight <= 320;
  if (!(age >= 14 && age <= 100) || !okWeight || !(heightCm > 100 && heightCm < 250)) return null;
  return { age, weight, heightCm };
}

function toProfile(d: Draft): Profile | null {
  const b = body(d);
  if (!d.sex || !d.history || !b) return null;
  const { age, weight, heightCm } = b;
  return {
    sex: d.sex,
    age,
    heightCm: Math.round(heightCm),
    bodyweightKg: d.units === "lb" ? lbToKg(weight) : weight,
    trainingHistory: d.history,
    goal: d.goal,
    daysPerWeek: d.days,
    minutesPerSession: d.minutes,
    injuries: d.injuries,
    units: d.units,
  };
}

function toEquipment(d: Draft): Equipment | null {
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
  return { dumbbells, treadmill: d.treadmill, mat: d.mat, abRoller: d.abRoller, pullupBar: d.pullupBar, bench: d.bench, bands: d.bands };
}

type Step = "welcome" | "you" | "experience" | "schedule" | "equipment" | "body" | "review";

export function Onboarding(props: {
  initial?: { profile: Profile; equipment: Equipment };
  onDone: (profile: Profile, equipment: Equipment) => void;
  onCancel?: () => void;
}): React.ReactElement {
  const editing = !!props.initial;
  const steps: Step[] = editing ? ["you", "experience", "schedule", "equipment", "body", "review"] : ["welcome", "you", "experience", "schedule", "equipment", "body", "review"];
  const [i, setI] = useState(0);
  const [d, setD] = useState<Draft>(() => draftFrom(props.initial?.profile, props.initial?.equipment));
  const step = steps[i]!;
  const up = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const profile = toProfile(d);
  const equipment = toEquipment(d);

  const canNext =
    step === "you" ? !!d.sex && body(d) !== null
      : step === "experience" ? !!d.history
        : step === "equipment" ? equipment !== null
          : true;
  const youMissing = step === "you" && !canNext;

  const switchUnits = (units: Units) => {
    if (units === d.units) return;
    const w = num(d.weight);
    const toLb = units === "lb";
    const cm = d.units === "lb" ? (num(d.heightFt) * 12 + (num(d.heightIn) || 0)) * 2.54 : num(d.heightCm);
    const inches = cm / 2.54;
    up({
      units,
      weight: Number.isFinite(w) ? String(Math.round(toLb ? kgToLb(w) : lbToKg(w))) : d.weight,
      heightCm: Number.isFinite(cm) ? String(Math.round(cm)) : "",
      heightFt: Number.isFinite(inches) ? String(Math.floor(inches / 12)) : "",
      heightIn: Number.isFinite(inches) ? String(Math.round(inches % 12)) : "",
    });
  };

  /** Dumbbells keep their own unit; changing it means re-picking what's printed on them. */
  const switchDbUnits = (dbUnits: Units) => {
    if (dbUnits === d.dbUnits) return;
    const toLb = dbUnits === "lb";
    up({ dbUnits, weights: [], adjMin: toLb ? "5" : "2", adjMax: toLb ? "52.5" : "24", adjStep: toLb ? "2.5" : "2" });
  };

  const next = () => {
    if (step === "review" && profile && equipment) props.onDone(profile, equipment);
    else setI((x) => Math.min(steps.length - 1, x + 1));
    window.scrollTo(0, 0);
  };
  const back = () => {
    if (i === 0) props.onCancel?.();
    else setI((x) => x - 1);
    window.scrollTo(0, 0);
  };

  return (
    <main className="app stack-lg" style={{ paddingBottom: 32 }}>
      {step !== "welcome" ? (
        <div className="stack" style={{ gap: 10 }}>
          <div className="spread">
            <button type="button" className="icon-btn" aria-label={i === 0 ? "Cancel" : "Back"} onClick={back} style={{ border: 0, background: "transparent" }}>
              <Icon name="chevronLeft" size={22} />
            </button>
            <span className="steps-count">
              {i + (editing ? 1 : 0)} of {steps.filter((s) => s !== "welcome").length}
            </span>
          </div>
          <div className="steps" aria-hidden="true">
            {steps.filter((s) => s !== "welcome").map((s, k) => (
              <i key={s} className={k <= i - (editing ? 0 : 1) ? "on" : ""} />
            ))}
          </div>
        </div>
      ) : null}

      {step === "welcome" ? <Welcome /> : null}

      {step === "you" ? (
        <section className="stack-lg">
          <header className="stack">
            <p className="eyebrow">About you</p>
            <h1 className="title">Start from where you are</h1>
            <p className="meta">Used to set safe starting weights and to compare your progress with people like you.</p>
          </header>
          <div className="field">
            <span className="label">Units</span>
            <Seg label="Units" value={d.units} onChange={switchUnits} options={[{ value: "lb", label: "lb · ft" }, { value: "kg", label: "kg · cm" }]} />
          </div>
          <div className="field">
            <span className="label">Sex</span>
            <Seg label="Sex" value={d.sex} onChange={(sex) => up({ sex })} options={[{ value: "female", label: "Female" }, { value: "male", label: "Male" }]} />
            <span className="meta small">Strength norms differ by sex, so this sets your starting point.</span>
          </div>
          <div className="row-wrap" style={{ alignItems: "flex-end" }}>
            <div className="field" style={{ flex: "1 1 6rem" }}>
              <label htmlFor="age">Age</label>
              <input id="age" className="input num" inputMode="numeric" value={d.age} onChange={(e) => up({ age: e.target.value })} placeholder="33" />
            </div>
            <div className="field" style={{ flex: "1 1 6rem" }}>
              <label htmlFor="weight">Weight ({d.units})</label>
              <input id="weight" className="input num" inputMode="decimal" value={d.weight} onChange={(e) => up({ weight: e.target.value })} placeholder={d.units === "lb" ? "185" : "84"} />
            </div>
          </div>
          {d.units === "lb" ? (
            <div className="row-wrap" style={{ alignItems: "flex-end" }}>
              <div className="field" style={{ flex: "1 1 6rem" }}>
                <label htmlFor="ft">Height (ft)</label>
                <input id="ft" className="input num" inputMode="numeric" value={d.heightFt} onChange={(e) => up({ heightFt: e.target.value })} placeholder="5" />
              </div>
              <div className="field" style={{ flex: "1 1 6rem" }}>
                <label htmlFor="in">(in)</label>
                <input id="in" className="input num" inputMode="numeric" value={d.heightIn} onChange={(e) => up({ heightIn: e.target.value })} placeholder="10" />
              </div>
            </div>
          ) : (
            <div className="field">
              <label htmlFor="cm">Height (cm)</label>
              <input id="cm" className="input num" inputMode="numeric" value={d.heightCm} onChange={(e) => up({ heightCm: e.target.value })} placeholder="178" />
            </div>
          )}
        </section>
      ) : null}

      {step === "experience" ? (
        <section className="stack-lg">
          <header className="stack">
            <p className="eyebrow">Experience</p>
            <h1 className="title">Have you lifted before?</h1>
          </header>
          <Choice
            label="Training history"
            value={d.history}
            onChange={(history) => up({ history })}
            options={[
              { value: "never", label: "New to it", hint: "Never really trained with weights" },
              { value: "a_little", label: "A little", hint: "Some workouts, under about six months" },
              { value: "lapsed", label: "Used to, then stopped", hint: "Muscle comes back faster than it was first built" },
              { value: "regular", label: "I train regularly", hint: "Most weeks for the past six months or more" },
            ]}
          />
          <div className="field">
            <span className="label">What matters most?</span>
            <Choice
              label="Goal"
              value={d.goal}
              onChange={(goal) => up({ goal })}
              options={[
                { value: "strength_muscle", label: "Muscle and strength", hint: "Mostly lifting days" },
                { value: "both", label: "Both", hint: "Lifting plus a treadmill or walking day" },
                { value: "fitness", label: "Fitness first", hint: "More cardio days, lifting to stay strong" },
              ]}
            />
          </div>
        </section>
      ) : null}

      {step === "schedule" ? (
        <section className="stack-lg">
          <header className="stack">
            <p className="eyebrow">Schedule</p>
            <h1 className="title">How much time do you really have?</h1>
            <p className="meta">Pick what you can do on a busy week. Sessions run in order, so a missed day just waits for you.</p>
          </header>
          <div className="field">
            <span className="label">Days a week</span>
            <Seg label="Days a week" value={d.days} onChange={(days) => up({ days })} options={[2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))} />
          </div>
          <div className="field">
            <span className="label">Minutes per session</span>
            <Seg label="Minutes per session" value={d.minutes} onChange={(minutes) => up({ minutes })} options={[10, 15, 20, 25, 30, 45].map((n) => ({ value: n, label: String(n) }))} />
          </div>
          <p className="meta">
            That's <b className="num">{d.days * d.minutes} minutes</b> a week.{" "}
            {d.days * d.minutes >= 60 ? "Enough to make steady progress for a long time as a newer lifter." : "Short, but still enough to get measurably stronger."}
          </p>
        </section>
      ) : null}

      {step === "equipment" ? (
        <section className="stack-lg">
          <header className="stack">
            <p className="eyebrow">Equipment</p>
            <h1 className="title">What do you have at home?</h1>
            <p className="meta">Every exercise and weight comes from this list, so be exact about your dumbbells.</p>
          </header>
          <div className="field">
            <span className="label">Dumbbells</span>
            <Seg
              label="Dumbbells"
              value={d.dbKind}
              onChange={(dbKind) => up({ dbKind })}
              options={[{ value: "fixed", label: "Fixed set" }, { value: "adjustable", label: "Adjustable" }, { value: "none", label: "None" }]}
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
              <span className="label">Tap every weight you own ({d.dbUnits})</span>
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
                  <label htmlFor={k}>{label} ({d.dbUnits})</label>
                  <input id={k} className="input num" inputMode="decimal" value={d[k]} onChange={(e) => up({ [k]: e.target.value } as Partial<Draft>)} />
                </div>
              ))}
            </div>
          ) : null}
          {d.dbKind !== "none" ? <Toggle id="pairs" label="I have pairs" hint="Two of each weight, for presses and rows with both hands" checked={d.pairs} onChange={(pairs) => up({ pairs })} /> : null}
          <div className="field">
            <span className="label">What else do you have access to?</span>
            <span className="meta small">Select all that apply. A sturdy chair or step counts as a bench.</span>
            <div className="tiles" style={{ marginTop: 4 }}>
              <Tile icon="treadmill" label="Treadmill" checked={d.treadmill} onChange={(treadmill) => up({ treadmill })} />
              <Tile icon="bench" label="Bench or chair" checked={d.bench} onChange={(bench) => up({ bench })} />
              <Tile icon="mat" label="Mat or rug" checked={d.mat} onChange={(mat) => up({ mat })} />
              <Tile icon="wheel" label="Ab roller" checked={d.abRoller} onChange={(abRoller) => up({ abRoller })} />
              <Tile icon="bar" label="Pull-up bar" checked={d.pullupBar} onChange={(pullupBar) => up({ pullupBar })} />
              <Tile icon="band" label="Bands" checked={d.bands.length > 0} onChange={(on) => up({ bands: on ? ["medium"] : [] })} />
            </div>
          </div>
        </section>
      ) : null}

      {step === "body" ? (
        <section className="stack-lg">
          <header className="stack">
            <p className="eyebrow">Look after yourself</p>
            <h1 className="title">Anything that hurts?</h1>
            <p className="meta">Exercises that tend to bother these areas are left out. You can flag pain on any set later, and that exercise gets swapped.</p>
          </header>
          <div className="row-wrap" role="group" aria-label="Areas to protect">
            {([
              ["knee", "Knees"],
              ["low_back", "Lower back"],
              ["shoulder", "Shoulders"],
              ["wrist", "Wrists"],
            ] as [Injury, string][]).map(([k, label]) => {
              const on = d.injuries.includes(k);
              return (
                <button key={k} type="button" className="chip" aria-pressed={on} onClick={() => up({ injuries: on ? d.injuries.filter((x) => x !== k) : [...d.injuries, k] })}>
                  {label}
                </button>
              );
            })}
          </div>
          <p className="meta small">RepCurve isn't medical advice. If something hurts sharply or keeps hurting, stop and get it looked at.</p>
        </section>
      ) : null}

      {step === "review" && profile && equipment ? <Review profile={profile} equipment={equipment} /> : null}

      {youMissing ? <p className="meta small">Fill in sex, age, height and weight to continue.</p> : null}

      <div className="footer-actions">
        {i > 0 || props.onCancel ? (
          <button type="button" className="btn" onClick={back}>
            {i === 0 ? "Cancel" : "Back"}
          </button>
        ) : null}
        <button type="button" className="btn primary" onClick={next} disabled={!canNext}>
          {step === "welcome" ? "Set up my plan" : step === "review" ? (editing ? "Save changes" : "Start training") : "Next"}
        </button>
      </div>
    </main>
  );
}

function Welcome(): React.ReactElement {
  return (
    <section className="stack-lg">
      <div className="brand">
        <CurveMark size={34} />
        <span>RepCurve</span>
      </div>
      <header className="stack">
        <h1 className="title" style={{ fontSize: "2.7rem" }}>Real training in the minutes you have</h1>
        <p className="meta">
          Tell RepCurve what equipment you own and how long you've got. It builds short, dense workouts, picks every weight and rep for you, and adjusts each session from how the last one felt.
        </p>
      </header>
      <svg className="hero-curve" viewBox="0 0 320 120" role="img" aria-label="A strength curve rising quickly at first, then levelling off">
        <line x1="8" y1="108" x2="312" y2="108" stroke="var(--line)" strokeWidth="1" />
        <path d="M8 104 C 70 96, 110 60, 160 42 S 260 20, 312 16 L312 108 L8 108 Z" fill="var(--chart-wash)" />
        <path d="M8 104 C 70 96, 110 60, 160 42 S 260 20, 312 16" fill="none" stroke="var(--chart)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="160" cy="42" r="5" fill="var(--chart)" stroke="var(--card)" strokeWidth="2" />
        <text x="168" y="60" fontSize="11" fill="var(--muted)">week 12</text>
        <text x="8" y="22" fontSize="11" fill="var(--muted)">strength</text>
      </svg>
      <div className="card stack">
        <div className="spread">
          <span className="h3">Full body A · 20 min</span>
          <span className="example-tag">Example</span>
        </div>
        <div className="lineup">
          <div className="lineup-group">
            <div className="lineup-tag">A</div>
            <div>
              <div className="lineup-item"><span>Goblet squat</span><span className="dose">3 × 12 · 25 lb</span></div>
              <div className="lineup-item"><span>Push-up</span><span className="dose">3 × 10</span></div>
            </div>
          </div>
          <div className="lineup-group">
            <div className="lineup-tag">B</div>
            <div>
              <div className="lineup-item"><span>Dumbbell Romanian deadlift</span><span className="dose">3 × 10 · 25 lb each</span></div>
              <div className="lineup-item"><span>One-arm dumbbell row</span><span className="dose">3 × 10/side · 25 lb</span></div>
            </div>
          </div>
        </div>
        <p className="meta small">Pairs of exercises alternate, so one muscle rests while the other works. That's how a real workout fits in 20 minutes.</p>
      </div>
    </section>
  );
}

function Review(props: { profile: Profile; equipment: Equipment }): React.ReactElement {
  const program = useMemo(() => previewProgram(props.profile, props.equipment), [props.profile, props.equipment]);
  const first = program.sessions.find((s) => s.kind === "strength");
  const projection = useMemo(() => previewProjection(props.profile, props.equipment), [props.profile, props.equipment]);
  return (
    <section className="stack-lg">
      <header className="stack">
        <p className="eyebrow">Your plan</p>
        <h1 className="title">
          {props.profile.daysPerWeek} days · {props.profile.minutesPerSession} minutes
        </h1>
      </header>
      <ProjectionCard projection={projection} units={props.profile.units} compact />
      <div className="stack">
        {program.explanation.map((p, k) => (
          <p key={k} className="prose">{p}</p>
        ))}
      </div>
      {first ? (
        <div className="card stack">
          <div className="spread">
            <span className="h3">First session · {first.name}</span>
            <span className="meta num">~{Math.round(first.estimatedMinutes)} min</span>
          </div>
          <Lineup plan={first} units={loadUnitsFor(props.profile, props.equipment)} />
        </div>
      ) : null}
    </section>
  );
}

function Tile(props: { icon: IconName; label: string; checked: boolean; onChange: (v: boolean) => void }): React.ReactElement {
  return (
    <button type="button" role="switch" aria-checked={props.checked} className="tile" onClick={() => props.onChange(!props.checked)}>
      <span className="badge" aria-hidden="true"><Icon name="check" size={13} strokeWidth={2.6} /></span>
      <Icon name={props.icon} size={26} />
      {props.label}
    </button>
  );
}
