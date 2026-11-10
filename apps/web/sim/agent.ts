import type Anthropic from "@anthropic-ai/sdk";
import type { Page } from "@playwright/test";
import { pass, snapshot, tap, type } from "./observe";
import type { Persona } from "./personas";

type Params = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;
type Message = Anthropic.Beta.BetaMessage;
type MessageParam = Anthropic.Beta.BetaMessageParam;
type ContentBlock = Anthropic.Beta.BetaContentBlock;
type ToolUse = Anthropic.Beta.BetaToolUseBlock;
type ToolResult = Anthropic.Beta.BetaToolResultBlockParam;
type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/** One request to the Messages API. The runner passes the real client; tests pass a script. */
export type Create = (params: Params) => Promise<Message>;

export interface ModelConfig {
  model: string;
  /** For each step in the app. */
  effort: Effort;
  /** For the exit interviews and the report. */
  reportEffort: Effort;
  /** Server-side fallback when the model declines a request (`fallbacks: "default"`). */
  fallbacks: boolean;
}

/** US$ per million tokens: input, output, 5-minute cache write, cache read. */
const PRICES: [prefix: string, price: { input: number; output: number; write: number; read: number }][] = [
  ["claude-opus-5-5", { input: 4, output: 20, write: 5, read: 0.2 }],
  ["claude-sonnet-5-5", { input: 2, output: 10, write: 2.5, read: 0.2 }],
  ["claude-haiku-5-5", { input: 0.1, output: 0.5, write: 0.125, read: 0.01 }],
];

export function priceOf(model: string) {
  return PRICES.find(([prefix]) => model.startsWith(prefix))?.[1] ?? PRICES[0]![1];
}

/** What the run has spent, and whether the budget is used up. */
export class Ledger {
  spent = 0;
  calls = 0;
  tokens = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
  constructor(
    readonly limit: number,
    readonly model: string,
  ) {}

  add(msg: Message): void {
    this.calls++;
    // With a fallback, each attempt is listed and billed at its own model's price.
    const parts = msg.usage.iterations?.length ? msg.usage.iterations : [{ ...msg.usage, model: msg.model }];
    for (const u of parts) {
      const p = priceOf(("model" in u ? u.model : null) ?? this.model);
      const write = u.cache_creation_input_tokens ?? 0;
      const read = u.cache_read_input_tokens ?? 0;
      this.tokens.input += u.input_tokens;
      this.tokens.output += u.output_tokens;
      this.tokens.cacheWrite += write;
      this.tokens.cacheRead += read;
      this.spent += (u.input_tokens * p.input + u.output_tokens * p.output + write * p.write + read * p.read) / 1e6;
    }
  }

  /** Visits stop here, leaving a little for the interviews and the report. */
  get over(): boolean {
    return this.spent >= this.limit - Math.max(1, this.limit * 0.1);
  }
}

/** Adds what every request carries: model, caching, fallback, effort. */
export function request(cfg: ModelConfig, effort: Effort, p: Omit<Params, "model">): Params {
  return {
    model: cfg.model,
    cache_control: { type: "ephemeral" },
    ...(cfg.fallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    ...p,
    output_config: { effort, ...p.output_config },
  };
}

/**
 * After a fallback partway through a reply, blocks before the switch can't be sent back; the
 * rest of the reply is kept as it came, thinking included.
 */
export function echoable(content: ContentBlock[]): ContentBlock[] {
  const last = content.map((b) => b.type).lastIndexOf("fallback");
  if (last < 0) return content;
  return content.filter((b, i) => i > last || !(b.type === "thinking" || b.type === "redacted_thinking" || b.type === "tool_use"));
}

export const NOTE_KINDS = ["confusing", "bug", "liked", "suggestion", "frustrated", "observation"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

export interface Note {
  visit: number;
  at: string;
  kind: NoteKind;
  text: string;
  /** The screen's first heading when the note was made. */
  screen: string;
}

const object = (properties: Record<string, unknown>) => ({ type: "object" as const, properties, required: Object.keys(properties), additionalProperties: false });

export const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "tap",
    description: "Tap a control on the screen by its tag, such as e12. Tags come from the latest screen only.",
    strict: true,
    input_schema: object({ ref: { type: "string", description: "The control's tag, such as e12." } }),
  },
  {
    name: "enter_text",
    description: "Type into a text or number field, replacing what's there; or, for a drop-down, pick the option with this visible text.",
    strict: true,
    input_schema: object({ ref: { type: "string", description: "The field's tag, such as e7." }, text: { type: "string" } }),
  },
  {
    name: "wait",
    description: "Let time pass with the app open: doing a set, resting between sets, walking on the treadmill, or being interrupted. The app's timers run. Between 5 and 1800 seconds.",
    strict: true,
    input_schema: object({ seconds: { type: "integer" } }),
  },
  {
    name: "note",
    description:
      "Jot down a reaction for the people who make RepCurve, in your own voice: what screen, what you expected, what happened. Use it for anything confusing, broken, liked, wished for or frustrating. These notes are what they'll read.",
    strict: true,
    input_schema: object({ kind: { type: "string", enum: [...NOTE_KINDS] }, text: { type: "string" } }),
  },
  {
    name: "end_visit",
    description: "Put the phone down and end this visit. Write a short diary entry for yourself and say in how many days (1 to 14) you'd next open the app.",
    strict: true,
    input_schema: object({ diary: { type: "string" }, come_back_in_days: { type: "integer" } }),
  },
  {
    name: "quit_app",
    description: "Stop using RepCurve for good. Only if you'd genuinely give up on it; say why.",
    strict: true,
    input_schema: object({ reason: { type: "string" } }),
  },
];

