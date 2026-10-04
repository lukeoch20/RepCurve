import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateProgram, makeContext, simulateTraining } from "@repcurve/engine";
import { getExercise } from "@repcurve/exercises";
import { formatLoad } from "@repcurve/shared";
import type { Equipment, Profile } from "@repcurve/shared";
import { formatProgram } from "./format.js";

interface Fixture {
  name?: string;
  profile: Profile;
  equipment: Equipment;
  e1rmByExercise?: Record<string, number>;
}

function parseArgs(argv: string[]): { command: string; flags: Record<string, string | boolean> } {
  const [command = "help", ...rest] = argv;
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = rest[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }
  return { command, flags };
}

function usage(): void {
  console.log(`repcurve <command>

  generate --profile <fixture.json> [--week N] [--json]
      Generate a program for the profile + equipment in the fixture file.

  simulate --profile <fixture.json> [--weeks N]
      Train a virtual lifter through the engine and print how each exercise progresses.
`);
}

const { command, flags } = parseArgs(process.argv.slice(2));

if (command === "generate") {
  const file = typeof flags["profile"] === "string" ? flags["profile"] : "fixtures/reference.json";
  const fixture = JSON.parse(readFileSync(resolve(process.cwd(), file), "utf8")) as Fixture;
  const program = generateProgram(
    { profile: fixture.profile, equipment: fixture.equipment },
    { weeks: 4, e1rmByExercise: fixture.e1rmByExercise ?? {}, createdAt: "fixture" },
  );
  if (flags["json"]) {
    console.log(JSON.stringify(program, null, 2));
  } else {
    const week = typeof flags["week"] === "string" ? Number(flags["week"]) : undefined;
    if (fixture.name) console.log(`# ${fixture.name}\n`);
    console.log(formatProgram(program, fixture.profile.units, week));
  }
} else if (command === "simulate") {
  const file = typeof flags["profile"] === "string" ? flags["profile"] : "fixtures/reference.json";
  const fixture = JSON.parse(readFileSync(resolve(process.cwd(), file), "utf8")) as Fixture;
  const weeks = typeof flags["weeks"] === "string" ? Number(flags["weeks"]) : 12;
  const ctx = makeContext(fixture.profile, fixture.equipment);
  const result = simulateTraining(ctx, weeks);
  if (fixture.name) console.log(`# ${fixture.name}\n`);
  for (const s of result.sessions) {
    if (s.plan.kind !== "strength") continue;
    const tag = s.plan.deload ? " (deload)" : s.plan.comeback ? " (comeback)" : "";
    console.log(`Session ${s.plan.index + 1} · week ${s.plan.week} · ${s.plan.name}${tag}`);
    for (const c of s.changes) {
      if (c.action === "skipped") continue;
      const done = s.logs.filter((l) => l.exerciseId === c.exerciseId);
      const loadType = getExercise(c.exerciseId).loadType;
      const did = done.map((l) => `${l.reps}@${l.rir}`).join(" ");
      const load = done[0]?.loadKg != null ? formatLoad(done[0].loadKg, loadType, fixture.profile.units) : loadType;
      const nextType = getExercise(c.nextExerciseId).loadType;
      const nextLoad = c.next.loadKg != null ? formatLoad(c.next.loadKg, nextType, fixture.profile.units) : nextType;
      const moved = c.nextExerciseId !== c.exerciseId ? ` -> ${getExercise(c.nextExerciseId).name}` : "";
      console.log(`  ${getExercise(c.exerciseId).name.padEnd(34)} ${load.padEnd(12)} ${did.padEnd(20)} ${c.action.padEnd(12)}${moved} next: ${nextLoad} x ${c.next.targetReps}`);
    }
  }
} else {
  usage();
}
