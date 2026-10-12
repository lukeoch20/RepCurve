import { describe, expect, it } from "vitest";
import { ICONS } from "./common";
import { PIXEL_ICONS } from "./pixelIcons";

describe("Pixel Press icons", () => {
  it("has a pixel drawing for every icon", () => {
    for (const name of Object.keys(ICONS)) expect(PIXEL_ICONS[name], name).toMatch(/^M/);
  });
});
