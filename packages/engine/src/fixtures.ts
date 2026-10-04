import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { Equipment, Profile } from "@repcurve/shared";

export interface Fixture {
  name: string;
  profile: Profile;
  equipment: Equipment;
  e1rmByExercise?: Record<string, number>;
}

const dir = resolve(import.meta.dirname ?? ".", "../../../apps/cli/fixtures");

export function loadFixtures(): Fixture[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => ({ ...(JSON.parse(readFileSync(resolve(dir, f), "utf8")) as Fixture), name: f.replace(".json", "") }));
}
