# RepCurve — Product & Technical Plan

> Working draft. Sections marked **[verify]** contain numbers pulled from training literature that should be re-checked against primary sources before they ship in the projection model.

---

## 1. Product in one paragraph

RepCurve is a mobile-first strength training app. You tell it what equipment you have, how many days a week you can train, and how long each session can be. It benchmarks where you are today, generates an evidence-based program that fits those constraints, and then adjusts every future session's weights and reps based on what you actually did and how hard it felt. Alongside the program it shows a **projection curve**: given your profile and your weekly training dose, here is the range of strength and muscle change you can expect at week 4, 8, 12, 26, 52 — and as you log workouts, the projection recalibrates to your real trajectory.

The name is the product: every lifter has a curve, and the app's job is to show it to you and bend it upward.

---

## 2. Core loops

```
Onboard ──> Equipment ──> Benchmark ──> Generate program ──> Train & log
                                             ^                   │
                                             │                   v
                                        Replan  <──  Autoregulate (per set / per session)
                                             │
                                             v
                                   Projection recalibrates (weekly)
```

Three loops run at different timescales:

| Loop | Timescale | What it does |
|---|---|---|
| **Set loop** | within a workout | Suggest weight × reps for the next set from the last set's reps + RPE |
| **Session loop** | between workouts | Double progression, load bumps, back-offs, readiness scaling |
| **Block loop** | every 4–8 weeks | Volume ramp, reactive deload, exercise rotation, projection update |

---

## 3. Features, grouped by the user's journey

### 3.1 Onboarding & profile
- Sex, age, height, bodyweight, (optional) waist, (optional) body-fat estimate.
- Training history: never / <6 months / 6–24 months / 2+ years / returning after layoff.
- Goal: **build muscle**, **get stronger**, **recomp / lose fat while keeping muscle**, **general fitness**. Goals shift rep ranges, load targets and which projection metrics are emphasised — they don't produce wildly different programs for novices (and the app should say so).
- Schedule: days/week (1–6), minutes/session (20–120), which weekdays if they want fixed days.
- Injuries / movements to avoid (knee, low back, shoulder, wrist) → filters the exercise pool.
- Preferences: units, whether they like barbell work, whether they'll do bodyweight work.

### 3.2 Equipment inventory
Equipment is the hard constraint on everything downstream, so it gets its own model rather than a tag list.

- **Quick presets:** commercial gym (everything), home barbell gym, dumbbell-only, bodyweight + bands, hotel gym, kettlebell-only.
- **Detailed inventory** on top of a preset:
  - Barbell (standard/olympic), plate set → derive available **loading increments** (e.g. smallest plate 1.25 kg → 2.5 kg jumps).
  - Dumbbells: fixed set with explicit list (5, 10, 15, 20…) or adjustable with max.
  - Rack / stands, bench (flat / adjustable), pull-up bar, dip station.
  - Cable stack (single/dual), common machines (leg press, hack squat, lat pulldown, chest press, leg curl/ext, smith).
  - Kettlebells (list), bands (light/med/heavy), suspension trainer.
- **Multiple locations:** home + gym + travel. Each session is generated for a location; the user can switch mid-week and the session is re-planned with substitutes.
- **Later: photo inventory** — snap a photo of the home gym / dumbbell rack, a vision model proposes the inventory, user confirms. (Great demo feature; not MVP.)

### 3.3 Benchmark ("Week 0 assessment")
Purpose: set starting loads, classify training level, and anchor the projection.

- **Never test a true 1RM on a novice.** Use submaximal AMRAP sets: pick a conservative load, perform reps to ~2 RIR, estimate e1RM with Epley (`w × (1 + reps/30)`) cross-checked with an RPE→%1RM table.
- One benchmark lift per movement pattern, chosen from what the equipment allows:
  - Squat pattern (back squat / goblet squat / leg press)
  - Hinge (deadlift / RDL / KB deadlift)
  - Horizontal push (bench / DB press / push-up AMRAP)
  - Vertical pull (pull-up AMRAP / lat pulldown / band pulldown)
  - Horizontal pull (row variant)
  - Vertical push (overhead press variant)
- Bodyweight tests where relevant: push-ups, pull-ups/chin-ups, plank or hanging hold.
- Classify each lift against **bodyweight-relative strength standards** (untrained → novice → intermediate → advanced → elite, adjusted for sex and age). The user's overall "training level" is derived from these, not from self-reported history alone.
- Optional: baseline photos & measurements (chest, arms, waist, thighs) to make the "describe your change over time" piece concrete later.
- Output: a **Baseline card** — e1RMs, strength-standard percentiles, estimated training level, body metrics. This is the "before" the projection is drawn from.

