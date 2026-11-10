import React, { useEffect, useState } from "react";
import { claimUsername, FEEDBACK_MAX, hasBackend, newIdentity, sendFeedback, usernameProblem, usernameStatus, type ClaimResult, type Identity, type Unreached } from "../platform/backend";
import { feedbackMeta } from "../platform/feedbackMeta";
import type { Account, Core, SessionRecord } from "../model/types";
import { useStore } from "../store/useAppStore";

/** What the username field says about the name typed so far. */
type Check = "empty" | "invalid" | "reserved" | "checking" | "available" | "taken" | "yours" | Unreached;

const CHECK_TEXT: Record<Check, string> = {
  empty: "3 to 20 letters, numbers or underscores.",
  invalid: "Use 3 to 20 letters, numbers or underscores, with no spaces.",
  reserved: "That one's reserved. Try another.",
  checking: "Checking…",
  available: "Available.",
  taken: "Taken. Try another.",
  yours: "That's your username.",
  offline: "You're offline, so it can't be checked yet.",
  unavailable: "Can't reach RepCurve's server to check it right now.",
};

/** Checks the name with the server a moment after typing stops. */
export function useUsernameCheck(name: string, userId?: string, current?: string): Check {
  const local = !name ? "empty" : (usernameProblem(name) ?? null);
  const [remote, setRemote] = useState<{ name: string; check: Check } | null>(null);
  useEffect(() => {
    if (local || (current && name.toLowerCase() === current.toLowerCase())) return;
    let live = true;
    const t = setTimeout(() => {
      void usernameStatus(name, userId).then((r) => {
        if (live) setRemote({ name, check: r.ok ? r.value : r.error });
      });
    }, 450);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [name, userId, local, current]);
  if (local) return local;
  if (current && name.toLowerCase() === current.toLowerCase()) return name === current ? "yours" : "available";
  return remote && remote.name === name ? remote.check : "checking";
}

/** What a claim that didn't go through means for the person. */
export function claimProblem(r: ClaimResult | Unreached): string | null {
  switch (r) {
    case "ok":
      return null;
    case "taken":
      return "That name was just taken. Try another.";
    case "invalid":
      return CHECK_TEXT.invalid;
    case "reserved":
      return CHECK_TEXT.reserved;
    case "forbidden":
      return "This phone's key doesn't match that account, so it can't be changed from here.";
    case "busy":
      return "Lots of people are signing up right now. Try again in a little while.";
    case "offline":
      return "You're offline. Try again when you're connected.";
    case "unavailable":
      return "Couldn't reach RepCurve's server. Try again in a moment.";
  }
}

/** The username input with its live check, for onboarding and the forms below. */
export function UsernameField(props: { id: string; value: string; onChange: (v: string) => void; check: Check; error?: string | null; label?: string }): React.ReactElement {
  const good = props.check === "available" || props.check === "yours";
  return (
    <div className="field">
      <label htmlFor={props.id}>{props.label ?? "Username"}</label>
      <input
        id={props.id}
        className="input"
        value={props.value}
        maxLength={20}
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        aria-describedby={`${props.id}-status`}
        aria-invalid={props.check === "invalid" || props.check === "taken" || props.check === "reserved" || undefined}
        onChange={(e) => props.onChange(e.target.value.trim())}
      />
      <span id={`${props.id}-status`} className={`meta small username-status${good ? " good" : ""}`} role="status">
        {props.error ?? CHECK_TEXT[props.check]}
      </span>
    </div>
  );
}

/** Pick or change a username and claim it on the server. */
function UsernameForm(props: { core: Core; onDone?: (username: string) => void; onCancel?: () => void; submit: string }): React.ReactElement {
  const { dispatch } = useStore();
  const account = props.core.account;
  const [name, setName] = useState(account?.username ?? "");
  // A new identity is made once and kept, so trying again with another name reuses it.
  const [identity] = useState<Identity>(() => account ?? newIdentity());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const check = useUsernameCheck(name, identity.userId, account?.username);
  const blocked = busy || check === "empty" || check === "invalid" || check === "reserved" || check === "taken" || check === "yours";
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (blocked) return;
        setBusy(true);
        setError(null);
        void claimUsername(identity, name).then((r) => {
          setBusy(false);
          const problem = claimProblem(r.ok ? r.value : r.error);
          if (problem) return setError(problem);
          dispatch({ type: "account", account: { ...identity, username: name } });
          props.onDone?.(name);
        });
      }}
    >
      <UsernameField id={account ? "change-username" : "pick-username"} label={account ? "New username" : "Username"} value={name} onChange={(v) => { setName(v); setError(null); }} check={check} error={error} />
      <div className="row-wrap">
        {props.onCancel ? <button type="button" className="btn small" onClick={props.onCancel}>Cancel</button> : null}
        <button type="submit" className="btn small primary" disabled={blocked}>{busy ? "Saving…" : props.submit}</button>
      </div>
    </form>
  );
}

