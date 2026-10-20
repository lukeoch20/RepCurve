import React, { useMemo, useRef, useState } from "react";
import { SPLIT_MIN_STRENGTH_DAYS, effectiveSplit, hasGymEquipment, strengthDaysPerWeek } from "@repcurve/engine";
import { kgToLb, lbToKg, loadUnitsFor } from "@repcurve/shared";
import type { Equipment, Goal, Injury, Profile, Sex, Split, TrainingHistory, Units } from "@repcurve/shared";
import { Choice, CurveMark, Icon, Seg } from "./common";
import { EquipmentEditor, eqDraftFrom, toEquipment, type EqDraft } from "./EquipmentEditor";
import { Lineup } from "./Lineup";
import { previewProgram, previewProjection } from "../model/projection";
import { ProjectionCard } from "./ProjectionCard";
import { InstallCard } from "./Install";
import { PlanExplanation } from "./PlanExplanation";
import { PrivacyLink } from "./Privacy";
import { APP_NAME } from "../platform/channel";
import { parseBackup } from "../model/backup";
import type { AppData, Location, TrainingSetup, TrainingSetups } from "../model/types";
import { useStore } from "../store/useAppStore";

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
  split: Split;
  /** Where the user trains (first run only: setups are edited on their own screen after that). */
  where: Where;
  /** Equipment for each place; only the chosen places are saved, each as a training setup. */
  home: EqDraft;
  gym: EqDraft;
  /** The place shown on the equipment step when there are two. */
  tab: Location;
  /** The usual place of the two. */
  at: Location;
  injuries: Injury[];
}

function defaultUnits(): Units {
  const lang = typeof navigator !== "undefined" ? navigator.language : "en-US";
  return /^en-(US|LR)|^my/i.test(lang) ? "lb" : "kg";
}

type Where = "home" | "gym" | "both";

function draftFrom(profile?: Profile, equipment?: Equipment): Draft {
  const units = profile?.units ?? defaultUnits();
  const totalIn = profile ? profile.heightCm / 2.54 : 0;
  const place: Location = equipment && hasGymEquipment(equipment) ? "gym" : "home";
  const home = place === "home" ? equipment : undefined;
  const gym = place === "gym" ? equipment : undefined;
  const where: Where = place;
  const at: Location = place;
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
    split: profile?.split ?? "push_pull",
    where: profile ? where : "home",
    home: eqDraftFrom(home, units, "home"),
    gym: eqDraftFrom(gym, units, "gym"),
    tab: at,
    at,
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
    // The choice is kept; with too few lifting days the plan runs full body until there are more.
    split: d.split,
    injuries: d.injuries,
    units: d.units,
  };
}

const placesFor = (w: Where): Location[] => (w === "both" ? ["home", "gym"] : [w]);

/** A training setup for each chosen place, or null while any of them is incomplete. */
function toSetups(d: Draft): TrainingSetups | null {
  const list: TrainingSetup[] = [];
  for (const p of placesFor(d.where)) {
    const equipment = toEquipment(d[p]);
    if (!equipment) return null;
    list.push({ id: p, name: p === "home" ? "Home" : "Gym", equipment });
  }
  return { list, usual: d.where === "both" ? d.at : d.where };
}

const SPLIT_OPTIONS: { value: Split; label: string; hint: string }[] = [
  { value: "push_pull", label: "Push / Pull", hint: "Push day: chest, shoulders and triceps, with one leg move. Pull day: back and biceps, with one hip move. Good with 2 to 5 lifting days." },
  { value: "full_body", label: "Full body", hint: "Every session trains a bit of everything. Best with 2 or 3 lifting days; a missed day leaves nothing out." },
  { value: "upper_lower", label: "Upper / Lower", hint: "Upper day: chest, back, shoulders and arms. Lower day: legs and glutes. Best with 2 or 4 lifting days." },
  { value: "ppl", label: "Push / Pull / Legs", hint: "Three focused days in rotation. Needs 3 or more lifting days a week (days you lift, not cardio days)." },
];

/**
 * Lifting days in a schedule. A treadmill only matters to a strength-first goal, where it can only
 * add lifting days at 4 or more days a week, so this is exact wherever a split's minimum is decided.
 */
