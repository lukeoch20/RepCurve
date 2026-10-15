import React from "react";
import { exportBackup } from "../model/backup";
import type { AppData } from "../model/types";
import { copyCrashLog, crashLogText, logCrash } from "../platform/crashLog";
import { backupFilename, saveTextFile } from "../platform/download";

interface Props {
  data: AppData;
  onReset: () => Promise<void>;
  children: React.ReactNode;
}

interface State {
  failed: boolean;
  confirmReset: boolean;
  backupText: string | null;
  /** The error log to copy by hand, when the clipboard isn't available. */
  logText: string | null;
  message: string | null;
}

/**
 * If a screen crashes on unexpected data, show a way out (save a backup, start over or
 * reload) instead of a blank page. The last resort: a failing action is caught before it gets
 * here (see safeReducer). The error is kept in the device's error log.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  override state: State = { failed: false, confirmReset: false, backupText: null, logText: null, message: null };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  override componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error("RepCurve crashed while rendering", error);
    // The component stack says which screen it was; the error's own stack says where in the code.
    const screen = info.componentStack?.trim().split("\n")[0]?.trim();
    logCrash(screen ? `showing a screen (${screen})` : "showing a screen", error);
  }

  private exportData = async () => {
    const text = exportBackup(this.props.data, Date.now());
    const r = await saveTextFile(backupFilename(), text);
    if (r === "saved") this.setState({ message: "Backup saved." });
    else if (r === "failed") this.setState({ backupText: text });
  };

  private copyLog = async () => {
    if (await copyCrashLog()) this.setState({ message: "Error log copied. Paste it into a message to whoever helps you with RepCurve." });
    else this.setState({ logText: crashLogText() });
  };

  private reset = async () => {
    try {
      await this.props.onReset();
      this.setState({ failed: false, confirmReset: false, message: null });
    } catch {
      this.setState({ message: "Couldn't delete the saved data. Reload and try again." });
    }
  };

  override render(): React.ReactNode {
    if (!this.state.failed) return this.props.children;
    const { confirmReset, backupText, logText, message } = this.state;
    return (
      <main className="app stack-lg" role="alert">
        <header className="stack">
          <p className="eyebrow">Something went wrong</p>
          <h1 className="title">RepCurve hit a problem showing this screen</h1>
          <p className="meta">Your saved data is untouched. Save a backup first, then try reloading. If it keeps happening, starting over clears the data that causes it.</p>
        </header>
        {message ? <div className="banner info">{message}</div> : null}
        <div className="stack">
          <button type="button" className="btn primary" onClick={() => void this.exportData()}>Save a backup</button>
          <button type="button" className="btn" onClick={() => window.location.reload()}>Reload</button>
          <button type="button" className="btn" onClick={() => void this.copyLog()}>Copy error log</button>
          {confirmReset ? (
            <div className="banner stop">
              <b>Delete everything and start over?</b>
              Save a backup first if you might want it.
              <div className="row" style={{ marginTop: 10 }}>
                <button type="button" className="btn" onClick={() => this.setState({ confirmReset: false })}>Cancel</button>
                <button type="button" className="btn danger solid" onClick={() => void this.reset()}>Delete everything</button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn danger" onClick={() => this.setState({ confirmReset: true })}>Start over</button>
          )}
        </div>
        {backupText !== null ? (
          <div className="field">
            <label htmlFor="crash-backup">Copy this backup somewhere safe</label>
            <textarea id="crash-backup" className="input" readOnly value={backupText} />
          </div>
        ) : null}
        {logText !== null ? (
          <div className="field">
            <label htmlFor="crash-log">Couldn't copy, so here's the error log to copy by hand</label>
            <textarea id="crash-log" className="input" readOnly value={logText} onFocus={(e) => e.currentTarget.select()} />
          </div>
        ) : null}
      </main>
    );
  }
}
