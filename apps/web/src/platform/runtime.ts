/** Thin, typed access to the claude.ai page runtime, when the app runs inside it. */

type Use = (name: string) => Promise<unknown>;

export function claudeRuntime(): { use: Use } | null {
  const w = window as unknown as { claude?: { use?: Use } };
  return w.claude && typeof w.claude.use === "function" ? (w.claude as { use: Use }) : null;
}

export function insideClaude(): boolean {
  return claudeRuntime() !== null;
}

/** `claude.use(name)` with a timeout, resolving null when unavailable. */
export async function useCapability<T>(name: string, timeoutMs = 12_000): Promise<T | null> {
  const rt = claudeRuntime();
  if (!rt) return null;
  try {
    return (await Promise.race([
      rt.use(name),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ])) as T | null;
  } catch {
    return null;
  }
}
