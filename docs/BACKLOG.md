# RepCurve backlog

Features agreed but not built yet, most important first. Each says what the user sees, what the
engine does with it, and what it needs from the data. Build order is at the end.

---

## B1. One training profile that every piece of feedback feeds

**The idea.** RepCurve is already building a picture of each person (their working weights, how hard
sets feel, what they swap out, what hurts) and using it to plan the next session and to project their
progress. That picture should be one explicit thing, so that **every kind of feedback lands in the same
place and shapes future workouts**, and the user can see what the app has learned.

**What feeds it today, and what's missing**

| Feedback | Collected today | Used today | Gap |
| --- | --- | --- | --- |
| Reps and reps in reserve on each set | Yes | Yes: weight, reps and rep range per exercise; strain → deloads | None |
| Benchmark sets | Yes | Yes: starting weights | None |
| "It hurt" | Yes | Yes: that exercise held a step lighter with a check-in next time | Doesn't carry to other exercises that load the same area |
| Where it hurt (knee, shoulder…) | Yes, on the set | **Yes (B1 groundwork):** other exercises that load that area get the check-in, skip benchmarks and hold steady until two pain-free sessions or six weeks | Areas no exercise is marked for (hip, elbow, neck) are kept for the profile screen only |
| Swap "don't like it" | Yes | Yes: permanent swap | Not visible anywhere as a preference |
| Swap "it's taken", "too hard", "couldn't balance" | Chosen in the sheet | **Yes (B1 groundwork):** every swap and its reason is saved; a second "too hard" or "couldn't balance" for the same exercise makes the swap stick by default | "It's taken" is deliberately not learned (it's about the gym, not you) |
| Still sore from last time | **No** | No | See B2 |
| Cardio effort (1–10) | Yes | Yes: next cardio session | None |
| Progress vs projection | Yes | Yes: personal factor on the projection | None |

**Proposal.** A derived `TrainingProfile`, computed from the saved history and training state rather than
stored as a second copy (one source of truth, so it can never drift). The planner, the progression rules
and the projection all read from it. It holds:

- **Per exercise:** working weight, rep range, trend, last reps in reserve, calibrated or not (all exist today).
- **Per muscle group:** weekly sets it handles without lingering soreness, typical recovery days, recent soreness.
- **Preferences:** exercises disliked, exercises found too hard or unstable, preferred cardio activity.
- **Cautions:** pain areas with dates. Exercises loading a flagged area get the same "check in first,
  nothing heavier" treatment as the one that hurt, until a few pain-free sessions pass.
- **Trends:** adherence, rate of progress against the projection (feeds the existing personal factor).

**What the user sees.** A "What RepCurve knows about you" screen (Progress or Settings) in plain words,
each line with a way to correct it, for example:

- "Shoulders: pain flagged twice, last on 3 Oct. Overhead presses held a step lighter." [Forget this]
- "Doesn't like: Bulgarian split squat. Swapped for reverse lunges." [Bring it back]
- "Legs usually still sore 2 days after leg day. Leg sets reduced by 1." [Reset]

**Why explicit.** It makes the app's decisions explainable ("why is this lighter?"), lets the user fix a
wrong assumption, and gives every new kind of feedback an obvious home instead of another special case.

---

## B2. "Still sore" check-in

**What the user sees.**
- On Today, before starting: "Still sore from last time?" opens chips for the muscle groups in today's
  plan (Chest, Back, Quads, Hamstrings, Glutes, Shoulders, Arms, Calves, Core) and a level for each:
  **a bit** or **very**.
- During the session, on an exercise card: "Still sore" next to Swap, for the muscles that exercise works.
- The plan updates straight away and says what changed ("Quads still very sore: squats swapped for
  hip hinges today, and one set fewer of lunges").

**What the engine does.** This follows the evidence that ordinary next-day soreness isn't a reason to skip
training, but heavy soreness means lower volume and no new progress for those muscles that day.
- **A bit sore:** keep the exercises, take one set off the exercises whose prime movers include that group,
  and don't move the weight up today. Lower reps that day don't count as a stall.
- **Very sore:** swap those exercises for ones that train other groups (same rules as Swap), or hold them
  at a light technique weight if nothing else fits. Sets from that day never drive the weight down.
- **Learning (via B1):** if the same group is still sore at its next session three times in a row, trim
  one set a session for that group until it stops, and note the change on the profile screen. If
  soreness never comes up, nothing changes.
- Soreness and "It hurt" stay separate: soreness is normal muscle fatigue; "It hurt" is pain and goes
  through the pain flow.

**Data.** `soreness?: { group: string; level: "bit" | "very" }[]` on the active session and the session
record; progression reads it so that day's sets are judged fairly.

**Overlap.** This replaces the "Readiness (post-MVP)" idea in PLAN.md §3.8 for soreness. Sleep and
stress could join the same check-in later.

---

## B3. "Stronger than X% of people like you"

**The idea.** Show where the user stands: "You're stronger than about 38% of women aged 30–39", for
their whole body and per lift, and let them set a goal ("reach the 50th percentile"). A clear, self-chosen
endpoint gives a reason to keep showing up, alongside the curve and lift levels (which only compare you
with your own start).

**Sanity check: worth doing, with care on four things.**

1. **"Population" or "people who lift"?** These give very different answers. Most adults don't strength
   train, so a few months of training can put someone above the general-population median while they
   are still near the bottom among gym-goers. Say which one every time, and default to the general
   population, which is the encouraging and honest comparison for this app's audience.
2. **Data exists for some lifts, not all.** Usable reference data, to confirm in a research pass:
   - push-up test norms by age and sex (fitness-testing guidelines, e.g. ACSM and the Canadian norms);
   - 1-rep max bench press and leg press relative to body weight by age and sex (ACSM tables from Cooper
     Institute data);
   - grip strength by age and sex (large national samples);
   - crowd-sourced lifter data for the barbell lifts (only for "among lifters").

   There's little population data for curls, rows or most dumbbell lifts. Per-lift percentiles should
   appear only where a defensible reference exists; other lifts keep their lift level.
3. **Our lifts aren't the tested lifts.** Most home users press dumbbells, not a barbell, and the
   conversion adds uncertainty. Show a range ("about the 35th–45th percentile"), never a falsely precise
   number, and widen it when the lift is converted.
4. **Make it motivating, not discouraging.** Compare within age and sex by default (kinder and fairer),
   show progress toward the next band ("6 more push-ups to the 50th"), and let users hide it.

**Shape.**
- Per-lift percentiles where data exists: push-ups first (direct, everyone can do them), then the barbell
  lifts and leg press for gym users, then dumbbell presses as converted estimates.
- An overall strength score: the average of the push, pull and leg percentiles available, labelled as an
  estimate. If pulling has no reference data, show the overall score from what there is and say so.
- A goal: "Reach the 50th percentile" on Progress, with an estimated date from the projection model.
- Filters: everyone / my sex / my age group / both.

**Before building:** a research pass to collect and cite the reference tables (age bands, sex, the test
each one used), the same way the exercise evidence review was done, plus a decision on converting
dumbbell lifts.

## B4. Style previews in Settings

**The problem.** Every option in Settings → Style is drawn in the style that's active now, so with Pixel
Press on, "Classic" shows up in pixel lettering on lavender and tells you nothing about Classic.

**What the user sees.** Each option is a small preview in that style's own look:
- a header band in the style's header colour, with the name in its heading font (pixel lettering for Pixel
  Press, the serif for Classic);
- a sample card on the style's page colour, with a line of body text in its font;
- a sample button in its main button colour and shape (Bluebird's bevelled green, Fired Forge's ember);
- the chosen style keeps an outline in the current style, so it's clear which one is active.

Classic follows the phone's light or dark mode, so its preview shows light and dark side by side.

**How.** All fonts are already loaded, so there's nothing new to download. Each style's handful of
preview colours lives in one small table rather than re-running its whole stylesheet inside the card,
which would clash with the active style's rules. A test checks those colours against the real
stylesheets, so a preview can't drift from the look it shows.

**Effort.** Small: about half a day. It's also the first slice of B5.

---

## B5. Looks as rewards

**The idea.** Some looks are earned. Each one unlocks through whichever comes first of three routes:
showing up, getting stronger, or staying consistent. Every route is a badge, so there's one system:
badges are worked out from the history, which means unlocks survive a backup and restore and nothing new
is stored.

**Principles.**
- **More than one way in.** Someone who trains steadily but gets stronger slowly isn't stuck behind a
  strength wall, and the reverse.
- **Strength against yourself.** Strength routes use lift levels (each about 5% stronger than your own
  start) and personal records, never absolute numbers like "bench your body weight", which would lock
  out home trainees with light dumbbells.
- **Early rewards.** Most people drift off in the first month, and a gym habit takes months to form. At
  three workouts a week, 10 workouts is about weeks 3–4, 25 about month 2, 50 about month 4, 100 about
  month 8.
- **Unlocked for good.** Light and dark unlock together (dark mode is a comfort setting, not a prize), a
  look never locks again, and whatever style someone uses today stays unlocked for them.
- **Coming back counts.** Rewarding a return after missed workouts was the most effective of 54 nudges
  in a megastudy of gym members, so a comeback route is on the ladder.

**The ladder (first sketch).** Each look unlocks with whichever route comes first.

| Look | Showing up | Getting stronger | Staying consistent |
| --- | --- | --- | --- |
| Bluebird light and dark, Classic | Free | | |
| Fired Forge | 10 workouts | First personal record and first harder version of a move | 4-week streak |
| Pixel Press | 25 workouts | Level 5 on any lift (about 25% stronger) | Every planned session in a week, 3 times |
| New look 3 | 50 workouts | Level 10 on any lift | 12-week streak, or a monthly challenge met |
| Gold Plated (look 4) | 100 workouts | 50 personal records | Half a year of weekly training |
| Cut Like a Diamond (look 5, the highest) | 250 workouts | Level 15 on any lift | A whole year, or coming back after a break 5 times |

The first workout gets an immediate small win that isn't a look (a curve colour or a finish-screen
celebration), so the looks stay meaningful.