export function systemPrompt(p: Persona): string {
  return `You are playing a real person trying out RepCurve, a strength-training app for phones, so the people who make it can learn what it's like to use. Stay in character: notice, decide and react as ${p.name} would, not as a software tester or an AI that knows how apps are built.

${p.card}

How this works
- You see the app's screen as text. Controls you can use are tagged like [e12] with their kind and label; states such as (selected), (on), (disabled) or (value "…") follow. Headings start with #. The whole page is listed, including what you'd scroll down to.
- Act with the tools: tap a control, enter_text into a field, wait to let time pass. Each tap takes a few seconds of your time. The app's clock follows yours, so a 20-minute workout should take about 20 minutes of waiting.
- When you do a workout, really do it: go set by set, wait roughly as long as each set and rest would take, and log what ${p.name} actually managed. Don't race through a workout just to see the next screen.
- Use note whenever something strikes you: confusion, a bug, something you like, a wish, frustration. Be specific about the screen, what you expected and what happened. Notes are what the makers will read most closely, so be honest and concrete. Don't invent problems you didn't run into.
- If the app asks for a username, pick one ${p.name} would choose.
- A visit is one sitting with your phone, usually a workout or a quick look. When you'd put the phone down, call end_visit with a short diary entry (what you did, how it felt, anything to remember) and when you'd next open the app. If you'd genuinely give up on RepCurve, call quit_app instead.
- You're trying RepCurve in your phone's web browser, so skip anything about adding it to your home screen. You can't leave the app; a link to another website opens in a tab that you glance at and close.
- Keep your thinking short and practical. Usually make one or two tool calls per turn; several are fine when you know what will happen, such as a wait and then a tap.`;
}

export interface VisitContext {
  create: Create;
  ledger: Ledger;
  cfg: ModelConfig;
  persona: Persona;
  page: Page;
  visit: number;
  maxSteps: number;
  /** The visit's first message: the date, what's going on, the diary so far and the screen. */
  opening: string;
  /** The app's time in words, for the person. */
  now: () => Promise<string>;
  /** Things that happened outside the page (a file saved, a link opened, a pop-up from the browser), to tell the person once. */
  events: string[];
  notes: Note[];
  log: (entry: Record<string, unknown>) => void;
  /** True when the run is being stopped (Ctrl-C, or the API key was refused). */
  stopping: () => boolean;
}

export interface VisitOutcome {
  diary: string;
  comeBackInDays: number | null;
  quit: string | null;
  steps: number;
  endedBy: "person" | "steps" | "budget" | "stopped" | "refusal" | "silent";
}

/** The person's time each tap or entry takes. */
const HUMAN_PACE_MS = 6000;

