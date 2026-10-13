import { insideClaude, useCapability } from "./runtime";

/**
 * Give the user a text file: through claude.ai's downloads inside claude.ai; on a phone, through
 * the share sheet (Save to Files, iCloud Drive, a note, an email to yourself); else a normal
 * browser download.
 * - "saved": the person finished saving or sending it.
 * - "downloaded": the browser was asked to download it, which can't be confirmed.
 * - "declined": they closed the share sheet or the save prompt.
 * - "failed": the caller should show the text for copying instead.
 */
export async function saveTextFile(filename: string, text: string): Promise<"saved" | "downloaded" | "declined" | "failed"> {
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
  const shared = await shareFile(filename, text);
  if (shared !== "unavailable") return shared;
  try {
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return "downloaded";
  } catch {
    return "failed";
  }
}

export const backupFilename = (now = new Date()): string => `repcurve-backup-${now.toISOString().slice(0, 10)}.json`;

/** The share sheet with the file attached, on touch devices that can share files. */
async function shareFile(filename: string, text: string): Promise<"saved" | "declined" | "unavailable"> {
  try {
    if (typeof navigator.share !== "function" || !window.matchMedia?.("(pointer: coarse)").matches) return "unavailable";
    const file = new File([text], filename, { type: "application/json" });
    if (!navigator.canShare?.({ files: [file] })) return "unavailable";
    await navigator.share({ files: [file], title: "RepCurve backup" });
    return "saved";
  } catch (e) {
    return (e as { name?: string })?.name === "AbortError" ? "declined" : "unavailable";
  }
}