**What the user sees.**
- **Settings → Style:** B4's previews; locked looks are dimmed with a lock and their routes and progress,
  e.g. "Unlocks with: 10 workouts (3 to go) or a 4-week streak (2 weeks to go)".
- **Finish screen:** "New look unlocked: Fired Forge", with a Try it button.
- **Progress:** the next unlock and how close it is, beside the badges.

**Data.** None new. Each look lists the badge ids that unlock it; a look is unlocked when any of its badges
is earned, or it's the style in use when this ships (kept in the per-device style setting).

**Open decisions.**
1. Is the free set right: Bluebird light and dark, and Classic? (Suggested: yes.)
2. Any one route unlocks a look, or do some looks need all three? (Suggested: any one.)
3. Four looks can be locked today: Fired Forge, Pixel Press, Gold Plated and Cut Like a Diamond (built;
   open to everyone in the test app until this ships). Commission the remaining one (look 3) from the
   artist (the theme kit already covers what it needs), or fill that rung with smaller cosmetics for now
   (curve colours, celebration effects, a title on Progress)?

**Build.** First slice: B4's previews plus locks on Fired Forge and Pixel Press, with the new badges the
first two rungs need. Higher rungs as new looks arrive.

---

## Build order

1. ~~**B1 groundwork:** add the derived profile and route existing feedback through it, starting with the two
   gaps that are already collected but ignored: pain area, and the "too hard" and "couldn't balance" swap reasons.~~
   Done: `buildProfile` / `applyProfile` in the engine, `profileFor` in the app.
