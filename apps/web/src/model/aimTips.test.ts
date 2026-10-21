import { AIMS } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { AIM_TIPS, tipAfter, tipsFor } from "./aimTips";
import type { SessionRecord } from "./types";

const record = (n: number, skipped = false): SessionRecord => ({ id: `s${n}`, index: n, finishedAt: 1_000 + n, skipped } as SessionRecord);

describe("tips for the person's aim", () => {
  it("every aim has several tips, each with its research", () => {
    for (const aim of AIMS) expect(tipsFor(aim).length, aim).toBeGreaterThanOrEqual(4);
    expect(new Set(AIM_TIPS.map((t) => t.id)).size).toBe(AIM_TIPS.length);
    for (const t of AIM_TIPS) {
      expect(t.sources.length, t.id).toBeGreaterThan(0);
      for (const s of t.sources) expect(s.url, t.id).toMatch(/^https:\/\/doi\.org\/10\./);
      expect(t.more.length, t.id).toBeGreaterThan(0);
    }
  });

  it("supplements say how much, in grams or milligrams per kilo, and who should check first", () => {
    const creatine = AIM_TIPS.find((t) => t.id === "creatine")!;
    expect(creatine.short).toMatch(/3–5 grams/);
    expect(creatine.caution).toMatch(/kidney/);
    expect(creatine.aims).not.toContain("lose_fat");
    const caffeine = AIM_TIPS.find((t) => t.id === "caffeine")!;
    expect(caffeine.more.join(" ")).toMatch(/3–6 mg per kg/);
    expect(caffeine.caution).toMatch(/pregnant/);
  });

  it("shows each tip once before any repeats, and the same workout always shows the same one", () => {
    const history: SessionRecord[] = [];
    const seen: string[] = [];
    const n = tipsFor("lose_fat").length;
    for (let i = 0; i < n + 1; i++) {
      history.push(record(i));
      seen.push(tipAfter("lose_fat", history[i]!, history).id);
    }
    expect(new Set(seen.slice(0, n)).size).toBe(n);
    expect(seen[n]).toBe(seen[0]);
    // Seen again later, an old workout shows the tip it showed then.
    expect(tipAfter("lose_fat", history[2]!, history).id).toBe(seen[2]);
    // Skipped sessions don't move it on.
    const withSkip = [...history.slice(0, 2), record(50, true), record(51)];
    expect(tipAfter("lose_fat", withSkip[3]!, withSkip).id).toBe(seen[2]);
  });
});
