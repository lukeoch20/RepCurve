import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { hasGymEquipment } from "@repcurve/engine";
import type { Equipment } from "@repcurve/shared";
import {
  BODYWEIGHT_ID,
  BODYWEIGHT_NAME,
  MAX_NAME,
  MAX_SETUPS,
  NO_EQUIPMENT,
  TEMPLATES,
  cleanName,
  currentSetup,
  deleteOutcome,
  equipmentSummary,
  freeName,
  ongoingSetup,
  templateEquipment,
  usualSetup,
  type SetupView,
} from "../model/setups";
import type { Core, Location, TrainingSetup } from "../model/types";
import { useStore } from "../store/useAppStore";
import { Icon, Seg, Sheet } from "./common";
import { EquipmentEditor, eqDraftFrom, toEquipment, type EqDraft } from "./EquipmentEditor";

/** The Training setups screen: its list, or straight into adding one; and the tab it was opened from. */
export interface SetupsRoute {
  add: boolean;
  from: "today" | "settings";
}

/** Opens the Training setups screen from anywhere in the tabs. */
const OpenSetups = createContext<(route: SetupsRoute) => void>(() => {});
export const SetupsOpener = OpenSetups.Provider;
export const useOpenSetups = () => useContext(OpenSetups);

const BODYWEIGHT_VIEW: SetupView = { id: BODYWEIGHT_ID, name: BODYWEIGHT_NAME, equipment: NO_EQUIPMENT, builtIn: true };

/** Every setup there is to pick: the saved ones, then Bodyweight only. */
const allSetups = (core: Core): SetupView[] => [...core.setups.list.map((s) => ({ ...s, builtIn: false })), BODYWEIGHT_VIEW];

/** Why a name can't be saved, or null. Names are only for telling setups apart. */
function nameProblem(core: Core, name: string, id: string | null): string | null {
  const clean = cleanName(name).toLowerCase();
  if (!clean) return "Give it a name.";
  if (clean === BODYWEIGHT_NAME.toLowerCase() || core.setups.list.some((x) => x.id !== id && x.name.toLowerCase() === clean)) return `You already have a setup called ${cleanName(name)}.`;
  return null;
}

// ---------------------------------------------------------------- Today: the setup in use, and changing it

/**
 * The setup the next workout uses, on Today: its name, what it has and a way to change it. `picker`
 * opens the picker straight away (on the way back from the setups screen), with a note if given.
 */
export function SetupCard(props: { core: Core; picker?: { note: string | null } | null; onPickerShown?: () => void }): React.ReactElement {
  const { core } = props;
  const { dispatch } = useStore();
  const openSetups = useOpenSetups();
  const [picking, setPicking] = useState(props.picker != null);
  const [note, setNote] = useState(props.picker?.note ?? null);
  const change = useRef<HTMLButtonElement>(null);
  // Closing the picker puts focus back on Change, also when it opened on its own.
  const refocus = useRef(false);
  useEffect(() => {
    if (props.picker) props.onPickerShown?.();
  }, []);
  useEffect(() => {
    if (picking || !refocus.current) return;
    refocus.current = false;
    change.current?.focus({ preventScroll: true });
  }, [picking]);
  const s = currentSetup(core);
  const usual = usualSetup(core.setups);
  const leave = (route: SetupsRoute) => {
    setPicking(false);
    openSetups(route);
  };

  return (
    <section className="card stack setup-card" aria-labelledby="setup-card-title">
      <div className="spread">
        <span className="eyebrow" id="setup-card-title">Training setup</span>
        <button ref={change} type="button" className="btn small" aria-haspopup="dialog" aria-label="Change training setup" onClick={() => setPicking(true)}>
          Change
        </button>
      </div>
      <div className="setup-title">
        <p className="h3 setup-name">{s.name}</p>
        {s.mode === "usual" ? <span className="example-tag">Usual</span> : <span className="example-tag">{s.mode === "once" ? "This workout" : "Kept"}</span>}
      </div>
      <p className="meta small">{equipmentSummary(s.equipment)}</p>
      {s.mode !== "usual" ? (
        <p className="meta small">
          {s.mode === "once" ? `Just this workout, then back to ${ongoingSetup(core.setups).name}. ` : "Kept for every workout until you change it. "}
          <button type="button" className="link-btn" onClick={() => dispatch({ type: "backToUsual" })}>
            Back to usual ({usual.name})
          </button>
        </p>
      ) : null}
      {picking ? (
        <SetupPicker
          core={core}
          note={note}
          onClose={() => {
            refocus.current = true;
            setNote(null);
            setPicking(false);
          }}
          onAdd={() => leave({ add: true, from: "today" })}
          onManage={() => leave({ add: false, from: "today" })}
        />
      ) : null}
    </section>
  );
}