const liftingDays = (days: number, goal: Goal): number => strengthDaysPerWeek(days, goal, { treadmill: true } as Equipment);

/** The draft's split, or full body when the schedule has too few lifting days for it. */
const splitFor = (split: Split, days: number, goal: Goal): Split => (liftingDays(days, goal) < SPLIT_MIN_STRENGTH_DAYS[split] ? "full_body" : split);
export const SPLIT_LABEL: Record<Split, string> = { push_pull: "Push / Pull", full_body: "Full body", upper_lower: "Upper / Lower", ppl: "Push / Pull / Legs" };

type Step = "welcome" | "you" | "experience" | "schedule" | "where" | "equipment" | "body" | "review";

export function Onboarding(props: {
  /**
   * An existing user's profile, the equipment their schedule is set from (the usual setup's), and
   * strength sessions they've logged (their plan's volume steps up with them). Editing leaves
   * equipment alone: training setups have their own screen.
   */
  initial?: { profile: Profile; equipment: Equipment; logged?: number };
  /** The profile, and on first run the setups for where the person trains (null when editing). */
  onDone: (profile: Profile, setups: TrainingSetups | null) => void;
  onCancel?: () => void;
}): React.ReactElement {
  const editing = !!props.initial;
  const steps: Step[] = editing ? ["you", "experience", "schedule", "body", "review"] : ["welcome", "you", "experience", "schedule", "where", "equipment", "body", "review"];
  const [i, setI] = useState(0);
  const [d, setD] = useState<Draft>(() => draftFrom(props.initial?.profile, props.initial?.equipment));
  const step = steps[i]!;
  const up = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const profile = toProfile(d);
  const setups = editing ? null : toSetups(d);
  const equipment = props.initial ? props.initial.equipment : setups ? (setups.list.find((x) => x.id === setups.usual) ?? setups.list[0])!.equipment : null;
  /** Equipment step: the place being edited (one of two, or the only one). */
  const editingPlace: Location = d.where === "both" ? d.tab : d.where;
  const otherIncomplete = d.where === "both" && setups === null && toEquipment(d[editingPlace]) !== null;

  const canNext =
    step === "you" ? !!d.sex && body(d) !== null
      : step === "experience" ? !!d.history
        : step === "equipment" ? setups !== null
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

  const next = () => {
    if (step === "review" && profile && equipment) props.onDone(profile, setups);
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

      {step === "welcome" ? <Welcome onStart={next} /> : null}

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
            <Seg label="Minutes per session" value={d.minutes} onChange={(minutes) => up({ minutes })} options={[10, 15, 20, 25, 30, 45, 60].map((n) => ({ value: n, label: String(n) }))} />
          </div>
          <p className="meta">
            That's <b className="num">{d.days * d.minutes} minutes</b> a week.{" "}
            {d.days * d.minutes >= 60 ? "Enough to make steady progress for a long time as a newer lifter." : "Short, but still enough to get measurably stronger."}
          </p>
          <div className="field">
            <span className="label">How should your lifting days be split?</span>
            <span className="meta small">A split is how your lifting days divide up your body. Focused days let each muscle get more work at once; full body trains everything every time.</span>
            <Choice
              label="Split"
              value={splitFor(d.split, d.days, d.goal)}
              onChange={(split) => up({ split })}
              options={SPLIT_OPTIONS.map((o) => {
                const lifting = liftingDays(d.days, d.goal);
                if (lifting >= SPLIT_MIN_STRENGTH_DAYS[o.value]) return o;
                return {
                  ...o,
                  disabled: true,
                  hint: `Needs ${SPLIT_MIN_STRENGTH_DAYS[o.value]} or more lifting days a week; your schedule has ${lifting}${d.days > lifting ? " (the rest are cardio)" : ""}. With fewer, most muscles would go a week or more untrained.`,
                };
              })}
            />
            <p className="meta small" role="status">
              {splitFor(d.split, d.days, d.goal) !== d.split
                ? `${SPLIT_LABEL[d.split]} needs ${SPLIT_MIN_STRENGTH_DAYS[d.split]} lifting days a week, so your plan runs full body for now. It switches back when your schedule has enough.`
                : ""}
            </p>
          </div>
        </section>
      ) : null}

      {step === "where" ? (
        <section className="stack-lg">
          <header className="stack">
            <p className="eyebrow">Equipment</p>
            <h1 className="title">Where do you train?</h1>
            <p className="meta">Home plans use what you own. Gym plans use machines, cables and barbells as well as dumbbells.</p>
          </header>
          <Choice
            label="Where you train"
            value={d.where}
            onChange={(where) => up({ where, tab: where === "gym" ? "gym" : "home", at: where === "gym" ? "gym" : d.at })}
            options={[
              { value: "home", label: "At home", hint: "Dumbbells, bands, bodyweight: whatever you have" },
              { value: "gym", label: "At a gym", hint: "Machines, cables, barbells and dumbbells" },
              { value: "both", label: "Both", hint: "Set up each place, then pick where you are on the day" },
            ]}
          />
          <p className="meta small">Each place is saved as a training setup. Add more, like a hotel gym or travel bands, any time from Today.</p>
        </section>
      ) : null}

      {step === "equipment" ? (
        <section className="stack-lg">
          <header className="stack">
            <p className="eyebrow">Equipment</p>
            <h1 className="title">{editingPlace === "gym" ? "What does your gym have?" : "What do you have at home?"}</h1>
            <p className="meta">Every exercise and weight comes from this list, so be exact about your dumbbells.</p>
          </header>
          {d.where === "both" ? (
            <div className="field">
              <Seg label="Place" value={d.tab} onChange={(tab) => up({ tab })} options={[{ value: "home", label: "Home" }, { value: "gym", label: "Gym" }]} />
              {otherIncomplete ? <span className="meta small">Now set up your {editingPlace === "home" ? "gym" : "home"} too.</span> : null}
            </div>
          ) : null}
          <EquipmentEditor key={editingPlace} place={editingPlace} draft={d[editingPlace]} onChange={(patch) => up({ [editingPlace]: { ...d[editingPlace], ...patch } } as Partial<Draft>)} />
          {d.where === "both" ? (
            <div className="field">
              <span className="label">Where do you usually train?</span>
              <Seg label="Usual setup" value={d.at} onChange={(at) => up({ at })} options={[{ value: "home", label: "Home" }, { value: "gym", label: "Gym" }]} />
              <span className="meta small">Workouts use your usual setup. Pick the other one for any workout from the Today screen.</span>
            </div>
          ) : null}
        </section>
      ) : null}

      {step === "body" ? (
        <section className="stack-lg">
          <header className="stack">
            <p className="eyebrow">Look after yourself</p>
            <h1 className="title">Anything that hurts?</h1>
            <p className="meta">Exercises that tend to bother these areas are left out. You can flag pain on any set later: that exercise stops for the day and comes back lighter, after a check-in.</p>
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

      {step === "review" && profile && equipment ? <Review profile={profile} equipment={equipment} logged={props.initial?.logged ?? 0} /> : null}

      {youMissing ? <p className="meta small">Fill in sex, age, height and weight to continue.</p> : null}

      {step === "welcome" ? null : (
        <div className="footer-actions">
          {i > 0 || props.onCancel ? (
            <button type="button" className="btn" onClick={back}>
              {i === 0 ? "Cancel" : "Back"}
            </button>
          ) : null}
          <button type="button" className="btn primary" onClick={next} disabled={!canNext}>
            {step === "review" ? (editing ? "Save changes" : "Start training") : "Next"}
          </button>
        </div>
      )}
    </main>
  );
}

