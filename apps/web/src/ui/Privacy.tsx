import React, { useState } from "react";
import { Sheet } from "./common";
import { hasBackend } from "../platform/backend";

declare const __RUNTIME__: "pwa" | "artifact";

/** The claude.ai page keeps data in the person's Claude account; the installable app keeps it on the device. */
const inClaude = (typeof __RUNTIME__ === "undefined" ? "artifact" : __RUNTIME__) === "artifact";

/** What RepCurve keeps, where, and how to delete it. Plain facts only. */
function PrivacyNote(): React.ReactElement {
  // With a server for usernames and feedback; the claude.ai page never has one.
  const server = hasBackend();
  return (
    <>
      <p className="prose">
        {server
          ? "No analytics, no ads, no email or password. Your training stays on this device: RepCurve's server only gets your username and any feedback you send."
          : "No account, no analytics, no ads, and no server that receives your data."}
      </p>
      <section className="howto">
        <h3 className="eyebrow">What it keeps</h3>
        <ul className="howto-list">
          <li>Your profile: sex, age, height and body weight.</li>
          <li>Injuries, where things hurt when you flag pain on a set, and how sore you said you were.</li>
          <li>Your training: your plan, every session you log, and your settings.</li>
          <li>A short log of errors the app hit, on this device only, for you to copy if you report a problem.</li>
          {server ? <li>Your username, on RepCurve's server (run on Supabase), with a random ID and key made on this device so only it can change the name.</li> : null}
          {server ? <li>Feedback you send, on the same server: your words, your username, the app version, your phone and browser, your style and how many workouts you've logged.</li> : null}
        </ul>
      </section>
      <section className="howto">
        <h3 className="eyebrow">Where it's kept</h3>
        <p className="prose">
          {inClaude
            ? "In your Claude account, through claude.ai's storage for this page, so it follows you to any device where you open it. RepCurve doesn't send it anywhere else."
            : server
              ? "Your training is on this device, in this app's own storage, and isn't sent anywhere. Your username and feedback are the only things sent, to RepCurve's server."
              : "On this device, in this app's own storage. RepCurve doesn't send it anywhere."}
        </p>
        <p className="prose">
          {inClaude
            ? "Fonts and everything else are built into the page, so it asks no other site for anything."
            : "Fonts and everything else are built into the app, so it asks no other site for anything, and it works offline."}
        </p>
      </section>
      <section className="howto">
        <h3 className="eyebrow">Backups</h3>
        <p className="prose">A backup is a plain file (or text you copy) with all of the above in it. You choose where it goes, and anyone who has it can read it.</p>
      </section>
      <section className="howto">
        <h3 className="eyebrow">Delete everything</h3>
        <p className="prose">
          Settings → Start over → Reset all data deletes your profile, injuries and training history, any copy saved to undo a restore, and the error log.
          {server ? " It also deletes your username from RepCurve's server when there's a connection; feedback you sent stays, without your name." : ""}
        </p>
        <p className="prose">
          {inClaude
            ? "This browser also keeps small preferences, like your style and which looks you have unlocked. Clearing this site's data in your browser deletes those."
            : "This device also keeps small preferences, like your style and which looks you have unlocked. Removing the app, or clearing this site's data in your browser, deletes those too."}
        </p>
      </section>
      <section className="howto">
        <h3 className="eyebrow">Contact</h3>
        <p className="prose">{server ? "Send feedback from Settings → Send feedback." : "There's no contact address yet."}</p>
      </section>
    </>
  );
}

/** A "Privacy" link that opens the privacy note. */
export function PrivacyLink(props: { label?: string; className?: string }): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={props.className ?? "link-btn"} onClick={() => setOpen(true)}>
        {props.label ?? "Privacy"}
      </button>
      {open ? (
        <Sheet title="Privacy" onClose={() => setOpen(false)}>
          <PrivacyNote />
        </Sheet>
      ) : null}
    </>
  );
}

/** Settings: the privacy promise in one line, and the full note. */
export function PrivacySettings(): React.ReactElement {
  return (
    <section className="card stack">
      <h2 className="h3">Privacy</h2>
      <p className="meta">{inClaude ? "Your data stays in your Claude account." : "Your data stays on this device."} No account, no analytics, no ads.</p>
      <PrivacyLink label="What RepCurve keeps" className="btn" />
    </section>
  );
}
