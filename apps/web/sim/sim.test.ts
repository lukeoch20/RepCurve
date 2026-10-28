import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { echoable, Ledger, request, type Create, type ModelConfig } from "./agent";
import { describeTime, wallClock } from "./observe";
import { PERSONAS } from "./personas";
import { interview, renderReport, synthesize, type PersonaRun } from "./report";

const cfg: ModelConfig = { model: "claude-opus-5-5", effort: "low", reportEffort: "medium", fallbacks: true };
const usage = (u: Partial<Anthropic.Beta.BetaUsage>) => ({ input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, iterations: null, ...u });
const message = (content: unknown[], stop = "end_turn", u = usage({})) => ({ id: "m", type: "message", role: "assistant", model: cfg.model, content, stop_reason: stop, stop_sequence: null, usage: u }) as unknown as Anthropic.Beta.BetaMessage;

describe("simulated time", () => {
  it("puts a wall-clock time in the person's time zone, either side of daylight saving", () => {
    // US clocks go back on Sunday, November 1, 2026.
    expect(new Date(wallClock("2026-10-31", 7, 5, "America/New_York")).toISOString()).toBe("2026-10-31T11:05:00.000Z");
    expect(new Date(wallClock("2026-11-02", 7, 5, "America/New_York")).toISOString()).toBe("2026-11-02T12:05:00.000Z");
    expect(new Date(wallClock("2026-11-02", 21, 10, "America/Los_Angeles")).toISOString()).toBe("2026-11-03T05:10:00.000Z");
    expect(describeTime(wallClock("2026-11-07", 9, 0, "America/Denver"), "America/Denver")).toBe("Saturday, November 7, 2026 at 9:00 AM");
  });
});