### 3.4 Program generation
A constraint solver, not a template picker. Inputs: profile, goal, equipment, days/week, minutes/session, injuries, benchmark. Output: a mesocycle (4–8 weeks) of sessions.

**Step 1 — Choose split from days/week**
| Days | Default split | Alternative |
|---|---|---|
| 1 | Full body | — |
| 2 | Full body ×2 | — |
| 3 | Full body ×3 | Upper / Lower / Full |
| 4 | Upper / Lower ×2 | — |
| 5 | Upper / Lower / Push / Pull / Legs | Full-body ×5 (short sessions) |
| 6 | Push / Pull / Legs ×2 | Upper / Lower ×3 |

**Step 2 — Set weekly volume targets per muscle group**
- Target hard sets/muscle/week by level: novice ~8–10, intermediate ~12–16, advanced ~16–20+ (diminishing returns above; see §5). **[verify]**
- Scale down proportionally when the time budget can't fit it; prioritise by goal (hypertrophy → spread across muscles; strength → prioritise the main lifts).

**Step 3 — Fill sessions under a time budget**
- Every exercise carries an estimated **time cost**: `sets × (rep_time + rest)` + warm-up sets for the first compound.
  - Compound rest 2–3 min, isolation 60–90 s.
- Short sessions (≤35 min) use time-efficient structures with evidence behind them: antagonist supersets, rest-pause, drop sets, fewer exercises with more sets.
- Each session: 1–2 primary compounds (progressed most carefully) + accessories to hit the muscle-set targets.
- Exercise selection from a pool filtered by equipment + injuries, ranked by: movement-pattern coverage, muscle targets, user preference, and a mild rotation so months don't look identical.

**Step 4 — Assign rep ranges, loads and progression scheme**
- Strength emphasis: 3–6 reps at ~75–85% e1RM on main lifts.
- Hypertrophy: 6–12 (compounds) and 8–20 (isolation), taken to ~1–3 RIR.
- Starting load = `e1RM × target % for the rep range`, rounded **down** to the nearest achievable increment for that equipment, then a conservative first-week discount (~5%).
- Progression scheme per exercise (see §4).

**Step 5 — Explain it**
Every program ships with a plain-language explanation: why this split, why these sets, what the first 2 weeks will feel like. (Good candidate for LLM-generated narration over a structured plan; the plan itself stays deterministic.)

### 3.5 Training & logging (the in-gym screen)
- Today's session: exercises, target weight × reps × sets, rest timer.
- Per set: log weight, reps, RPE (or RIR — one scale, user picks). Default values pre-filled so a "normal" set is one tap.
- Live suggestions: "Last set was 8 @ RPE 7 — next set: same weight, aim 9" / "That was RPE 10, drop to 60 kg."
- Swap exercise (equipment taken / pain) → substitution from the same pattern/muscle, loads re-estimated.
- Shorten session (running out of time) → the engine drops lowest-priority accessories first.
- **Offline-first.** Gyms have terrible signal. All logging must work with no network and sync later.

### 3.6 Autoregulation & replanning
See §4. The user-visible promise: *you never have to decide what weight to put on the bar.*

### 3.7 Progress & projection
- **Strength curves** per lift: e1RM over time, with the projected band drawn underneath the actual line.
- **Volume & adherence:** sets/muscle/week vs target, sessions completed vs planned.
- **Body metrics:** weight, measurements, photos (optional), with trend smoothing.
- **Projection card** (the headline feature) — see §5.
- **Milestones:** "First bodyweight bench", "Intermediate squat standard", "100 sessions".

### 3.8 Readiness (post-MVP)
- 3-question pre-session check-in: sleep, soreness, motivation → scale the day's loads ±5% / reduce volume.
- Optional wearable import (HRV, sleep) later.

---

## 4. Autoregulation engine — rules

Deterministic, unit-tested, no ML needed for v1.

### Per-set (within a workout)
- Every logged set yields an e1RM estimate: `e1RM = w × (1 + reps/30)` adjusted by RPE (RPE 8 means ~2 reps in reserve → treat as `reps + 2` for estimation, capped).
- Next-set suggestion: hold weight if RPE within target band; drop ~5% if RPE ≥ 9.5 and reps missed; add an increment on isolation work if RPE ≤ 6.

