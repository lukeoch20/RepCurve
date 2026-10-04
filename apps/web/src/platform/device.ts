/** Small wrappers around device features, all optional and failure-tolerant. */

let audio: AudioContext | null = null;

/** Call from a tap so later beeps are allowed to play. */
export function unlockAudio(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audio ??= new Ctx();
    if (audio.state === "suspended") void audio.resume();
  } catch {
    audio = null;
  }
}

/** Three short beeps; the last one higher, like a gym interval clock. */
export function beep(pattern: "go" | "segment" = "go"): void {
  try {
    if (!audio) return;
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session) session.type = "transient";
    const t0 = audio.currentTime + 0.02;
    const notes = pattern === "go" ? [880, 880, 1320] : [660, 990];
    notes.forEach((freq, i) => {
      const osc = audio!.createOscillator();
      const gain = audio!.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      const start = t0 + i * 0.22;
      const len = i === notes.length - 1 ? 0.32 : 0.14;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + len);
      osc.connect(gain).connect(audio!.destination);
      osc.start(start);
      osc.stop(start + len + 0.02);
    });
  } catch {
    // sound is a nicety
  }
}

type Sentinel = { release(): Promise<void>; addEventListener?: (t: string, f: () => void) => void };
let lock: Sentinel | null = null;
let wanted = false;

async function acquire(): Promise<void> {
  try {
    const wl = (navigator as unknown as { wakeLock?: { request(t: "screen"): Promise<Sentinel> } }).wakeLock;
    if (!wl || document.visibilityState !== "visible") return;
    lock = await wl.request("screen");
    lock.addEventListener?.("release", () => {
      lock = null;
    });
  } catch {
    lock = null;
  }
}

function onVisibility(): void {
  if (wanted && document.visibilityState === "visible" && !lock) void acquire();
}

/** Keep the screen on during a workout (where the device allows it). */
export function keepAwake(on: boolean): void {
  wanted = on;
  if (on) {
    document.addEventListener("visibilitychange", onVisibility);
    if (!lock) void acquire();
  } else {
    document.removeEventListener("visibilitychange", onVisibility);
    const l = lock;
    lock = null;
    void l?.release().catch(() => {});
  }
}
