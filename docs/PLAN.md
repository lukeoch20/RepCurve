# RepCurve — Product & Technical Plan

> Working draft, v2. Sections marked **[verify]** contain numbers pulled from training literature that should be re-checked against primary sources before they ship in the projection model.

---

## 0. Decisions so far

| Decision | Choice |
|---|---|
| Who it's for | Busy people training at home with little equipment, little time and little gym experience. Reference user: a parent of toddlers with dumbbells, a treadmill and an ab roller, who can carve out ~20 minutes a day. |
| Nutrition | **Out of scope.** No food logging, no calorie or protein tracking. Projections assume roughly maintenance eating and say so in one line. |
| Monetisation | None. Personal-use MVP. |
| Team | Solo build. Minimal tooling, no premature infrastructure. |
| Platform / stack | **Recommended: installable web app (PWA), local-only data, pure TypeScript engine.** See §7 for the alternatives. Awaiting confirmation. |
| Equipment focus for MVP | Dumbbells, bodyweight, treadmill, ab roller, mat. Bench, pull-up bar and bands as optional extras. Commercial-gym and barbell support deferred. |

---

## 1. Product in one paragraph

RepCurve is a workout app for people who want meaningful training at home in about 20 minutes a day. You tell it what you have (a set of dumbbells, maybe a treadmill, an ab roller), how many days a week you can show up, and how long you've got. It benchmarks where you are today, builds a short, dense program that fits your constraints, and adjusts every session's weights and reps from what you actually did and how hard it felt. Alongside the program it shows a **projection curve**: given your profile and your real weekly training dose, here is the range of strength and muscle change you can expect at week 4, 8, 12, 26 and 52. As you log workouts the projection recalibrates to your own trajectory.

The name is the product: every lifter has a curve, and the app's job is to show it to you and bend it upward.

**Design principles**
- **Low barrier.** From install to first logged workout in under five minutes. No account, no payment, no equipment you don't own.
- **Decisions made for you.** You never choose a weight, a rep count or an exercise. You can override, but you never have to.
- **Short and dense.** 20 minutes is the default, not the exception. Every session is planned under a hard time budget.
- **Honest about outcomes.** Ranges, not promises. The projection is conditional on showing up and updates from your data.

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

| Loop | Timescale | What it does |
|---|---|---|
| **Set loop** | within a workout | Suggest weight × reps for the next set from the last set's reps + effort |
| **Session loop** | between workouts | Double progression, dumbbell step-ups, back-offs, "tired today" scaling |
| **Block loop** | every 4–6 weeks | Volume ramp, reactive deload, exercise ladders, projection update |

---

## 3. Features, grouped by the user's journey

### 3.1 Onboarding & profile (≈2 minutes)
- Sex, age, height, bodyweight.
- Training history: never / a little / used to, lapsed / regular.
- Goal: **build muscle & get stronger** (default), **get fitter** (more treadmill), **both**. Goals shift the mix of strength and cardio days and which projection metrics lead; novice programs otherwise look similar and the app says so.
- Schedule: days/week (2–6), minutes/session (15–30, default 20).
- Anything that hurts: knees, low back, shoulders, wrists → filters the exercise pool.
- Units.

### 3.2 Equipment inventory
Equipment is the hard constraint on everything downstream, so it is a real model rather than a tag list.

- **Dumbbells:** fixed set (list each weight: 10, 15, 20, 25 lb…) or adjustable (min, max, step). From this the engine derives the **available load steps**, which matter a lot (see §4).
- **Treadmill:** yes/no, max incline, max speed.
- **Bodyweight & core tools:** mat, ab roller, pull-up bar (doorway), bench or sturdy chair/step, resistance bands (light/med/heavy).
- **Presets:** "Dumbbells only", "Dumbbells + treadmill", "Bodyweight only", with a detail screen on top.
- **Later:** more than one location; photo → inventory.