### Per-exercise, between sessions (double progression + load steps)
```
if all sets hit top of rep range and avg RPE ≤ target+0.5:
    load += min_increment(equipment)   # e.g. +2.5 kg barbell, next DB, +1 band
elif any set below bottom of range OR avg RPE ≥ target+1.5:
    if this happened 2 sessions in a row: load -= 5–10%, reset reps to bottom of range
else:
    keep load, target +1 rep on the weakest set
```
- Novices: linear progression on main lifts (add load every session) until two consecutive stalls, then switch to double progression.
- Intermediates: weekly e1RM target with RPE-based load (`load = e1RM × %` from RPE table), so a bad day automatically lightens the bar.

### Per-block (every 4–8 weeks)
- **Reactive deload**, not scheduled by default: trigger when 7-day avg RPE drifts > +1 above target, or e1RM on ≥2 main lifts declines over 2 weeks, or readiness is low for 3+ sessions. Deload = −40–50% sets, −10% load for one week. (Evidence that fixed scheduled deloads help is weak; reactive is the defensible default. **[verify]**)
- Volume ramp: start a block ~2 sets below target per muscle, add 1 set/muscle/week until target or until recovery markers say stop.
- Rotation: swap 1–2 accessories per block; keep primaries stable so the strength curve is comparable.

### Safety rails
- Never increase load > 10% in one step.
- Hard cap on volume increase per week (+20%).
- Flag pain (vs. normal effort) in the RPE picker → exercise swapped and logged for the user to review.

---

## 5. Projection model ("what to expect at week N")

This is the differentiator and also the easiest place to overpromise, so the design principle is: **ranges, not points; conditional on behaviour; recalibrated from the user's own data.**

### 5.1 What we project
| Metric | How we measure it | Confidence |
|---|---|---|
| e1RM per main lift | Directly from logs | High |
| Overall strength level (standard percentile) | Derived from e1RMs | High |
| Lean mass change (kg / %) | Modelled; optional scale / DEXA / measurements | Low–medium |
| Bodyweight & waist trend | User-entered | Medium (depends on diet) |
| Visible change narrative | Rules over the above | Qualitative |

### 5.2 Model shape
- **Strength:** diminishing-returns curve toward a ceiling. The ceiling comes from the strength standards for the user's sex, bodyweight and age; the rate comes from the training dose. A practical form: `gain(t) = G_max × (1 − e^(−k·t))` where `G_max` is the distance to the next standard tier and `k` is a function of (weekly effective sets on that pattern, proximity to failure, frequency, training age, age, sex). Novices start on the steep part of the curve; the model explicitly tells them the first 12 weeks are the fastest they'll ever progress.
- **Muscle:** same shape, slower, with a wide band. Priors from meta-analyses of resistance training in untrained adults (roughly ~1–2 kg lean mass over 10–12 weeks for men on an adequate program and enough protein; women ~half to two-thirds in absolute terms; both decline with training age and modestly with age). **[verify — pull exact figures from Benito et al. 2020 meta-analysis, Schoenfeld dose-response work, Pelland et al. 2024 volume meta-regression, Robinson et al. 2024 proximity-to-failure meta-analysis before coding priors.]**
- **Dose inputs:** sessions/week × minutes/session → predicted hard sets per muscle per week (from the generated program, not a guess), proximity to failure (from logged RPE), and adherence (sessions completed / planned). The 80-min/week lifter and the 300-min/week lifter get genuinely different curves, driven by the actual program.
- **Modifiers** the user can optionally supply and that visibly move the band: protein intake bracket, sleep bracket, caloric intent (deficit / maintenance / surplus). If they decline, the band widens rather than assuming the best case.
- **Recalibration:** every week, compare actual e1RM trajectory to the projected band → shift the user's personal `k` (Bayesian update or a simple exponentially weighted correction). Show "you're tracking at the 65th percentile of your projection" and re-draw the future.

### 5.3 How it reads to the user (example copy)
> **You, at week 12.** New lifter, male, 33, training 2×40 min/week.
> - Squat e1RM: 60 kg → **85–100 kg** (most likely ~92)
> - Bench e1RM: 45 kg → **60–70 kg**
> - Lean mass: **+1.0 to +2.0 kg** if you eat at maintenance or above with ~1.6 g/kg protein; closer to +0.5 kg in a deficit, where the win is fat loss while keeping muscle.
> - What you'd notice: fuller upper back and quads, clothes fit differently in the shoulders before the arms. Scale weight may barely move in a recomp.
> - Caveat shown inline: ranges cover ~80% of people like you who complete ≥85% of sessions.

