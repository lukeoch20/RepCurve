import React, { useState } from "react";
import { exportBackup } from "../model/backup";
import type { AppData } from "../model/types";
import { markBackedUp } from "../platform/backupReminder";
import { backupFilename, saveTextFile } from "../platform/download";
import { useStore } from "../store/useAppStore";

export type BackupOutcome = { tone: "good" | "stop"; text: string; fallback?: string };

/** Save a backup file and say what happened. Only a save the person finished counts as backed up. */
export async function backUp(data: AppData, now = Date.now()): Promise<BackupOutcome | null> {
  const text = exportBackup(data, now);
  switch (await saveTextFile(backupFilename(new Date(now)), text)) {
    case "saved":
      markBackedUp(now);
      return { tone: "good", text: "Backup saved." };
    case "downloaded":
      markBackedUp(now);
      return { tone: "good", text: "Backup downloaded. It's in your Downloads folder (Files → Downloads on an iPhone)." };
    case "declined":
      return null;
    case "failed":
      return { tone: "stop", text: "Couldn't save a file here, so the backup is below to copy instead.", fallback: text };
  }
}

/** One tap to back up, with the result beside it. */
export function BackupButton(props: { label?: string }): React.ReactElement {
  const { data } = useStore();
  const [result, setResult] = useState<BackupOutcome | null>(null);
  return (
    <>
      <button type="button" className="btn small" onClick={() => void backUp(data).then(setResult)}>
        {props.label ?? "Back up now"}
      </button>
      {result ? (
        <span className={`meta small${result.tone === "stop" ? " warn" : ""}`} role="status">
          {result.fallback ? "Couldn't save a file here. Settings → Export backup lets you copy it instead." : result.text}
        </span>
      ) : null}
    </>
  );
}