### 3.3 Benchmark ("Week 0", folded into the first two sessions)
Purpose: set starting loads, place you on a strength scale, anchor the projection. It should feel like a workout, not a test.

- **No max attempts.** Submaximal sets to ~2 reps in reserve; estimate e1RM with Epley (`w × (1 + reps/30)`), cross-checked against an RPE→%1RM table.
- One benchmark per movement pattern, using what the user owns:
  - Squat: goblet squat AMRAP at a chosen dumbbell
  - Hinge: dumbbell Romanian deadlift
  - Horizontal push: push-up AMRAP (or incline push-up / DB floor press)
  - Row: single-arm dumbbell row
  - Vertical push: dumbbell overhead press
  - Core: ab-roller rollouts or plank hold
  - Cardio (if treadmill): 12-minute walk/run distance, or 1-mile walk time with heart rate if they have a watch **[verify which test to use]**
- Classify each lift against **bodyweight-relative strength standards** adjusted for sex and age (untrained → novice → intermediate → advanced). The user's training level is derived from this, not from self-report alone.
- Optional: baseline measurements (waist, chest, arms, thighs) and a photo, so "describe your change over time" has something concrete to compare.
- Output: a **Baseline card**.

### 3.4 Program generation
A constraint solver over days/week, minutes/session, equipment, injuries and benchmark. Output: a 4–6 week block of sessions.

**Step 1 — Weekly template from days/week and goal**
Short sessions mean every session is full-body. More days = more frequency, not a split.

| Days | Strength | Cardio / hybrid |
|---|---|---|
| 2 | 2 full-body | — |
| 3 | 2–3 full-body | 0–1 treadmill |
| 4 | 3 full-body | 1 treadmill or hybrid |
| 5 | 3 full-body | 2 treadmill / hybrid |
| 6 | 3–4 full-body | 2–3 treadmill / hybrid |

"Hybrid" = ~10 min dumbbell circuit + ~8 min treadmill.

**Step 2 — Weekly hard-set targets per muscle group**
- Novice ~8–10, intermediate ~12–16, advanced ~16+ hard sets per muscle per week; diminishing returns beyond. **[verify]**
- What 20 minutes buys: ~14–16 minutes of work after warm-up and transitions. Using supersets (two exercises alternated, ~45 s between), that's roughly **12–14 hard sets per session**. Four strength sessions a week ≈ 50 hard sets ≈ 8–10 per major muscle group. That is squarely in the effective range for a novice, which is the honest pitch: *20 minutes, four days a week, is enough to make real progress for the first year.*
- Scale targets down when the budget can't fit them; prioritise by goal.