Always paired with: *projections are population estimates, not medical advice, and will update as you train.*

---

## 6. Exercise science basis (the rules the engine encodes)

Short list of principles, each mapped to an engine parameter so they can be tuned without rewriting code. **[verify each against current literature before launch; several have moved in the last 3 years]**

| Principle | Engine parameter |
|---|---|
| Hypertrophy is driven mainly by weekly hard sets per muscle, with diminishing returns beyond ~15–20 | `volume_targets[level]`, `volume_cap` |
| Sets must be close to failure (~0–3 RIR) to count as "hard"; strength is less sensitive to RIR than hypertrophy | `target_rpe[goal]`, effective-set counting |
| Loads from ~30% to ~85% 1RM all build muscle if near failure; strength needs ≥ ~80% exposure | `rep_ranges[goal]`, `pct_table` |
| Frequency matters mostly as a way to distribute volume; ≥2×/muscle/week is a reasonable default | split selection |
| Rest 2–3 min on compounds beats short rest for both outcomes | `rest_seconds[exercise_type]` |
| Training at long muscle lengths / full ROM is at least as good, often better | exercise ranking weights |
| Time-efficient methods (supersets, rest-pause, drop sets) preserve most of the stimulus per minute | short-session planner |
| Novices progress on almost anything; linear progression stalls → switch to double progression / RPE | `progression_scheme[level]` |
| Reactive deloads are at least as good as scheduled ones | deload triggers |
| Minimum effective dose: even 1 hard set × 2–3×/week produces measurable strength gains | floor for 1–2 day programs; projection still non-zero |
| Protein ~1.6 g/kg/day; sleep; energy balance set the ceiling on muscle gain | projection modifiers |

Keep a `docs/EVIDENCE.md` that lists each rule, the source(s), and the date last reviewed. This makes "incorporates the latest exercise science" a maintained claim instead of a marketing line.

---

## 7. Architecture

### 7.1 Principles
- **Engine as a pure library.** Program generation, autoregulation and projection are pure TypeScript functions over plain data: `(state, event) → new state`. No I/O. Runs identically on device and server. Fully unit-testable with fixtures ("a 33-year-old novice male with dumbbells and 2×40 min").
- **Offline-first client.** Local database is the source of truth while training; sync is background.
- **LLMs for language, not for math.** Explanations, Q&A about the plan, photo-to-inventory, and narrative projections can use Claude. Loads, reps and projections come from the deterministic engine so they're testable and reproducible.

### 7.2 Proposed stack (opinionated default; swap if you have a preference)
| Layer | Choice | Why |
|---|---|---|
| Mobile app | React Native + Expo, TypeScript | One codebase for iOS/Android, fast iteration, shares the engine's TS |
| Local DB | expo-sqlite (via Drizzle) or WatermelonDB | Offline-first logging, sync-friendly |
| Backend | Supabase (Postgres, auth, row-level security, edge functions) | Minimal ops for a solo/small team; swap for a Node API later if needed |
| Engine | `packages/engine` (pure TS, no deps) | Shared by app + server + CLI |
| Exercise DB | JSON/YAML in-repo → seeded to Postgres | Reviewable in PRs, versioned |
| AI | Claude API (vision for equipment photos; text for narration) | Behind a server function, never from the device with a raw key |
| Analytics / crash | PostHog + Sentry | Standard |
| CI | GitHub Actions: typecheck, lint, engine tests, Expo build | — |

### 7.3 Monorepo layout
```
repcurve/
  apps/
    mobile/          # Expo app
    web/             # (later) marketing + web dashboard
  packages/
    engine/          # generation, autoregulation, projection — pure TS
    exercises/       # exercise & equipment taxonomy + data
    shared/          # types, units, formulas (Epley, RPE tables)
  services/
    api/             # Supabase migrations, edge functions
  docs/
    PLAN.md
    EVIDENCE.md      # rule → source → last reviewed
    DATA_MODEL.md
```