/** Pick the setup for the next workout: for this workout only, or kept until changed. */
function SetupPicker(props: { core: Core; note: string | null; onClose: () => void; onAdd: () => void; onManage: () => void }): React.ReactElement {
  const { core } = props;
  const { dispatch } = useStore();
  const s = currentSetup(core);
  const usual = usualSetup(core.setups);
  const full = core.setups.list.length >= MAX_SETUPS;
  return (
    <Sheet title="Training setup" onClose={props.onClose}>
      {props.note ? <p className="banner good" role="status">{props.note}</p> : null}
      <p className="meta small">Exercises and weights follow the equipment of the setup you pick. Your progress carries across all of them.</p>
      <div className="choice setup-choices" role="group" aria-label="Training setups">
        {allSetups(core).map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={s.id === o.id}
            onClick={() => {
              if (o.id !== s.id) dispatch({ type: "chooseSetup", id: o.id, mode: "once" });
            }}
          >
            <b className="setup-name">{o.name}</b>
            <span>
              {o.id === usual.id ? "Usual · " : ""}
              {equipmentSummary(o.equipment)}
            </span>
          </button>
        ))}
      </div>
      {s.mode !== "usual" ? (
        <div className="field">
          <span className="label">Use {s.name} for</span>
          <Seg
            label={`Use ${s.name} for`}
            value={s.mode}
            onChange={(mode) => dispatch({ type: "chooseSetup", id: s.id, mode })}
            options={[
              { value: "once", label: "This workout" },
              { value: "kept", label: "Keep using this setup" },
            ]}
          />
        </div>
      ) : null}
      <p className="meta setup-status" role="status">
        Next workout: <b className="setup-name">{s.name}</b>
        {s.mode === "once" ? `, then back to ${ongoingSetup(core.setups).name}.` : s.mode === "kept" ? `, until you change it. ${usual.name} stays your usual setup.` : ", your usual setup."}
      </p>
      <button type="button" className="btn primary" onClick={props.onClose}>
        Done
      </button>
      <div className="row-wrap" style={{ justifyContent: "center" }}>
        <button type="button" className="btn ghost small" onClick={props.onAdd} disabled={full}>
          <Icon name="plus" size={16} />
          Add setup
        </button>
        <button type="button" className="btn ghost small" onClick={props.onManage}>
          Manage setups
        </button>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- the Training setups screen

type View =
  | { kind: "list" }
  | { kind: "start" }
  /** A new setup (`id` null) or a saved one, with what the editor starts from. */
  | { kind: "edit"; id: string | null; name: string; equipment: Equipment; prefilled: boolean };

/**
 * Saved setups: add, rename, duplicate, edit, delete, and pick the usual one. Changes here never
 * pick a setup for the next workout, and never touch a workout already started or done.
 * `onClose` takes a note to show where it goes back to.
 */