**Step 3 — Fill each session under the time budget**
- Every exercise carries a **time cost**: `sets × (reps × rep_time + rest)` plus a 2-minute warm-up for the first movement.
- Default structure for a 20-minute strength day:
  - 2 min: warm-up (bodyweight versions of today's first two moves)
  - 2 supersets × 3 rounds (≈ 7 min each): e.g. A1 goblet squat / A2 push-up; B1 DB RDL / B2 one-arm row
  - 2 min: core finisher (ab roller, plank, dead bug)
- Shorter budgets drop the finisher, then a round; longer budgets add a third superset.
- Exercise selection from the equipment- and injury-filtered pool, ranked by pattern coverage, muscle targets, user preference, and gentle rotation.

**Step 4 — Rep ranges, loads, progression**
- Rep ranges are wide on purpose (8–15 compounds, 10–20 isolation, push-ups to near-failure) because dumbbell steps are coarse.
- Starting load = `e1RM × target %` for the range, rounded **down** to an owned dumbbell, then a conservative first-week discount.
- Progression scheme per exercise: see §4.

**Step 5 — Treadmill sessions**
- Cardio days are prescribed like strength: incline walk, steady run, or intervals (e.g. 8 × 1 min hard / 1 min easy), scaled from the baseline test and the previous session's self-reported effort.
- Logged as duration, speed, incline, effort. Progression: a little more speed, incline or interval count each week; a reactive easy week when effort drifts up.

**Step 6 — Explain it**
Every program ships with a plain-language note: why this structure, what the first two weeks will feel like, and why 20 minutes is enough. (Good candidate for LLM narration over a structured plan; the plan itself stays deterministic.)

### 3.5 Training & logging (the in-session screen)
- Today's session with a running clock. Big buttons. One-handed.
- Per set: weight (pre-filled), reps (pre-filled with the target), effort as plain words: *"easy" / "a few left" / "1–2 left" / "nothing left"* mapped to RIR 4+/3/1–2/0.
- Live suggestion for the next set.
- "Swap" (equipment busy, something hurts) → substitute from the same pattern.
- "I only have 12 minutes today" → the engine trims lowest-priority work first.
- **Pause and resume.** Toddlers happen. A session can be paused mid-set and finished later the same day without losing its place.
- **Offline-first.** Everything works with no network.

### 3.6 Autoregulation & replanning
See §4.

### 3.7 Progress & projection
- **Strength curves** per movement: e1RM over time with the projected band drawn underneath.
- **Consistency:** sessions completed vs planned, current streak, minutes trained this week.
- **Body metrics:** weight and measurements if entered, trend-smoothed.
- **Projection card** (§5).
- **Milestones:** first unassisted push-up set of 20, first 20 kg goblet squat for 15, 50 sessions, and so on.

### 3.8 Readiness (post-MVP)
Two taps before a session (slept badly? sore?) → scale today's loads −5% or drop a round.

---

## 4. Autoregulation engine — rules

Deterministic, unit-tested, no ML in v1.

### Dumbbells change the progression problem
Barbell lifters add 2.5 kg, about 3% on a 80 kg lift. A home lifter going from a 15 lb to a 20 lb dumbbell is making a **33% jump**. The engine therefore progresses along several axes before it asks for a heavier dumbbell:

1. **Reps** within a wide range (double progression): 3×8 → 3×15 at the same weight.
2. **Density:** same work, shorter superset rest.
3. **Tempo / pauses:** 3-second lowering, paused reps.
4. **Harder variant on the same ladder:** goblet squat → DB front squat → Bulgarian split squat → single-leg; push-up incline → floor → feet-elevated → one-arm progressions; two-arm row → one-arm row → chest-supported.
5. **Heavier dumbbell**, resetting to the bottom of the rep range.

Which axis to pull is a function of the available load step: if the next dumbbell is ≤ 15% heavier, step up when the top of the range is hit; if it's more, exhaust reps and variants first. When the user outgrows their heaviest dumbbell on a pattern, the ladder keeps progressing without buying anything.

### Per-set (within a workout)
- Each logged set yields an e1RM estimate (Epley, adjusted by reps in reserve).
- Next-set suggestion: hold if effort in band; drop a dumbbell if "nothing left" and reps missed; nudge reps up if "easy".

### Per-exercise, between sessions
```
if all sets hit top of range and effort ≤ target:
    advance along the progression axis chosen for this exercise/equipment
elif any set below bottom of range, or effort over target, two sessions running:
    step back one level and reset reps to bottom of range
else:
    keep load, target +1 rep on the weakest set
```

### Per-block (every 4–6 weeks)
- **Reactive deload**, not scheduled: trigger when effort drifts over target for a week, or e1RM on two or more patterns declines for two weeks. Deload = one week at −40% rounds. (Evidence for fixed scheduled deloads is weak; reactive is the defensible default. **[verify]**)
- Volume ramp: start a block one round below target, add a round after week 2 if recovery allows.
- Rotation: swap one accessory per block; keep the benchmarked movements stable so curves stay comparable.

### Safety rails
- Never increase load more than one dumbbell step at a time.
- Hard cap on weekly volume increase (+20%).
- "It hurt" is a separate button from effort → exercise swapped, flagged for review, "stop and see someone" language if repeated.

---

## 5. Projection model ("what to expect at week N")

The differentiator, and the easiest place to overpromise. Principle: **ranges, not points; conditional on behaviour; recalibrated from the user's own data.**

### 5.1 What we project
| Metric | How we measure it | Confidence |
|---|---|---|
| e1RM per movement pattern | Directly from logs | High |
| Strength level (standard percentile) | Derived from e1RMs | High |
| Push-up / rollout rep capacity | Directly from logs | High |
| Lean mass change (kg / %) | Modelled; optional measurements | Low–medium |
| Cardio: 12-min distance / walk pace | From treadmill logs | Medium |
| Visible change narrative | Rules over the above | Qualitative |

### 5.2 Model shape
- **Strength:** diminishing-returns curve toward a ceiling: `gain(t) = G_max × (1 − e^(−k·t))`. `G_max` is the distance to the next strength-standard tier for the user's sex, bodyweight and age; `k` comes from the training dose (weekly hard sets on that pattern, closeness to failure from logged effort, frequency), training age and age. Novices sit on the steep part; the model tells them plainly that the first 12 weeks are the fastest they will ever progress.
- **Muscle:** same shape, slower, wider band. Priors from meta-analyses of resistance training in untrained adults, roughly ~1–2 kg lean mass over 10–12 weeks for men with adequate protein, women around half to two-thirds in absolute terms, both declining with training age and modestly with age. **[verify — pull exact figures from Benito et al. 2020, Schoenfeld dose-response work, Pelland et al. 2024 volume meta-regression, Robinson et al. 2024 proximity-to-failure meta-analysis before coding priors.]**
- **Cardio:** modest weekly improvement in sustainable pace / 12-minute distance from the baseline test, driven by treadmill minutes per week. **[verify priors]**
- **Dose inputs** come from the generated program and the logs, not a guess: sessions/week × minutes → predicted hard sets per muscle; effort from logs; adherence = completed / planned. The 3×20-minute lifter and the 6×20-minute lifter get genuinely different curves.
- **No nutrition inputs** (decision). The band is drawn assuming roughly maintenance eating, with one visible caveat: *"Eating well above or below maintenance shifts this; we don't track that."*
- **Recalibration:** weekly, compare actual e1RM trajectory to the band → shift the user's personal `k` (simple Bayesian or exponentially weighted correction). Show "you're tracking at the 65th percentile of your projection" and redraw.

### 5.3 How it reads (example copy)
> **You, at week 12.** New lifter, male, 33, 4 × 20 min/week with dumbbells and a treadmill.
> - Goblet squat: 25 lb × 12 today → **40–50 lb × 12** (most likely ~45)
> - Push-ups: 12 → **22–30** in a set
> - One-arm row: 25 lb × 10 → **40–50 lb × 10**
> - Lean mass: **+0.8 to +1.8 kg**, assuming you eat roughly normally
> - 12-minute treadmill distance: **+10–15%**
> - What you'd notice: fuller upper back and shoulders, legs firmer, stairs easier before the mirror changes much.
> - Shown inline: ranges cover ~80% of people like you who complete at least 85% of sessions.

Always paired with: *projections are population estimates, not medical advice, and update as you train.*

---

## 6. Exercise science basis (the rules the engine encodes)

Each principle maps to an engine parameter so it can be tuned without rewriting code. **[verify each against current literature before launch]**

| Principle | Engine parameter |
|---|---|
| Hypertrophy is driven mainly by weekly hard sets per muscle, with diminishing returns beyond ~15–20 | `volume_targets[level]`, `volume_cap` |
| Sets must be close to failure (~0–3 RIR) to count; strength is less sensitive to RIR than hypertrophy | `target_rir[goal]`, effective-set counting |
| Loads from ~30% to ~85% 1RM all build muscle if near failure; strength needs some heavier exposure | `rep_ranges[goal]`, `pct_table` |
| Frequency mostly matters as a way to distribute volume; full-body 3–4×/week is efficient | weekly template |
| Shorter rest costs some stimulus per set but supersets recover most of it per minute | superset planner, `rest_seconds` |
| Time-efficient methods (supersets, rest-pause, drop sets) preserve most of the stimulus per minute | short-session planner |
| Training at long muscle lengths / full range of motion is at least as good | exercise ranking weights |
| Novices progress on almost anything; double progression suits coarse load steps | `progression_scheme[level, equipment]` |
| Reactive deloads are at least as good as scheduled ones | deload triggers |
| Minimum effective dose: even one hard set, 2–3×/week, produces measurable strength gains | floor for 2-day programs; projection still non-zero |
| Brief daily sessions ("exercise snacks") produce fitness and strength gains comparable to longer, less frequent sessions for the same weekly volume | justification for 20-minute default |

Keep `docs/EVIDENCE.md`: each rule, its source(s), and the date last reviewed. That makes "incorporates the latest exercise science" a maintained claim rather than a marketing line.

---

## 7. Architecture

### 7.1 Principles
- **Engine as a pure library.** Program generation, autoregulation and projection are pure TypeScript functions over plain data. No I/O. Runs identically on device, in tests, and later on a server if one ever exists.
- **Local-first.** The phone's own storage is the source of truth. No account required.
- **LLMs for language, not for math.** Explanations and narrative projections may use Claude. Loads, reps and projections come from the deterministic engine so they're testable and reproducible.

### 7.2 Platform options (plain-language)

| Option | What it is | Good for | Friction |
|---|---|---|---|
| **A. Installable web app (PWA) — recommended** | A website built to feel like an app: add it to the home screen, works offline, data stored on the phone | Personal MVP, fastest iteration, no app store | Free hosting, no accounts |
| B. PWA + Supabase | Adds login and cloud sync | Two devices, or sharing with a friend | Free tier, modest setup |
| C. React Native + Expo (+ Supabase) | A true native iOS/Android app from one codebase | App Store distribution later | Apple developer account ($99/yr), builds, more moving parts |
| D. Native Swift | iPhone only | Not needed here | Mac + Xcode, single platform |

A is the recommendation. The engine package doesn't change if we move to B or C later.

### 7.3 Proposed stack for option A
| Layer | Choice | Why |
|---|---|---|
| App | React + TypeScript, Vite, PWA plugin | Small, fast, installable |
| Local data | IndexedDB via Dexie | Offline, structured, survives reloads; JSON export/import for backup |
| Engine | `packages/engine` (pure TS, no deps) | Shared, unit-tested |
| Exercise DB | JSON in `packages/exercises` | Reviewable in PRs |
| Hosting | GitHub Pages or Vercel free tier | Zero cost |
| Tests / CI | Vitest, GitHub Actions (typecheck + engine tests) | Catches engine regressions |
| AI (later) | Claude API behind a tiny serverless function | Narration only |

### 7.4 Monorepo layout
```
repcurve/
  apps/
    web/             # PWA
  packages/
    engine/          # generation, autoregulation, projection — pure TS
    exercises/       # exercise & equipment taxonomy + data (JSON)
    shared/          # types, units, formulas (Epley, RIR tables)
  docs/
    PLAN.md
    EVIDENCE.md      # rule → source → last reviewed
```

### 7.5 Data model (first cut, stored locally)
```
Profile         sex, dob, height_cm, bodyweight_kg, training_history, goal, injuries[], units, days_per_week, minutes_per_session
Equipment       dumbbells (fixed list | adjustable {min,max,step}), treadmill {has, max_incline, max_speed}, mat, ab_roller, pullup_bar, bench, bands[]
Exercise        id, name, pattern, primary_muscles[], secondary_muscles[], equipment_requirements, ladder_id, ladder_level, rep_time_s, default_rest_s
Benchmark       date, exercise_id, load, reps, rir, e1rm, standard_percentile
Program         created_at, params, explanation
Block           program_id, index, start_date, weeks, volume_targets
SessionPlan     block_id, day_index, week, kind (strength|cardio|hybrid), items[] {exercise_id, sets, rep_range, target_load, target_rir, rest_s, priority, superset_group}
SessionLog      session_plan_id, started_at, finished_at, paused_total_s, readiness, notes
SetLog          session_log_id, exercise_id, set_index, load, reps, rir, pain_flag, e1rm
CardioLog       session_log_id, minutes, speed, incline, intervals, effort
BodyMetric      date, weight_kg, measurements, photo_ref
Projection      created_at, horizon_weeks, metrics (per-pattern bands, lean mass band, cardio band), k_personal
```

---

## 8. Phased roadmap

### Phase 0 — Engine first, no UI · ~2–3 weeks
- Equipment model and ~60 exercises covering dumbbell, bodyweight, ab roller and treadmill work, organised into progression ladders.
- Engine: weekly template, volume targets, 20-minute session fill with supersets, starting loads, dumbbell-aware progression, e1RM math.
- CLI: `repcurve generate --profile fixture.json` prints a 4-week program. Snapshot tests.
- `EVIDENCE.md` v1.
- Fixture personas: the reference user (male, 33, novice, dumbbells + treadmill + ab roller, 4 × 20 min), a bodyweight-only user, a 2-day user, a 6-day user, a user with knee pain.
- Done when: every persona gets a sensible program without manual fixes, and every session fits its time budget.

### Phase 1 — MVP app · ~4–6 weeks
- Onboarding, equipment entry, benchmark folded into sessions 1–2.
- Program view, in-session screen with clock, pre-filled sets, plain-word effort, next-set suggestions, pause/resume, swap, "less time today".
- Between-session autoregulation, treadmill sessions.
- Basic progress: e1RM charts, consistency.
- Installable PWA, offline, JSON backup/restore.
- Done when: the reference user can go install → first logged workout in under five minutes, and a month of use requires zero manual weight decisions.

### Phase 2 — Projection & curve · ~3–4 weeks
- Projection model with population priors and weekly recalibration.
- Baseline card, projection card, "you vs your projection" chart.
- Reactive deloads, volume ramps, readiness taps.
- Narrative explanations (LLM over the structured plan/projection).

### Phase 3 — If it's working
- Cloud sync and sharing (option B), or native app (option C).
- Photo → equipment inventory.
- Wearable/heart-rate import for treadmill sessions.
- Shareable "curve" image.

---

## 9. Risks

- **Overpromising body composition.** Mitigation: wide bands, conditional language, recalibration, the single nutrition caveat.
- **Benchmarks feeling like a test.** Fold them into normal sessions; never ask for a max.
- **Novices don't know RPE.** Plain-word effort picker; auto-calibration from AMRAP sets.
- **Dumbbell load steps.** Mitigated by multi-axis progression ladders (§4); needs good test coverage because it's where most engine bugs will live.
- **Interrupted sessions.** Pause/resume and same-day completion are MVP features, not nice-to-haves, for this audience.
- **Local-only data loss.** JSON export reminder monthly; sync is Phase 3.
- **Not medical advice.** Pain routing and disclaimer on the projection.

---

## 10. Immediate next steps
1. Confirm platform option A (installable web app, local data).
2. Scaffold the monorepo: `packages/engine`, `packages/exercises`, `packages/shared`, CLI, Vitest, GitHub Actions.
3. Write the equipment model and first ~30 exercises with ladders.
4. Get `repcurve generate` producing a 4-week program for the reference persona (male, 33, novice, dumbbells + treadmill + ab roller, 4 × 20 min) and check it fits 20 minutes on paper.
5. Draft `EVIDENCE.md` and verify every **[verify]** number.