/** On Today until someone has a username: one quick form, no email or password. */
export function PickUsernameCard(props: { core: Core }): React.ReactElement | null {
  const [done, setDone] = useState<string | null>(null);
  if (!hasBackend()) return null;
  if (done) return <p className="banner good" role="status">You're {done}. Change it any time in Settings.</p>;
  if (props.core.account) return null;
  return (
    <section className="card stack" aria-labelledby="pick-username-title">
      <h2 className="h3" id="pick-username-title">Pick a username</h2>
      <p className="meta small">One name that's yours alone. No email or password.</p>
      <UsernameForm core={props.core} submit="Save username" onDone={setDone} />
    </section>
  );
}

/** Settings: the username, and changing it. */
export function AccountSettings(props: { core: Core }): React.ReactElement | null {
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (!hasBackend()) return null;
  const account = props.core.account;
  return (
    <section className="card stack" aria-labelledby="username-title">
      <h2 className="h3" id="username-title">Username</h2>
      {msg ? <p className="banner good" role="status">{msg}</p> : null}
      {account && !editing ? (
        <>
          <p className="username-current setup-name">{account.username}</p>
          <p className="meta small">Unique to you. Kept on RepCurve's server with a random ID for this phone; your training stays here.</p>
          <button type="button" className="btn" style={{ alignSelf: "flex-start" }} onClick={() => { setMsg(null); setEditing(true); }}>Change username</button>
        </>
      ) : (
        <>
          {account ? null : <p className="meta small">Pick one to have your feedback reach us with your name on it. No email or password.</p>}
          <UsernameForm
            core={props.core}
            submit={account ? "Save" : "Save username"}
            {...(account ? { onCancel: () => setEditing(false) } : {})}
            onDone={() => {
              setEditing(false);
              setMsg("Username saved.");
            }}
          />
        </>
      )}
    </section>
  );
}

/** Settings: write to the people making RepCurve. */
export function FeedbackSettings(props: { core: Core; history: SessionRecord[] }): React.ReactElement | null {
  const [text, setText] = useState("");
  const [state, setState] = useState<{ tone: "good" | "stop"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!hasBackend()) return null;
  const account: Account | null = props.core.account ?? null;
  const send = () => {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setState(null);
    void sendFeedback(account, message, feedbackMeta(props.core, props.history)).then((r) => {
      setBusy(false);
      if (r.ok && r.value === "ok") {
        setText("");
        setState({ tone: "good", text: "Thanks! Your feedback was sent." });
      } else if (r.ok && r.value === "busy") setState({ tone: "stop", text: "That's a lot of feedback in one hour. Try again a little later." });
      else if (!r.ok && r.error === "offline") setState({ tone: "stop", text: "You're offline. Your note is still here; send it when you're connected." });
      else setState({ tone: "stop", text: "Couldn't reach RepCurve's server. Your note is still here; try again in a moment." });
    });
  };
  return (
    <section className="card stack" aria-labelledby="feedback-title">
      <h2 className="h3" id="feedback-title">Send feedback</h2>
      {state ? <p className={`banner ${state.tone}`} role="status">{state.text}</p> : null}
      <div className="field">
        <label htmlFor="feedback">What's working, what isn't, what you'd like to see</label>
        <textarea id="feedback" className="input prose-input" rows={5} maxLength={FEEDBACK_MAX} value={text} onChange={(e) => setText(e.target.value)} />
        {text.length > FEEDBACK_MAX - 500 ? <span className="meta small num">{FEEDBACK_MAX - text.length} characters left</span> : null}
      </div>
      <button type="button" className="btn primary" style={{ alignSelf: "flex-start" }} disabled={!text.trim() || busy} onClick={send}>
        {busy ? "Sending…" : "Send feedback"}
      </button>
      <p className="meta small">
        {account ? `Sent as ${account.username}` : "Sent without a name (pick a username above to add yours)"}, with the app version, your phone and browser, your style and how many workouts you've logged, so problems can be found and fixed.
      </p>
    </section>
  );
}