export function Setups(props: { core: Core; start: "list" | "add"; onClose: (note?: string) => void }): React.ReactElement {
  const { core } = props;
  const { dispatch } = useStore();
  const [view, setView] = useState<View>(props.start === "add" ? { kind: "start" } : { kind: "list" });
  const [msg, setMsg] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  // Each view starts at the top with its heading focused, so it's clear where you are.
  useEffect(() => {
    window.scrollTo(0, 0);
    heading.current?.focus({ preventScroll: true });
  }, [view.kind]);
  const toList = (note?: string) => {
    if (props.start === "add") props.onClose(note);
    else {
      setMsg(note ?? null);
      setView({ kind: "list" });
    }
  };
  const units = core.profile.units;

  if (view.kind === "start") {
    return (
      <div className="stack-lg">
        <header className="stack" style={{ gap: 6 }}>
          <button type="button" className="link-btn" onClick={() => toList()}>
            <Icon name="chevronLeft" size={14} /> Back
          </button>
          <p className="eyebrow">New setup</p>
          <h1 className="title" tabIndex={-1} ref={heading}>Start from</h1>
          <p className="meta">A starting point to check over. Nothing is saved until you save it.</p>
        </header>
        <div className="choice" role="group" aria-label="Start from">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setView({ kind: "edit", id: null, name: freeName(core.setups, t.name), equipment: templateEquipment(t.id, units), prefilled: t.id === "gym" })}
            >
              <b>{t.label}</b>
              <span>{t.hint}</span>
            </button>
          ))}
        </div>
        <p className="meta small">No equipment at all? Bodyweight only is always there to pick on Today, with nothing to set up.</p>
      </div>
    );
  }

  if (view.kind === "edit") {
    return (
      <SetupEditor
        key={view.id ?? "new"}
        core={core}
        view={view}
        heading={heading}
        onBack={() => (view.id === null ? setView({ kind: "start" }) : toList())}
        onCancel={() => toList()}
        onSave={(name, equipment) => {
          if (view.id === null) {
            dispatch({ type: "addSetup", name, equipment, now: Date.now() });
            toList(props.start === "add" ? `Saved ${name}. Pick it to use it.` : `Saved ${name}. Pick it on Today before a workout.`);
          } else {
            dispatch({ type: "updateSetup", id: view.id, name, equipment });
            toList(`Saved ${name}.`);
          }
        }}
      />
    );
  }

  const full = core.setups.list.length >= MAX_SETUPS;
  return (
    <div className="stack-lg">
      <header className="stack" style={{ gap: 6 }}>
        <button type="button" className="link-btn" onClick={() => props.onClose()}>
          <Icon name="chevronLeft" size={14} /> Back
        </button>
        <p className="eyebrow">Equipment</p>
        <h1 className="title" tabIndex={-1} ref={heading}>Training setups</h1>
        <p className="meta">The equipment for each place you train. Pick one on Today before a workout; your progress carries across all of them.</p>
      </header>
      {msg ? <p className="banner good" role="status">{msg}</p> : null}
      <div className="stack">
        {core.setups.list.map((x) => (
          <SetupItem
            key={x.id}
            core={core}
            setup={x}
            onEdit={() => setView({ kind: "edit", id: x.id, name: x.name, equipment: x.equipment, prefilled: false })}
            onDone={(note, gone) => {
              setMsg(note);
              if (gone) heading.current?.focus({ preventScroll: true });
            }}
          />
        ))}
        <BodyweightItem core={core} onDone={setMsg} />
      </div>
      <button type="button" className="btn primary" disabled={full} onClick={() => setView({ kind: "start" })}>
        <Icon name="plus" size={18} />
        Add setup
      </button>
      {full ? <p className="meta small">That's as many setups as RepCurve keeps ({MAX_SETUPS}). Delete one to add another.</p> : null}
      <p className="meta small">Workouts use your usual setup unless you pick another on Today, and the week's schedule follows it.</p>
    </div>
  );
}

/** The tag beside a setup's name: usual, or chosen for the next workout. */
function SetupTag(props: { core: Core; id: string }): React.ReactElement | null {
  const s = currentSetup(props.core);
  if (props.core.setups.usual === props.id) return <span className="example-tag">Usual</span>;
  if (s.id !== props.id) return null;
  return <span className="example-tag">{s.mode === "once" ? "This workout" : "Kept"}</span>;
}

