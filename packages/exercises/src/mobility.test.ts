import { describe, expect, it } from "vitest";
import { EXERCISES, findExercise } from "./library.js";
import { getHowTo } from "./howto.js";
import { BORROWED, DRILLS, MOBILITY_FACTS, MOBILITY_SOURCES, ROUTINES, blockSessions, findDrill, findRoutine, sideLabel } from "./mobility.js";

const lines = (d: (typeof DRILLS)[number]) => [d.howTo.setup, ...d.howTo.steps, ...d.howTo.cues, ...d.howTo.mistakes, d.cue, d.area, ...(d.skipIf ? [d.skipIf] : []), ...Object.values(d.ease ?? {})];

describe("mobility drills", () => {
  it("have ids of their own, apart from the exercise library's", () => {
    const ids = DRILLS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    const library = new Set(EXERCISES.map((e) => e.id));
    expect(ids.filter((id) => library.has(id))).toEqual([]);
  });

  it("each come with a one-line cue and a full guide in plain, tidy text", () => {
    for (const d of DRILLS) {
      expect(d.cue.length, d.id).toBeGreaterThan(20);
      expect(d.cue.length, d.id).toBeLessThanOrEqual(120);
      expect(d.howTo.setup.length, d.id).toBeGreaterThan(20);
      expect(d.howTo.steps.length, d.id).toBeGreaterThanOrEqual(3);
      expect(d.howTo.cues.length, d.id).toBeGreaterThanOrEqual(2);
      expect(d.howTo.mistakes.length, d.id).toBeGreaterThanOrEqual(2);
      for (const line of lines(d)) {
        expect(line.trim(), d.id).toBe(line);
        expect(line, d.id).not.toMatch(/—|\s{2,}/);
      }
    }
  });

  it("say which side is which for one-sided drills, and only those", () => {
    for (const d of DRILLS) {
      expect(d.sideLabel !== undefined, d.id).toBe(d.sided);
      if (d.sideLabel) expect(d.sideLabel, d.id).toMatch(/\{[Ss]ide\}/);
      expect(/switch sides/i.test(d.howTo.steps.join(" ")), d.id).toBe(d.sided);
    }
    expect(sideLabel(findDrill("hip_flexor_stretch")!, "left")).toBe("Left knee down");
    expect(sideLabel(findDrill("lying_twist")!, "right")).toBe("Knees to the right");
    expect(sideLabel({}, "right")).toBe("Right side");
  });

  it("time their reps, and count holds in seconds only", () => {
    for (const d of DRILLS) {
      if (d.kind === "reps") expect(d.countSec, d.id).toBeGreaterThan(0);
      else {
        expect(d.count, d.id).toBeUndefined();
        expect(d.countSec, d.id).toBeUndefined();
      }
    }
  });

  it("offer a gentler drill that really spares the area", () => {
    for (const d of DRILLS) {
      if (!d.gentler) continue;
      const g = findDrill(d.gentler);
      expect(g, `${d.id} → ${d.gentler}`).toBeDefined();
      expect(d.avoidWith.length, d.id).toBeGreaterThan(0);
      expect(g!.avoidWith.filter((i) => d.avoidWith.includes(i)), d.id).toEqual([]);
      // Advice for doing a drill with a sore area is only for drills that area still gets.
      for (const area of d.avoidWith) expect(d.ease?.[area], `${d.id}: ${area}`).toBeUndefined();
    }
  });

  it("never need a mat: a rug or carpet does", () => {
    for (const d of DRILLS) {
      expect(d.requires, d.id).toEqual([]);
      for (const line of [d.howTo.setup, ...d.howTo.steps]) {
        if (/\bon a mat\b/i.test(line)) expect(/mat, rug/i.test(line), `${d.id}: ${line}`).toBe(true);
      }
    }
  });

  it("warn off the hamstring stretch when the sit bone is sore", () => {
    expect(findDrill("lying_hamstring_stretch")!.skipIf).toMatch(/sit bone/);
  });
});

