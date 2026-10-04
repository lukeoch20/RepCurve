# RepCurve

Short, dense home workouts that adapt to you and show you your curve.

RepCurve is for people who want meaningful strength training at home in about 20 minutes a day with whatever they own: a few dumbbells, a treadmill, an ab roller, a mat. It builds a program that fits your days, minutes and equipment, adjusts every session from what you actually did, and projects where you'll be in 4, 12 and 52 weeks.

See [`docs/PLAN.md`](docs/PLAN.md) for the full product and technical plan.

## Layout

```
packages/shared     types, formulas (Epley, RIR), load helpers
packages/exercises  exercise library with progression ladders
packages/engine     program generation, session fill, progression rules
apps/cli            command-line generator for trying personas
apps/web            (coming) installable web app
```

## Try it

```sh
pnpm install
pnpm test
pnpm generate -- --profile fixtures/reference.json --week 2
```

Other fixtures live in `apps/cli/fixtures/`.
