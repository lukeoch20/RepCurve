import { insideClaude, useCapability } from "./runtime";

/**
 * Give the user a text file: through claude.ai's downloads inside claude.ai, else a normal
 * browser download. "failed" means the caller should show the text for copying instead.
 */
export async function saveTextFile(filename: string, text: string): Promise<"saved" | "declined" | "failed"> {
  if (insideClaude()) {
    const dl = await useCapability<{ save(r: { filename: string; data: string }): Promise<void> }>("downloads", 4000);
    if (!dl) return "failed";
    try {
      await dl.save({ filename, data: text });
      return "saved";
    } catch (e) {
      return (e as { code?: string })?.code === "declined" ? "declined" : "failed";
    }
  }
  try {
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return "saved";
  } catch {
    return "failed";
  }
}

export const backupFilename = (now = new Date()): string => `repcurve-backup-${now.toISOString().slice(0, 10)}.json`;