/** The first screen: the promise and the way in come first, then installing, an example and restoring. */
function Welcome(props: { onStart: () => void }): React.ReactElement {
  return (
    <section className="stack-lg">
      <div className="brand">
        <CurveMark size={34} />
        <span>{APP_NAME}</span>
      </div>
      <header className="stack">
        <h1 className="title" style={{ fontSize: "2.7rem" }}>Real training in the minutes you have</h1>
        <p className="meta">
          Workouts that fit your time and your equipment, and get harder as you do. RepCurve picks every weight and rep for you, and adjusts each session from how the last one felt.
        </p>
      </header>
      <div className="footer-actions">
        <button type="button" className="btn primary" onClick={props.onStart}>
          Set up my plan
        </button>
      </div>
      <InstallCard beforeSetup />
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
          <span className="h3">Push day · 20 min</span>
          <span className="example-tag">Example</span>
        </div>
        <div className="lineup">
          <div className="lineup-group">
            <div className="lineup-tag">A</div>
            <div>
              <div className="lineup-item"><span>Push-up</span><span className="dose">3 × 10</span></div>
              <div className="lineup-item"><span>Goblet squat</span><span className="dose">3 × 12 · 25 lb</span></div>
            </div>
          </div>
          <div className="lineup-group">
            <div className="lineup-tag">B</div>
            <div>
              <div className="lineup-item"><span>Dumbbell overhead press</span><span className="dose">3 × 10 · 15 lb each</span></div>
              <div className="lineup-item"><span>Overhead triceps extension</span><span className="dose">3 × 12 · 15 lb</span></div>
            </div>
          </div>
        </div>
        <p className="meta small">Pairs of exercises alternate, so one muscle rests while the other works. That's how a real workout fits in 20 minutes.</p>
      </div>
      <RestoreBackup />
      <footer className="row" style={{ justifyContent: "center" }}>
        <PrivacyLink />
      </footer>
    </section>
  );
}