### 7.4 Data model (first cut)
```
User            id, email, created_at
Profile         user_id, sex, dob, height_cm, bodyweight_kg, training_history, goal, injuries[], units
Location        id, user_id, name, preset
EquipmentItem   location_id, type, attrs (json: dumbbell list, plate set, machine kind…)
Exercise        id, name, pattern, primary_muscles[], secondary_muscles[], equipment_requirements[], unilateral, rep_time_s, default_rest_s, substitutes[]
Benchmark       id, user_id, date, lift_id, load, reps, rpe, e1rm, standard_percentile
Program         id, user_id, created_at, params (json: days, minutes, goal, location), explanation
Mesocycle       program_id, index, start_date, weeks, volume_targets (json)
SessionPlan     mesocycle_id, day_index, week, location_id, exercises[] (json: exercise_id, sets, rep_range, target_load, target_rpe, rest_s, priority)
SessionLog      id, session_plan_id, started_at, finished_at, readiness (json), notes
SetLog          session_log_id, exercise_id, set_index, load, reps, rpe, pain_flag, e1rm
BodyMetric      user_id, date, weight_kg, waist_cm, measurements (json), photo_ref
Projection      user_id, created_at, horizon_weeks, metrics (json: per-lift bands, lean mass band), k_personal
```

---

## 8. Phased roadmap

### Phase 0 — Foundations (engine-first, no UI) · ~3–4 weeks
- Exercise + equipment taxonomy (~120 exercises covers 95% of needs).
- Engine: split selection, volume targets, time-budgeted session fill, starting loads, double progression, e1RM math.
- CLI: `repcurve generate --profile fixture.json` prints a 4-week program; snapshot tests.
- `EVIDENCE.md` v1 with the parameters above and their sources.
- Success: generate sensible programs for 6 fixture personas × 4 equipment presets × 3 schedules without a human fixing anything.

### Phase 1 — MVP app · ~6–8 weeks
- Onboarding, equipment presets + detailed inventory, Week 0 benchmark flow.
- Program view, in-gym logging screen with live suggestions, rest timer, exercise swap.
- Between-session autoregulation.
- Basic progress: e1RM charts, sessions completed.
- Offline logging + sync, auth.
- Success: a new user goes from install to logged first workout in < 10 minutes; a month of use needs zero manual weight decisions.

### Phase 2 — Projection & curve · ~4–6 weeks
- Projection model with population priors + weekly recalibration.
- Baseline card, projection card, "you vs. your projection" chart.
- Reactive deloads, volume ramps, readiness check-in.
- Narrative explanations (LLM over structured plan/projection).

### Phase 3 — Delight & growth
- Photo → equipment inventory.
- Multiple locations with per-day switching, travel mode.
- Wearable/sleep import, nutrition bracket integration.
- Sharing a "curve" image, milestones, optional coach view.
- Web dashboard.

---

## 9. Risks & open questions

**Product**
- Overpromising on body-composition numbers. Mitigation: wide bands, conditional language, recalibration, no fat-loss claims without nutrition context.
- Benchmarking fatigue: Week 0 must feel like a workout, not a test. Fold it into the first two sessions.
- Novice users don't know RPE. Mitigation: RIR picker with plain words ("could have done 2 more"), and auto-calibration from AMRAP sets.

**Technical**
- Sync conflicts on an offline-first log (two devices). Keep set logs append-only; conflicts resolve by union.
- Equipment combinatorics in exercise selection. Keep requirements as simple AND/OR of equipment types; test with presets.

**Legal / safety**
- Not medical advice; injury screen must route "pain" to "stop and consult" language. Store photos/body data with explicit consent and deletion.

**Decisions needed from you**
1. Platform priority: iOS first, Android first, or both via Expo from day one? (Plan assumes both via Expo.)
2. Stack: happy with React Native + Supabase + TypeScript engine, or do you have a preferred backend?
3. Scope of nutrition: bracket-only inputs (plan assumes this) vs. full food logging (big scope, suggest no).
4. Monetisation: free core + paid projection/coaching tier, or paid up front? Affects what goes behind auth and server functions.
5. Team: solo build or multiple contributors? Affects how much CI/monorepo scaffolding to set up in Phase 0.

---

## 10. Immediate next steps
1. Confirm the decisions in §9.
2. Scaffold the monorepo (Phase 0 skeleton: `packages/engine`, `packages/exercises`, CLI, tests, CI).
3. Draft `EVIDENCE.md` and verify every **[verify]** number against sources.
4. Write the first 30 exercises + equipment taxonomy and get `repcurve generate` producing a program for the "33-year-old male novice, 2×40 min, dumbbells + bench" persona.
