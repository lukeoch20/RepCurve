import { insideClaude, useCapability } from "./runtime";
import { isIOS } from "./install";

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

/** Whether this browser's share sheet takes a file like this one. */
export function canShareFile(file: File): boolean {
  try {
    return typeof navigator.share === "function" && !!navigator.canShare?.({ files: [file] });
  } catch {
    return false;
  }
}

/**
 * Give the user a file such as an image: through the share sheet where it takes files, else
 * as a browser download. Call it straight from a tap, as the share sheet needs one.
 */
export async function shareOrSaveFile(file: File, title: string): Promise<"saved" | "downloaded" | "declined" | "failed"> {
  if (canShareFile(file)) {
    try {
      await navigator.share({ files: [file], title });
      return "saved";
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") return "declined";
      // fall back to a download
    }
  }
  // Inside claude.ai a page can't start a download of its own.
  if (insideClaude()) return "failed";
  try {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return "downloaded";
  } catch {
    return "failed";
  }
}

export const backupFilename =(now = new Date()): string => `repcurve-backup-${now.toISOString().slice(0, 10)}.json`;

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

/**
 * Hand a calendar file to the phone's calendar. iPhone Safari shows its "Add to Calendar" preview
 * for a calendar file it opens; elsewhere it downloads, and opening it adds the events.
 */
export async function openCalendarFile(filename: string, ics: string): Promise<"opened" | "downloaded" | "failed"> {
  if (insideClaude()) {
    const dl = await useCapability<{ save(r: { filename: string; data: string }): Promise<void> }>("downloads", 4000);
    if (!dl) return "failed";
    try {
      await dl.save({ filename, data: ics });
      return "downloaded";
    } catch {
      return "failed";
    }
  }
  try {
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    if (isIOS()) {
      window.location.assign(url);
      return "opened";
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    return "downloaded";
  } catch {
    return "failed";
  }
}
