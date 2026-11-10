import { expect, test } from "@playwright/test";
import type Anthropic from "@anthropic-ai/sdk";
import { Ledger, runVisit, TOOLS, type Create, type ModelConfig, type Note } from "../sim/agent";
import { appStats, pass, snapshot, wallClock } from "../sim/observe";
import { PERSONAS } from "../sim/personas";

// The simulated-users harness (sim/) with a script standing in for the model: nothing is sent to the API.

type Params = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;
const cfg: ModelConfig = { model: "claude-opus-5-5", effort: "low", reportEffort: "medium", fallbacks: true };
const dana = PERSONAS.find((p) => p.id === "dana")!;
const usage = { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 1000, cache_creation_input_tokens: 200, iterations: null };

let id = 0;
const call = (name: string, input: Record<string, unknown>) => ({ type: "tool_use", id: `tu_${++id}`, name, input });
const reply = (content: unknown[]) => ({ id: `msg_${id}`, type: "message", role: "assistant", model: cfg.model, content, stop_reason: "tool_use", stop_sequence: null, usage }) as unknown as Anthropic.Beta.BetaMessage;

/** The latest screen the script was shown, from the opening message or the last tool result. */
function screenIn(params: Params): string {
  const last = params.messages[params.messages.length - 1]!;
  if (typeof last.content === "string") return last.content;
  const result = [...(last.content ?? [])].reverse().find((b) => b.type === "tool_result");
  return result && result.type === "tool_result" ? String(result.content) : "";
}

function ref(screen: string, label: RegExp): string {
  const line = screen.split("\n").find((l) => /^\[e\d+\]/.test(l) && label.test(l));
  if (!line) throw new Error(`No control matching ${label} in:\n${screen}`);
  return /^\[(e\d+)\]/.exec(line)![1]!;
}

async function openApp(page: import("@playwright/test").Page) {
  const start = wallClock("2026-11-02", 7, 5, "UTC");
  await page.clock.install({ time: start - 1000 });
  await page.clock.pauseAt(start);
  await page.goto("/test/");
  await pass(page, 1000);
  return start;
}

test("a scripted person sets up partway, notes something and ends the visit; time only moves as they act", async ({ page }) => {
  const start = await openApp(page);
  const steps: ((screen: string) => unknown[])[] = [
    (s) => [call("tap", { ref: ref(s, /"Set up my plan"/) })],
    (s) => [call("tap", { ref: ref(s, /button "Female"/) }), call("enter_text", { ref: ref(s, /field "Age"/), text: "52" }), call("enter_text", { ref: ref(s, /field "Weight \(lb\)"/), text: "168" })],
    () => [call("note", { kind: "confusing", text: "Why does it need my weight?" }), call("wait", { seconds: 120 })],
    (s) => [call("tap", { ref: "e999" }), call("end_visit", { diary: `Started setting up. ${/value "52"/.test(s) ? "Age is in." : "Age missing!"}`, come_back_in_days: 2 })],
  ];
  const seen: Params[] = [];
  const create: Create = async (params) => {
    seen.push(structuredClone(params));
    return reply(steps[seen.length - 1]!(screenIn(params)));
  };
  const ledger = new Ledger(10, cfg.model);
  const notes: Note[] = [];
  const outcome = await runVisit({
    create,
    ledger,
    cfg,
    persona: dana,
    page,
    visit: 1,
    maxSteps: 20,
    opening: `It's Monday.\n\nScreen:\n${await snapshot(page)}`,
    now: async () => String(await page.evaluate(() => Date.now())),
    events: [],
    notes,
    log: () => {},
    stopping: () => false,
  });

  expect(outcome).toEqual({ diary: "Started setting up. Age is in.", comeBackInDays: 2, quit: null, steps: 4, endedBy: "person" });
  expect(notes).toEqual([{ visit: 1, at: expect.any(String), kind: "confusing", text: "Why does it need my weight?", screen: "Start from where you are" }]);
  await expect(page.getByLabel("Age")).toHaveValue("52");
  await expect(page.getByLabel("Weight (lb)")).toHaveValue("168");
  // Four taps and entries at 6 seconds each, the 2-minute wait, and nothing for the model's own time.
  expect(await page.evaluate(() => Date.now())).toBe(start + 1000 + 4 * 6000 + 120_000);

  // Each request carries the whole conversation so far, unchanged, with one turn added.
  for (let i = 1; i < seen.length; i++) expect(seen[i]!.messages.slice(0, seen[i - 1]!.messages.length)).toEqual(seen[i - 1]!.messages);
  expect(seen[3]!.messages.length).toBe(7);
  // Every call gets a result; a stale tag is an error, and the screen goes with the last one.
  const results = seen[2]!.messages[4]!.content as Anthropic.Beta.BetaToolResultBlockParam[];
  expect(results.map((r) => r.tool_use_id)).toEqual(["tu_2", "tu_3", "tu_4"]);
  expect(String(results[2]!.content)).toMatch(/Screen:\n[\s\S]*number field "Age" \(value "52"\)/);
  const last = seen[3]!.messages[6]!.content as Anthropic.Beta.BetaToolResultBlockParam[];
  expect(last.map((r) => String(r.content).split("\n")[0])).toEqual(["Noted.", "About 2 minutes pass."]);

  // What every request asks for.
  expect(seen[0]).toMatchObject({ model: "claude-opus-5-5", betas: ["server-side-fallback-2026-07-01"], fallbacks: "default", cache_control: { type: "ephemeral" }, output_config: { effort: "low" } });
  expect(seen[0]!.system).toEqual([{ type: "text", text: expect.stringContaining("You are Dana Whitfield"), cache_control: { type: "ephemeral" } }]);
  expect(seen[0]!.tools).toEqual(TOOLS);
  expect(TOOLS.every((t) => t.strict && (t.input_schema as { additionalProperties?: boolean }).additionalProperties === false)).toBe(true);
  expect(ledger.calls).toBe(4);
  expect(ledger.spent).toBeCloseTo(4 * 0.0026, 6);
});

test("a visit stops at its step limit, and before the next request once the budget is spent", async ({ page }) => {
  await openApp(page);
  const base = { cfg, persona: dana, page, visit: 1, now: async () => "now", events: [], notes: [], log: () => {}, stopping: () => false, opening: "Screen:\n(blank)" };
  const waiting: Create = async () => reply([call("wait", { seconds: 30 })]);
  const capped = await runVisit({ ...base, create: waiting, ledger: new Ledger(10, cfg.model), maxSteps: 3 });
  expect(capped).toMatchObject({ steps: 3, endedBy: "steps", comeBackInDays: null });

  // $1.20 a step against a $3 budget (visits stop $1 short of it): two steps, then no more requests.
  const pricey = { ...usage, input_tokens: 300_000, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
  let calls = 0;
  const expensive: Create = async () => {
    calls++;
    return { ...reply([call("wait", { seconds: 30 })]), usage: pricey } as Anthropic.Beta.BetaMessage;
  };
  const broke = await runVisit({ ...base, create: expensive, ledger: new Ledger(3, cfg.model), maxSteps: 20 });
  expect(broke).toMatchObject({ steps: 2, endedBy: "budget" });
  expect(calls).toBe(2);
  expect(await appStats(page)).toEqual({ workouts: 0, skipped: 0, minutes: 0, setUp: false });
});