describe("mobility routines", () => {
  it("only use drills and library exercises that exist, and nothing retired", () => {
    expect(new Set(ROUTINES.map((r) => r.id)).size).toBe(ROUTINES.length);
    for (const r of ROUTINES) {
      expect(r.version, r.id).toBeGreaterThanOrEqual(1);
      for (const level of r.levels) {
        expect(level.items.length, r.id).toBeGreaterThan(0);
        for (const item of level.items) {
          expect(item.options.length, r.id).toBeGreaterThan(0);
          for (const id of item.options) {
            const e = findExercise(id);
            expect(findDrill(id) !== undefined || (e !== undefined && e.tier !== "retired"), `${r.id}: ${id}`).toBe(true);
          }
        }
      }
    }
  });

  it("borrow only bodyweight exercises that have a guide, a cue and their sides named", () => {
    const borrowed = new Set(ROUTINES.flatMap((r) => r.levels.flatMap((l) => l.items.flatMap((i) => i.options))).filter((id) => !findDrill(id)));
    expect([...borrowed].sort()).toEqual(Object.keys(BORROWED).sort());
    for (const id of borrowed) {
      const e = findExercise(id)!;
      expect(e.loadType, id).toBe("bodyweight");
      expect(getHowTo(id), id).toBeDefined();
      expect(BORROWED[id]!.cue.length, id).toBeGreaterThan(20);
      expect(BORROWED[id]!.sideLabel !== undefined, id).toBe(e.unilateral);
    }
  });

  it("keep holds, reps and sets in a sensible range", () => {
    for (const r of ROUTINES) {
      for (const item of r.levels.flatMap((l) => l.items)) {
        const d = findDrill(item.options[0]!);
        expect(item.sets, r.id).toBeGreaterThanOrEqual(1);
        expect(item.sets, r.id).toBeLessThanOrEqual(3);
        if (d?.kind === "hold") {
          expect(item.amount, `${r.id}: ${d.id}`).toBeGreaterThanOrEqual(20);
          expect(item.amount, `${r.id}: ${d.id}`).toBeLessThanOrEqual(120);
        } else {
          expect(item.amount, `${r.id}: ${item.options[0]}`).toBeGreaterThanOrEqual(3);
          expect(item.amount, `${r.id}: ${item.options[0]}`).toBeLessThanOrEqual(15);
        }
      }
    }
  });

  it("has one block, six weeks of three sessions shared evenly between its levels, and quick sessions of one level", () => {
    const blocks = ROUTINES.filter((r) => r.kind === "block");
    expect(blocks.map((r) => r.id)).toEqual(["hips"]);
    const hips = findRoutine("hips")!;
    expect(blockSessions(hips)).toBe(18);
    expect(blockSessions(hips) % hips.levels.length).toBe(0);
    for (const r of ROUTINES.filter((x) => x.kind === "quick")) {
      expect(r.levels, r.id).toHaveLength(1);
      expect(blockSessions(r), r.id).toBe(0);
    }
  });

  it("holds stretches longer as the block goes on, never shorter", () => {
    const hips = findRoutine("hips")!;
    const hold = (level: number, id: string) => hips.levels[level]!.items.find((i) => i.options[0] === id)?.amount ?? 0;
    for (const id of ["hip_flexor_stretch", "figure_four"]) {
      expect(hold(1, id), id).toBeGreaterThanOrEqual(hold(0, id));
      expect(hold(2, id), id).toBeGreaterThanOrEqual(hold(1, id));
    }
  });

  it("is written in plain, tidy text", () => {
    for (const r of ROUTINES) {
      for (const line of [r.name, r.summary, r.when, ...r.levels.flatMap((l) => [l.name, l.note])]) {
        expect(line.trim(), r.id).toBe(line);
        expect(line, r.id).not.toMatch(/—|\s{2,}/);
      }
    }
  });
});

describe("what stretching does and doesn't do", () => {
  const groups = Object.entries(MOBILITY_FACTS);
  const facts = groups.flatMap(([, list]) => list);

  it("says something under every heading, each line resting on a source that's listed", () => {
    const ids = new Set(MOBILITY_SOURCES.map((s) => s.id));
    expect(ids.size).toBe(MOBILITY_SOURCES.length);
    for (const [group, list] of groups) expect(list.length, group).toBeGreaterThanOrEqual(3);
    for (const f of facts) {
      expect(f.sources.length, f.text).toBeGreaterThan(0);
      for (const id of f.sources) expect(ids.has(id), `${f.text}: ${id}`).toBe(true);
    }
  });

  it("lists no source that nothing rests on, and each says what it found and how far that goes", () => {
    const used = new Set(facts.flatMap((f) => f.sources));
    for (const s of MOBILITY_SOURCES) {
      expect(used.has(s.id), s.id).toBe(true);
      expect(s.url, s.id).toMatch(/^https:\/\//);
      expect(s.finding.length, s.id).toBeGreaterThan(30);
      expect(s.limit.length, s.id).toBeGreaterThan(15);
      expect(s.year, s.id).toBeGreaterThanOrEqual(1990);
    }
  });

  it("promises nothing the research doesn't support", () => {
    const does = MOBILITY_FACTS.does.map((f) => f.text).join(" ");
    expect(does).not.toMatch(/injur|sore|posture|recover|prevent/i);
    const all = facts.map((f) => f.text).join(" ");
    expect(all).not.toMatch(/\bcure|\btreat|\bheal|guarantee|proven/i);
    for (const f of facts) {
      expect(f.text.trim(), f.text).toBe(f.text);
      expect(f.text, f.text).not.toMatch(/—|\s{2,}/);
    }
  });

  it("gives each stretch of the hips block the weekly time studies found to work", () => {
    // From about 2.5 minutes a week per muscle (one 30-second hold, five days a week, in Bandy 1997)
    // up to about 10, past which the largest analysis found nothing more (Ingram 2025).
    const hips = findRoutine("hips")!;
    for (const level of hips.levels) {
      for (const item of level.items) {
        const d = findDrill(item.options[0]!);
        if (d?.kind !== "hold" || !d.sided) continue;
        const weeklyMin = (item.sets * item.amount * hips.perWeek!) / 60;
        expect(weeklyMin, `${level.name}: ${d.id}`).toBeGreaterThanOrEqual(2.5);
        expect(weeklyMin, `${level.name}: ${d.id}`).toBeLessThanOrEqual(10);
      }
    }
  });
});