describe("requests", () => {
  it("cache, fall back and set effort, and leave fallbacks out when they're off", () => {
    const p = request(cfg, "low", { max_tokens: 10, messages: [], output_config: { format: { type: "json_schema", schema: {} } } });
    expect(p).toMatchObject({ model: "claude-opus-5-5", cache_control: { type: "ephemeral" }, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default", output_config: { effort: "low", format: { type: "json_schema" } } });
    const off = request({ ...cfg, fallbacks: false }, "medium", { max_tokens: 10, messages: [] });
    expect(off).not.toHaveProperty("fallbacks");
    expect(off).not.toHaveProperty("betas");
    expect(off.output_config).toEqual({ effort: "medium" });
  });

  it("after a fallback, drops thinking and tool calls from before the switch and keeps the rest", () => {
    const content = [
      { type: "thinking", thinking: "", signature: "a" },
      { type: "tool_use", id: "t1", name: "tap", input: {} },
      { type: "text", text: "kept" },
      { type: "fallback", from: { model: "a" }, to: { model: "b" } },
      { type: "thinking", thinking: "", signature: "b" },
      { type: "tool_use", id: "t2", name: "tap", input: {} },
    ] as unknown as Anthropic.Beta.BetaContentBlock[];
    expect(echoable(content).map((b) => (b.type === "tool_use" ? b.id : b.type))).toEqual(["text", "fallback", "thinking", "t2"]);
    expect(echoable(content.slice(0, 3))).toHaveLength(3);
  });

  it("price each attempt at its own model, and stop visits a little short of the budget", () => {
    // Visits stop $2 short of a $20 budget.
    const ledger = new Ledger(20, cfg.model);
    ledger.add(message([], "end_turn", usage({ input_tokens: 1_000_000, output_tokens: 100_000, cache_read_input_tokens: 1_000_000, cache_creation_input_tokens: 100_000 })));
    expect(ledger.spent).toBeCloseTo(4 + 2 + 0.2 + 0.5, 6);
    expect(ledger.over).toBe(false);
    // A declined attempt on Opus and the rescue on Sonnet: both counted, each at its price.
    const iterations = [
      { type: "message", model: "claude-opus-5-5", input_tokens: 100_000, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, cache_creation: null },
      { type: "fallback_message", model: "claude-sonnet-5-5", input_tokens: 100_000, output_tokens: 10_000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, cache_creation: null },
    ];
    const before = ledger.spent;
    ledger.add(message([], "end_turn", usage({ input_tokens: 100_000, output_tokens: 10_000, iterations } as Partial<Anthropic.Beta.BetaUsage>)));
    expect(ledger.spent - before).toBeCloseTo(0.4 + 0.2 + 0.1, 6);
    expect(ledger.calls).toBe(2);
    ledger.add(message([], "end_turn", usage({ output_tokens: 500_000 })));
    expect(ledger.spent).toBeCloseTo(17.4, 6);
    expect(ledger.over).toBe(false);
    ledger.add(message([], "end_turn", usage({ output_tokens: 50_000 })));
    expect(ledger.over).toBe(true);
  });
});

const dana = PERSONAS[0]!;
const run = (extra: Partial<PersonaRun> = {}): PersonaRun => ({
  persona: dana,
  visits: [{ visit: 1, at: "Monday, November 2, 2026 at 7:05 AM", day: 0, steps: 30, minutes: 24, endedBy: "person", diary: "Set up | did my first workout.\nKnee OK.", screenshot: "screens/dana-01.png" }],
  notes: [{ visit: 1, at: "x", kind: "confusing", text: "What's RIR?", screen: "Push day" }],
  quit: null,
  stats: { workouts: 1, skipped: 0, minutes: 22, setUp: true },
  feedback: [{ username: "DanaW", message: "More pictures please" }],
  errors: [],
  interview: null,
  ...extra,
});

describe("exit interview and report", () => {
  it("asks for the interview in a fixed shape and reads it back; a refusal gives none", async () => {
    const answer = { rating: 7, would_keep_using: "maybe", verdict: "Good start.", liked: ["Short"], frustrations: [{ issue: "RIR", severity: "minor", where: "Push day" }], confusing: [], bugs: [], wishes: [], quote: "Not bad." };
    let asked: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming | undefined;
    const create: Create = async (p) => {
      asked = p;
      return message([{ type: "text", text: JSON.stringify(answer) }]);
    };
    const ledger = new Ledger(5, cfg.model);
    expect(await interview(create, ledger, cfg, run())).toEqual(answer);
    expect(asked?.output_config).toMatchObject({ effort: "medium", format: { type: "json_schema", schema: { required: expect.arrayContaining(["rating", "quote"]) } } });
    expect(JSON.stringify(asked?.messages)).toContain("What's RIR?");
    expect(await interview(async () => message([], "refusal"), ledger, cfg, run())).toBeNull();
  });

  it("says when the summary was cut off", async () => {
    const out = await synthesize(async () => message([{ type: "text", text: "## Summary" }], "max_tokens"), new Ledger(5, cfg.model), cfg, [run()]);
    expect(out).toBe("## Summary\n\n_(The summary was cut off at its length limit.)_");
  });

  it("writes the report with each person's visits, notes and feedback", () => {
    const md = renderReport({ started: "2026-10-28T10-00-00", model: "claude-opus-5-5", effort: "low", baseUrl: "http://x/test/", startDay: "2026-11-02", spent: 12.345, calls: 99, stoppedEarly: null }, [run({ quit: "Too fiddly" })], "## Summary\n- one");
    expect(md).toContain("# RepCurve simulated users: 2026-10-28");
    expect(md).toContain("about $12.35");
    expect(md).toContain("| [1](screens/dana-01.png) | Monday, November 2, 2026 at 7:05 AM | 24 | 30 | person | Set up \\| did my first workout. Knee OK. |");
    expect(md).toContain('- visit 1, _confusing_ on "Push day": What\'s RIR?');
    expect(md).toContain("- DanaW: More pictures please");
    expect(md).toContain("**Quit:** Too fiddly");
    expect(md).toContain("_No exit interview._");
  });
});