function SetupItem(props: { core: Core; setup: TrainingSetup; onEdit: () => void; onDone: (note: string, gone?: boolean) => void }): React.ReactElement {
  const { core, setup } = props;
  const { dispatch } = useStore();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(setup.name);
  const [confirm, setConfirm] = useState(false);
  const usual = core.setups.usual === setup.id;
  const full = core.setups.list.length >= MAX_SETUPS;
  const head = useRef<HTMLHeadingElement>(null);
  const renameBtn = useRef<HTMLButtonElement>(null);
  const deleteBtn = useRef<HTMLButtonElement>(null);
  // Where focus goes once a rename or delete question closes, or the button pressed has gone.
  const refocus = useRef<"head" | "rename" | "delete" | null>(null);
  useEffect(() => {
    const to = refocus.current;
    refocus.current = null;
    (to === "head" ? head : to === "rename" ? renameBtn : to === "delete" ? deleteBtn : null)?.current?.focus({ preventScroll: true });
  });
  const titleId = `setup-${setup.id}`;
  const problem = renaming ? nameProblem(core, name, setup.id) : null;

  return (
    <section className="card stack setup-item" aria-labelledby={titleId}>
      <div className="spread">
        <h2 className="h3 setup-name" id={titleId} ref={head} tabIndex={-1}>{setup.name}</h2>
        <SetupTag core={core} id={setup.id} />
      </div>
      <p className="meta small">{equipmentSummary(setup.equipment, 4)}</p>
      {renaming ? (
        <form
          className="field"
          onSubmit={(e) => {
            e.preventDefault();
            if (problem) return;
            dispatch({ type: "updateSetup", id: setup.id, name });
            refocus.current = "rename";
            setRenaming(false);
            props.onDone(`Renamed to ${cleanName(name)}. Past workouts keep the name they had.`);
          }}
        >
          <label htmlFor={`${titleId}-name`}>New name</label>
          <input id={`${titleId}-name`} className="input" value={name} maxLength={MAX_NAME} autoComplete="off" autoFocus onChange={(e) => setName(e.target.value)} />
          {problem ? <span className="meta small" role="status">{problem}</span> : null}
          <div className="row" style={{ marginTop: 4 }}>
            <button type="button" className="btn small" onClick={() => { refocus.current = "rename"; setRenaming(false); }}>
              Cancel
            </button>
            <button type="submit" className="btn small primary" disabled={!!problem}>
              Save name
            </button>
          </div>
        </form>
      ) : confirm ? (
        <div className="banner stop">
          <b>Delete {setup.name}?</b>
          {deleteOutcome(core.setups, setup.id, core.nextIndex)}
          <div className="row" style={{ marginTop: 10 }}>
            <button type="button" className="btn" autoFocus onClick={() => { refocus.current = "delete"; setConfirm(false); }}>
              Keep it
            </button>
            <button
              type="button"
              className="btn danger solid"
              onClick={() => {
                const outcome = deleteOutcome(core.setups, setup.id, core.nextIndex);
                dispatch({ type: "deleteSetup", id: setup.id });
                props.onDone(`Deleted ${setup.name}. ${outcome}`, true);
              }}
            >
              Delete
            </button>
          </div>
        </div>
      ) : (
        <div className="row-wrap setup-actions">
          <button type="button" className="btn small" onClick={props.onEdit}>Edit equipment</button>
          <button ref={renameBtn} type="button" className="btn small" onClick={() => { setName(setup.name); setRenaming(true); }}>Rename</button>
          <button
            type="button"
            className="btn small"
            disabled={full}
            onClick={() => {
              dispatch({ type: "duplicateSetup", id: setup.id, now: Date.now() });
              props.onDone(`Copied ${setup.name}. Edit the copy to suit the other place.`);
            }}
          >
            Duplicate
          </button>
          {!usual ? (
            <button
              type="button"
              className="btn small"
              onClick={() => {
                dispatch({ type: "makeUsual", id: setup.id });
                refocus.current = "head";
                props.onDone(`${setup.name} is now your usual setup. The week's schedule follows it.`);
              }}
            >
              Make usual
            </button>
          ) : null}
          <button ref={deleteBtn} type="button" className="btn small danger" onClick={() => setConfirm(true)}>Delete</button>
        </div>
      )}
    </section>
  );
}

