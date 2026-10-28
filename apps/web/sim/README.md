# Simulated users

AI personas use RepCurve Test in a real browser, as people would, over weeks of simulated time, then say what they made of it. It's a quick, cheap way to find confusing screens, rough edges and bugs before real people do. It isn't a substitute for them: treat what the personas find as leads to check.

## How it works

- **The app**: the real RepCurve Test build (`dist/test`), served locally and opened in headless Chromium at iPhone 13 size, in each person's own time zone.
- **What a persona sees**: the screen as text in reading order, with every control tagged (`[e12] button "Start session"`), plus its state: selected, on/off, disabled, current value. `observe.ts` builds it.
- **What a persona does**: taps, types, waits (a set, a rest, an interruption), jots notes for you, and ends the visit with a diary entry and when it'll be back. `agent.ts` runs this as a Claude tool-use loop, with one fresh conversation per visit. The diary carries over to the next visit.
- **Time**: the page's clock is paused and only moves as the person acts (about 6 seconds a tap, plus whatever they wait). A 20-minute workout takes 20 app minutes however long the model takes to think. Between visits the clock jumps to the next day they'd open the app, and the page reloads with everything they saved still there.
- **Life happens**: each persona has scripted situations, such as Priya's hotel week and a week off sick, and Dana's sore knee. See `personas.ts`.
- **The end**: each persona answers an exit interview (structured output: rating, keep using, frustrations by severity, confusing moments, bugs, wishes). Then one more call reads across everyone and writes the report.

Nothing leaves the machine except the calls to the Claude API. The page can load only the app itself; every other request is blocked. Usernames and in-app feedback go to the same stand-in backend the e2e tests use (`e2e/backend.ts`), never to the real one.

### The people

| id | Who | Tests |
|---|---|---|
| `dana` | 52, new to lifting, home dumbbells 5–20 lb, sore knee, wants to feel fitter | first-run clarity, jargon, how-tos, pain flags, reassurance |
| `marcus` | 28, lifts regularly at a full gym, wants muscle, impatient | logging speed, swaps, weights that look wrong, pop-ups |
| `priya` | 35, parent, lapsed lifter, 15–20 minute home sessions, wants to lose fat | interruptions, abandoned workouts, hotel setup, a missed week |
| `sam` | 41, returning lifter, home on weekdays and gym on Saturday, wants strength | two setups, plan and progress screens, backup, sending feedback |

To add someone, add an entry to `PERSONAS` in `personas.ts`: the facts they'd give during setup, how they use a phone, how their workouts really go, and any life events.

## Running it

It runs anywhere with Node 22 and pnpm, including a Claude Code cloud session like the one it was built in. It needs one thing: an Anthropic API key in `ANTHROPIC_API_KEY`.

- **In a Claude Code cloud environment**: open the cloud environment menu in the session's title bar, choose Edit, and add `ANTHROPIC_API_KEY` as an environment variable (or under Network secrets where that's offered). A new session picks it up. Don't paste the key into the chat.
- **On your own computer**: `export ANTHROPIC_API_KEY=...` in the shell, then run as below.

```sh
pnpm install
pnpm sim --dry-run                          # no API calls: print what the first person is shown
pnpm sim --personas dana --visits 2         # a small first run
pnpm sim                                    # everyone, up to 6 visits each over 28 days
pnpm sim --model claude-sonnet-5-5          # cheaper
```

`pnpm sim` builds RepCurve Test first and starts a preview server if one isn't already on port 4173. Ctrl-C once stops after the current step and still writes the report; twice quits at once.

| Option | Default | |
|---|---|---|
| `--personas` | all | comma-separated ids |
| `--visits` | 6 | most visits per person |
| `--days` | 28 | simulated days to cover |
| `--steps` | 60 | most model turns per visit; the person is told to wrap up 5 turns before |
| `--concurrency` | 2 | people using the app at once |
| `--model` | `claude-opus-5-5` | or set `SIM_MODEL` |
| `--effort` | `low` | effort for steps in the app |
| `--report-effort` | `medium` | effort for interviews and the report |
| `--max-cost` | 40 | US$; no new visits or steps once spend gets near it (about 10% is kept for the report) |
| `--start` | 2026-11-02 | the first simulated day (a Monday) |
| `--base-url` | `http://127.0.0.1:4173/test/` | another build or server, such as the deployed test app |
| `--no-build` | | use the existing `dist/test` |
| `--no-fallbacks` | | leave out `fallbacks: "default"` (see below) |
| `--headed` | | show the browser |

Requests go to `https://api.anthropic.com` whatever `ANTHROPIC_BASE_URL` says, since hosted shells can set that for their own use. `SIM_API_URL` overrides it (for a local stand-in, say).

### Cost

The running total prints after every visit and at the end. Rough guesses before you've measured: on Opus 5.5 a visit is somewhere around $0.50–$1.50, so `--personas dana --visits 2` is a dollar or few and the full default run (4 people × 6 visits) roughly $15–$35. Sonnet 5.5 costs about half. Haiku 5.5 costs a small fraction but plays a person less convincingly. Most of the spend is re-reading the visit so far, which prompt caching keeps cheap, so `--steps` and `--visits` are the main levers.

Requests ask for `fallbacks: "default"`: if the model declines a request, the API retries it on its recommended fallback model instead of returning a refusal. If a model doesn't accept that, the run carries on without it.

## What you get

`sim-runs/<time>/` (not committed):

- `report.md`: the summary across everyone (scorecard, top issues with quotes and visit numbers, what worked, confusing moments, bugs, next steps), then each person's interview, visits, notes, in-app feedback and any errors the page threw.
- `screens/<person>-<visit>.png`: the screen at the end of each visit.
- `<person>.jsonl`: every model turn and action, with token usage.
- `run.json`: everything above as data.
- `downloads/`: files the app saved, such as backups.

## Limits

- Personas read the page as text, so they don't see colours, layout, contrast or animation. Use the theme screenshots for those. Very long pages are cut off after about 10,000 characters.
- They're models playing people: more patient and articulate than most, and likely to share blind spots. Weigh a problem more when several of them hit it, and confirm it with a real person.
- No home-screen install, notifications or file restore. Tutorial tips are on, as for a new user.

## Tests

No key needed: `e2e/sim.spec.ts` drives the visit loop against the real app with a script standing in for the model (time only moves as the person acts, append-only history, request shape, step and budget limits), and `sim/sim.test.ts` covers time zones, fallback handling, pricing, the interview and the report.
