import { describe, expect, it } from "vitest";
import { emblemFor } from "./Week";

describe("day emblems", () => {
  it("gives push, pull and full body days their own emblem", () => {
    const of = (variant: string) => emblemFor({ kind: variant === "cardio" ? "cardio" : "strength", variant });
    expect(new Set([of("push"), of("pull"), of("A"), of("upper"), of("lower"), of("cardio")]).size).toBe(6);
    expect(of("ppl-push")).toBe(of("push"));
    expect(of("ppl-pull")).toBe(of("pull"));
    expect([of("A"), of("B"), of("C")]).toEqual(["fullBody", "fullBody", "fullBody"]);
    expect(of("legs")).toBe(of("lower"));
  });
});
