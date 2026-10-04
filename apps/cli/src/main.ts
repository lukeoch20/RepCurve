import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateProgram } from "@repcurve/engine";
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
} else {
  usage();
}