/** Start from a backup instead of setting up, e.g. when moving from the claude.ai version. */
function RestoreBackup(): React.ReactElement {
  const store = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<AppData | null>(null);
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ tone: "good" | "stop"; text: string } | null>(null);
  const read = (text: string) => {
    const r = parseBackup(text);
    if (!r.ok) setMsg({ tone: "stop", text: r.error });
    else if (!r.data.core) setMsg({ tone: "stop", text: "That backup has no profile in it, so there's nothing to restore." });
    else {
      setPending(r.data);
      setMsg(null);
    }
  };
  return (
    <div className="stack">
      <p className="meta small">Already use RepCurve somewhere else? Export a backup there (Settings → Export backup), then restore it here.</p>
      <div className="row-wrap">
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          Restore from a backup
        </button>
        <button type="button" className="btn ghost" onClick={() => setPasting(!pasting)} aria-expanded={pasting}>
          Paste one instead
        </button>
      </div>
      {pasting ? (
        <div className="field">
          <label htmlFor="restore-paste">Backup text</label>
          <textarea id="restore-paste" className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder='{"format":"repcurve-backup", …}' />
          <button type="button" className="btn" disabled={!text.trim()} onClick={() => read(text)}>Check backup</button>
        </div>
      ) : null}
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void f.text().then(read);
          e.target.value = "";
        }}
      />
      {msg ? <div className={`banner ${msg.tone}`} role="status">{msg.text}</div> : null}
      {pending ? (
        <div className="banner info">
          <b>Restore this backup?</b>
          It has your profile and {pending.history.length} sessions.
          <div className="row" style={{ marginTop: 10 }}>
            <button type="button" className="btn" onClick={() => setPending(null)}>Cancel</button>
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                const d = pending;
                setPending(null);
                void store.replaceAll(d).catch(() => setMsg({ tone: "stop", text: "That didn't finish saving. Try again." }));
              }}
            >
              Restore
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Review(props: { profile: Profile; equipment: Equipment; logged: number }): React.ReactElement {
  const program = useMemo(() => previewProgram(props.profile, props.equipment, undefined, props.logged), [props.profile, props.equipment, props.logged]);
  const first = program.sessions.find((s) => s.kind === "strength");
  const projection = useMemo(() => previewProjection(props.profile, props.equipment, undefined, props.logged), [props.profile, props.equipment, props.logged]);
  return (
    <section className="stack-lg">
      <header className="stack">
        <p className="eyebrow">Your plan</p>
        <h1 className="title">
          {props.profile.daysPerWeek} days · {props.profile.minutesPerSession} minutes ·{" "}
          {SPLIT_LABEL[effectiveSplit(props.profile, strengthDaysPerWeek(props.profile.daysPerWeek, props.profile.goal, props.equipment))]}
        </h1>
      </header>
      <ProjectionCard projection={projection} units={props.profile.units} compact />
      <PlanExplanation lines={program.explanation} />
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