2. ~~**B2:** the soreness check-in as the first new input to the profile.~~
   Done, smaller than drafted above: on Today, only when today's plan works a muscle a session in the
   last three days worked, "Still sore from yesterday's session?" with Not sore / A bit / Very and, for
   more than one muscle, where. A bit changes nothing; very takes one set off the exercises whose prime
   movers are sore (never below one, never more than one under the superset's rounds) and holds their
   weight (`applySoreness`, `recordSoreSession` in `packages/engine/src/soreness.ts`). Groups are the
   engine's muscles (biceps and triceps apart, so push then pull doesn't ask). The answers are saved
   with the session and the profile keeps them per muscle. Not yet: swapping very sore exercises,
   "Still sore" on an exercise card, and trimming sets after three sore check-ins in a row.
3. ~~**B1 screen:** "What RepCurve knows about you", with corrections.~~
   Done: from Settings and Progress. Level and volume step, weekly sets per muscle, pain cautions
   ("It's fine now"), swapped-out exercises ("Bring it back" / "Forget this"), soreness, and working
   weights with trends ("Re-test" gives a benchmark set next time). Corrections are stored in
   `core.profileOverrides` and read by `buildProfile`.
4. **B3:** research pass for reference tables, then push-up percentiles, then the rest.
5. **B4:** style previews in Settings.
6. **B5:** looks as rewards, first two rungs (Fired Forge and Pixel Press), once the open decisions are made.