function BodyweightItem(props: { core: Core; onDone: (note: string) => void }): React.ReactElement {
  const { dispatch } = useStore();
  const usual = props.core.setups.usual === BODYWEIGHT_ID;
  const head = useRef<HTMLHeadingElement>(null);
  return (
    <section className="card stack setup-item" aria-labelledby="setup-bodyweight">
      <div className="spread">
        <h2 className="h3 setup-name" id="setup-bodyweight" ref={head} tabIndex={-1}>{BODYWEIGHT_NAME}</h2>
        <SetupTag core={props.core} id={BODYWEIGHT_ID} />
      </div>
      <p className="meta small">Always here, with nothing to set up: exercises that need no equipment at all.</p>
      {!usual ? (
        <div className="row-wrap setup-actions">
          <button
            type="button"
            className="btn small"
            onClick={() => {
              dispatch({ type: "makeUsual", id: BODYWEIGHT_ID });
              head.current?.focus({ preventScroll: true });
              props.onDone(`${BODYWEIGHT_NAME} is now your usual setup. The week's schedule follows it.`);
            }}
          >
            Make usual
          </button>
        </div>
      ) : null}
    </section>
  );
}

/** A setup's name and equipment, new or saved. Cancel leaves everything as it was. */
function SetupEditor(props: {
  core: Core;
  view: Extract<View, { kind: "edit" }>;
  heading: React.RefObject<HTMLHeadingElement>;
  onBack: () => void;
  onCancel: () => void;
  onSave: (name: string, equipment: Equipment) => void;
}): React.ReactElement {
  const { core, view } = props;
  const isNew = view.id === null;
  // The editor's gym layout (bars, cables and machines open) for gym equipment; the name never decides it.
  const place: Location = view.prefilled || hasGymEquipment(view.equipment) ? "gym" : "home";
  const [name, setName] = useState(view.name);
  const [draft, setDraft] = useState<EqDraft>(() => eqDraftFrom(view.equipment, core.profile.units, place));
  const equipment = toEquipment(draft);
  const problem = nameProblem(core, name, view.id) ?? (equipment ? null : "Finish the dumbbells: pick their weights, or choose None.");

  return (
    <div className="stack-lg">
      <header className="stack" style={{ gap: 6 }}>
        <button type="button" className="link-btn" onClick={props.onBack}>
          <Icon name="chevronLeft" size={14} /> Back
        </button>
        <p className="eyebrow">{isNew ? "New setup" : "Edit setup"}</p>
        <h1 className="title setup-name" tabIndex={-1} ref={props.heading}>{isNew ? "Add a setup" : view.name}</h1>
      </header>
      <div className="field">
        <label htmlFor="setup-name">Name</label>
        <input id="setup-name" className="input" value={name} maxLength={MAX_NAME} autoComplete="off" placeholder="Hotel gym" onChange={(e) => setName(e.target.value)} />
        <span className="meta small">Just for telling setups apart. Exercises come from the equipment ticked below.</span>
      </div>
      <EquipmentEditor place={place} prefilled={view.prefilled} draft={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
      {problem ? <p className="meta small" role="status">{problem}</p> : null}
      <div className="footer-actions">
        <button type="button" className="btn" onClick={props.onCancel}>
          Cancel
        </button>
        <button type="button" className="btn primary" disabled={!!problem} onClick={() => equipment && props.onSave(cleanName(name), equipment)}>
          {isNew ? "Save setup" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
