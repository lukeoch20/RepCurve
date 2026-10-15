import { hasItem } from "@repcurve/shared";
import { describe, expect, it } from "vitest";
import { planSessionWith } from "./generate.js";
import { referenceContext, referenceEquipment } from "./testkit.js";

describe("jump rope on lifting days", () => {
  it("never makes the rope the default warm-up: owning one doesn't mean you want to skip before lifting", () => {
    const ctx = referenceContext({ equipment: { ...referenceEquipment, jumpRope: true } });
    const s = planSessionWith(ctx, 0);
    expect(s.kind).toBe("strength");
    expect(s.warmup[0]!.name).toBe("Easy movement");
  });

  it("counts as equipment only when ticked (older setups have no rope)", () => {
    expect(hasItem(referenceEquipment, "jump_rope")).toBe(false);
    expect(hasItem({ ...referenceEquipment, jumpRope: true }, "jump_rope")).toBe(true);
  });
});
