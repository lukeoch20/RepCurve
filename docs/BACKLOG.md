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
| Where it hurt (knee, shoulder…) | Yes, on the set | **No** | Stored but never read |
| Swap "don't like it" | Yes | Yes: permanent swap | Not visible anywhere as a preference |
| Swap "it's taken", "too hard", "couldn't balance" | Chosen in the sheet | **No** | Not remembered: "too hard" twice should move that slot down a level; "couldn't balance" should prefer two-sided options |
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

## Build order

1. **B1 groundwork:** add the derived profile and route existing feedback through it, starting with the two
   gaps that are already collected but ignored: pain area, and the "too hard" and "couldn't balance" swap reasons.
2. **B2:** the soreness check-in as the first new input to the profile.
3. **B1 screen:** "What RepCurve knows about you", with corrections.