/** One sitting with the app: a fresh conversation, run until the person puts the phone down. */
export async function runVisit(ctx: VisitContext): Promise<VisitOutcome> {
  const messages: MessageParam[] = [{ role: "user", content: ctx.opening }];
  let steps = 0;
  let nudges = 0;
  let screen = ctx.opening;
  const cut = (endedBy: VisitOutcome["endedBy"], diary: string): VisitOutcome => ({ diary, comeBackInDays: null, quit: null, steps, endedBy });

  for (;;) {
    if (ctx.ledger.over) return cut("budget", "(The visit was cut short: the run's budget was used up.)");
    if (ctx.stopping()) return cut("stopped", "(The visit was cut short when the run was stopped.)");
    if (steps >= ctx.maxSteps) return cut("steps", "(The visit ran out of steps and was cut short.)");
    const res = await ctx.create(request(ctx.cfg, ctx.cfg.effort, { max_tokens: 8000, system: [{ type: "text", text: systemPrompt(ctx.persona), cache_control: { type: "ephemeral" } }], tools: TOOLS, messages }));
    ctx.ledger.add(res);
    steps++;
    const said = res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    ctx.log({ type: "model", visit: ctx.visit, step: steps, model: res.model, stop: res.stop_reason, said: said || undefined, calls: res.content.filter((b) => b.type === "tool_use").map((b) => ({ name: b.name, input: b.input })), usage: res.usage, spent: Number(ctx.ledger.spent.toFixed(4)) });
    if (res.stop_reason === "refusal") return cut("refusal", "(The model declined to continue this visit.)");

    const content = echoable(res.content);
    messages.push({ role: "assistant", content });
    const uses = content.filter((b): b is ToolUse => b.type === "tool_use");
    if (!uses.length) {
      if (++nudges > 2) return cut("silent", said || "(The visit ended without a diary entry.)");
      messages.push({ role: "user", content: "(Carry on as yourself using the tools: act in the app, or call end_visit if you'd put the phone down now.)" });
      continue;
    }

    const results: ToolResult[] = [];
    let finished: VisitOutcome | null = null;
    for (const use of uses) {
      if (finished) {
        results.push({ type: "tool_result", tool_use_id: use.id, content: "The visit has ended." });
        continue;
      }
      const out = await act(ctx, use, steps, screen);
      if (out.finish) finished = out.finish;
      results.push({ type: "tool_result", tool_use_id: use.id, content: out.text, ...(out.error ? { is_error: true } : {}) });
    }
    if (finished) return finished;

    screen = await snapshot(ctx.page);
    const tail = [
      ...ctx.events.splice(0).map((e) => `(${e})`),
      `It's now ${await ctx.now()}.`,
      steps >= ctx.maxSteps - 5 ? "(You're almost out of time for this visit: wrap up in the next few actions and call end_visit.)" : "",
      `Screen:\n${screen}`,
    ].filter(Boolean);
    const last = results[results.length - 1]!;
    last.content = `${String(last.content)}\n\n${tail.join("\n")}`;
    messages.push({ role: "user", content: results });
  }
}

async function act(ctx: VisitContext, use: ToolUse, steps: number, screen: string): Promise<{ text: string; error?: boolean; finish?: VisitOutcome }> {
  const input = (use.input ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof input[k] === "string" ? (input[k] as string) : "");
  const num = (k: string) => (typeof input[k] === "number" ? (input[k] as number) : NaN);
  ctx.log({ type: "action", visit: ctx.visit, step: steps, name: use.name, input });
  switch (use.name) {
    case "tap": {
      const r = await tap(ctx.page, str("ref"));
      if (r.ok) await pass(ctx.page, HUMAN_PACE_MS);
      return { text: r.text, error: !r.ok };
    }
    case "enter_text": {
      const r = await type(ctx.page, str("ref"), str("text"));
      if (r.ok) await pass(ctx.page, HUMAN_PACE_MS);
      return { text: r.text, error: !r.ok };
    }
    case "wait": {
      const s = Math.min(1800, Math.max(5, Math.round(num("seconds") || 30)));
      await pass(ctx.page, s * 1000);
      return { text: s >= 90 ? `About ${Math.round(s / 60)} minutes pass.` : `${s} seconds pass.` };
    }
    case "note": {
      const kind = (NOTE_KINDS as readonly string[]).includes(str("kind")) ? (str("kind") as NoteKind) : "observation";
      ctx.notes.push({ visit: ctx.visit, at: await ctx.now(), kind, text: str("text"), screen: screen.split("\n").find((l) => l.startsWith("#"))?.replace(/^#+\s*/, "") ?? "" });
      return { text: "Noted." };
    }
    case "end_visit": {
      const days = Math.min(14, Math.max(1, Math.round(num("come_back_in_days") || ctx.persona.rhythm)));
      return { text: "Visit over.", finish: { diary: str("diary"), comeBackInDays: days, quit: null, steps, endedBy: "person" } };
    }
    case "quit_app":
      return { text: "You've stopped using RepCurve.", finish: { diary: str("reason"), comeBackInDays: null, quit: str("reason") || "(no reason given)", steps, endedBy: "person" } };
    default:
      return { text: `There's no tool called ${use.name}.`, error: true };
  }
}
