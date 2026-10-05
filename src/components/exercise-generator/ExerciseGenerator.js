import { useCallback, useEffect, useMemo, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import {
  DEFAULT_EXERCISE_CONFIG,
  MAX_GENERATED_MEASURES,
  ORNAMENT_IDS,
  SECONDARY_CHOICES,
  SPAN_CHOICES,
  SUBDIVISION_CHOICES,
  getConfigNestedVariants,
  normalizeExerciseConfig,
} from "../../lib/exercise-config";
import { rhythmOrnamentKey } from "../../lib/book-structure";
import { deleteConfig, generateMeasures, loadSavedConfigs, saveConfig } from "./exercise-api";

// Generates book-style exercises from a configuration: the page's own settings
// or one the user saved. Used on book QR pages (build a score) and in the
// composer (add one measure at a time).

const ORNAMENT_LABELS = { stickings: "Stickings", accents: "Accents", flams: "Flams", diddles: "Diddles", cheese: "Cheese" };
const TUPLET_NAMES = { 3: "Triplets", 5: "Quintuplets", 6: "Sextuplets", 7: "Septuplets", 9: "9s" };
const SUBDIVISION_LABELS = { eighths: "Eighths", sixteenths: "Sixteenths", thirtyseconds: "32nds" };

const styles = {
  panel: { display: "flex", flexDirection: "column", gap: 16, fontFamily: "Arial, sans-serif", color: "#111" },
  section: { display: "flex", flexDirection: "column", gap: 8 },
  heading: { fontSize: 13, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: "#555", margin: 0 },
  row: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" },
  field: { display: "flex", flexDirection: "column", gap: 4, fontSize: 13 },
  rowField: { flex: "1 1 160px", minWidth: 160 },
  input: { border: "1px solid #bbb", borderRadius: 6, fontSize: 15, padding: "8px 10px", background: "#fff" },
  chip: { border: "1px solid #bbb", borderRadius: 999, cursor: "pointer", fontSize: 14, padding: "6px 12px", background: "#fff", color: "#111" },
  chipOn: { background: "#1e5ea8", borderColor: "#1e5ea8", color: "#fff" },
  configList: { display: "flex", flexDirection: "column", gap: 6 },
  configItem: { border: "1px solid #ddd", borderRadius: 8, cursor: "pointer", padding: "10px 12px", textAlign: "left", background: "#fff", fontSize: 15 },
  configItemOn: { border: "2px solid #1e5ea8", background: "#f1f7ff", padding: "9px 11px" },
  configMeta: { color: "#666", display: "block", fontSize: 12, marginTop: 2 },
  button: { border: "1px solid #111", borderRadius: 6, background: "#111", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700, padding: "10px 14px" },
  secondaryButton: { background: "#fff", color: "#111" },
  disabled: { cursor: "default", opacity: 0.45 },
  note: { color: "#666", fontSize: 13, margin: 0 },
  error: { color: "#8a1f1f", fontSize: 14, margin: 0 },
};

function secondaryLabel(rhythm) {
  return typeof rhythm === "string"
    ? SUBDIVISION_LABELS[rhythm] || rhythm
    : `${TUPLET_NAMES[rhythm.actual] || `${rhythm.actual}s`} (${rhythm.actual}:${rhythm.normal})`;
}

function describeConfig(config) {
  const subdivision = SUBDIVISION_CHOICES.find((choice) => choice.id === config.subdivision)?.label || config.subdivision;
  const span = SPAN_CHOICES.find((choice) => choice.count === config.rhythmSpan.count && choice.unit === config.rhythmSpan.unit);
  const ornaments = config.ornaments.map((id) => ORNAMENT_LABELS[id]).join(", ") || "No ornaments";
  const nested = (config.nestedTuplets === "cycle" ? " · nested tuplets in turn"
    : config.nestedTuplets ? ` · nested ${config.nestedTuplets.actual} over ${config.nestedTuplets.hostNotes}` : "") +
    (config.nestedTuplets && config.nestedSteps ? " in four steps" : "");
  return `${subdivision}${span && span.id !== "1/4" ? ` ${span.label.toLowerCase()}` : ""}${nested} · ${config.playEveryNote ? "every note" : "sparse"} · ${ornaments}`;
}

function Chip({ on, onClick, children }) {
  return (
    <button aria-pressed={on} onClick={onClick} style={{ ...styles.chip, ...(on ? styles.chipOn : {}) }} type="button">
      {children}
    </button>
  );
}

// A smaller tuplet nested inside the subdivision: off, every variant in turn,
// or one variant (e.g. 5 notes in the time of 2 of the subdivision's notes),
// optionally stepping each one through the book's four steps.
function NestedTupletField({ value, onChange }) {
  const variants = getConfigNestedVariants(value);
  if (!variants.length) {
    return <p style={styles.note}>Nested tuplets need a tuplet subdivision (not plain eighths, sixteenths, or 32nds).</p>;
  }
  const selected = value.nestedTuplets === "cycle" ? "cycle"
    : value.nestedTuplets ? `${value.nestedTuplets.actual}:${value.nestedTuplets.hostNotes}` : "off";
  return (
    <div style={styles.section}>
      <label style={styles.field}>
        Nested tuplets
        <select
          onChange={(event) => {
            const choice = event.target.value;
            if (choice === "off") onChange({ nestedTuplets: null });
            else if (choice === "cycle") onChange({ nestedTuplets: "cycle" });
            else {
              const [actual, hostNotes] = choice.split(":").map(Number);
              onChange({ nestedTuplets: { actual, hostNotes } });
            }
          }}
          style={styles.input}
          value={selected}
        >
          <option value="off">None</option>
          <option value="cycle">
            Each nested tuplet in turn ({variants.length}, {value.nestedSteps ? "four measures each" : "one per measure"})
          </option>
          {variants.map((variant) => (
            <option key={`${variant.actual}:${variant.hostNotes}`} value={`${variant.actual}:${variant.hostNotes}`}>
              {variant.label}
            </option>
          ))}
        </select>
      </label>
      {value.nestedTuplets && (
        <>
          <button
            aria-pressed={value.nestedSteps}
            onClick={() => onChange({ nestedSteps: !value.nestedSteps })}
            style={{ ...styles.chip, ...(value.nestedSteps ? styles.chipOn : {}), alignSelf: "flex-start" }}
            type="button"
          >
            Steps: every note → accents → sparse with accents → ornaments
          </button>
          <p style={styles.note}>
            {value.nestedSteps
              ? "Each nested tuplet takes four measures, one per step. The steps set the density and ornaments (stickings on every note)."
              : "Every measure uses the density and ornaments below."}
          </p>
        </>
      )}
    </div>
  );
}

export function ExerciseConfigEditor({ value, onChange, topics = [] }) {
  const update = (changes) => onChange(normalizeExerciseConfig({ ...value, ...changes }));
  const secondary = value.secondaryRhythms;
  const hasSecondary = (rhythm) => typeof rhythm === "string"
    ? secondary.subdivisions.includes(rhythm)
    : secondary.tuplets.some((tuplet) => rhythmOrnamentKey(tuplet) === rhythmOrnamentKey(rhythm));
  const toggleSecondary = (rhythm) => update({
    secondaryRhythms: typeof rhythm === "string"
      ? { ...secondary, subdivisions: hasSecondary(rhythm) ? secondary.subdivisions.filter((id) => id !== rhythm) : [...secondary.subdivisions, rhythm] }
      : { ...secondary, tuplets: hasSecondary(rhythm) ? secondary.tuplets.filter((tuplet) => rhythmOrnamentKey(tuplet) !== rhythmOrnamentKey(rhythm)) : [...secondary.tuplets, rhythm] },
  });
  const toggleOrnament = (id) => update({
    ornaments: value.ornaments.includes(id) ? value.ornaments.filter((item) => item !== id) : [...value.ornaments, id],
  });

  return (
    <div style={styles.panel}>
      <label style={styles.field}>
        Name
        <input onChange={(event) => onChange({ ...value, name: event.target.value })} style={styles.input} value={value.name} />
      </label>

      <div style={styles.row}>
        <label style={{ ...styles.field, ...styles.rowField }}>
          Subdivision
          <select onChange={(event) => update({ subdivision: event.target.value })} style={styles.input} value={value.subdivision}>
            {SUBDIVISION_CHOICES.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
          </select>
        </label>
        <label style={{ ...styles.field, ...styles.rowField }}>
          Spread over
          <select
            onChange={(event) => {
              const span = SPAN_CHOICES.find((choice) => choice.id === event.target.value);
              update({ rhythmSpan: { count: span.count, unit: span.unit } });
            }}
            style={styles.input}
            value={`${value.rhythmSpan.count}/${value.rhythmSpan.unit}`}
          >
            {SPAN_CHOICES.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
          </select>
        </label>
      </div>

      <NestedTupletField onChange={update} value={value} />

      <div style={styles.section}>
        <p style={styles.heading}>Density</p>
        <div style={styles.row}>
          <Chip on={value.playEveryNote} onClick={() => update({ playEveryNote: true })}>Every note</Chip>
          <Chip on={!value.playEveryNote} onClick={() => update({ playEveryNote: false })}>Sparse</Chip>
          {!value.playEveryNote && (
            <label style={{ ...styles.field, flex: "0 1 220px", minWidth: 0 }}>
              Fully played groups (%)
              <input
                max="100"
                min="0"
                onChange={(event) => update({ fullPrimaryGroupShare: event.target.value === "" ? null : Number(event.target.value) / 100 })}
                placeholder="Random"
                style={styles.input}
                type="number"
                value={value.fullPrimaryGroupShare == null ? "" : Math.round(value.fullPrimaryGroupShare * 100)}
              />
            </label>
          )}
        </div>
      </div>

      <div style={styles.section}>
        <p style={styles.heading}>Ornaments</p>
        {topics.length > 0 && (
          <label style={styles.field}>
            Use a topic from this page
            <select
              onChange={(event) => {
                const topic = topics[Number(event.target.value)];
                if (topic) update({ ornaments: topic.ornaments });
              }}
              style={styles.input}
              value=""
            >
              <option value="">Choose a topic…</option>
              {topics.map((topic, index) => <option key={topic.title} value={index}>{topic.title}</option>)}
            </select>
          </label>
        )}
        <div style={styles.row}>
          {ORNAMENT_IDS.map((id) => (
            <Chip key={id} on={value.ornaments.includes(id)} onClick={() => toggleOrnament(id)}>{ORNAMENT_LABELS[id]}</Chip>
          ))}
        </div>
      </div>

      <div style={styles.section}>
        <p style={styles.heading}>Secondary rhythms (fill around the subdivision)</p>
        <div style={styles.row}>
          {SECONDARY_CHOICES.map((rhythm) => (
            <Chip key={rhythmOrnamentKey(rhythm)} on={hasSecondary(rhythm)} onClick={() => toggleSecondary(rhythm)}>
              {secondaryLabel(rhythm)}
            </Chip>
          ))}
        </div>
      </div>

      <label style={{ ...styles.field, maxWidth: 140 }}>
        Tempo
        <input max="300" min="30" onChange={(event) => update({ tempo: event.target.value })} style={styles.input} type="number" value={value.tempo} />
      </label>
    </div>
  );
}

function useSavedConfigs() {
  const [state, setState] = useState({ configs: [], signedIn: false, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    loadSavedConfigs()
      .then((result) => !cancelled && setState({ ...result, loading: false, error: null }))
      .catch((error) => !cancelled && setState({ configs: [], signedIn: false, loading: false, error: error.message }));
    return () => { cancelled = true; };
  }, []);

  const save = useCallback(async (config) => {
    const saved = await saveConfig(config, state.signedIn);
    setState((current) => ({ ...current, configs: [saved, ...current.configs.filter((item) => item.id !== saved.id)] }));
    return saved;
  }, [state.signedIn]);

  const remove = useCallback(async (id) => {
    await deleteConfig(id, state.signedIn);
    setState((current) => ({ ...current, configs: current.configs.filter((item) => item.id !== id) }));
  }, [state.signedIn]);

  return { ...state, save, remove };
}

// mode "score": choose a configuration and build a score of 1-16 measures.
// mode "append": add one generated measure at a time (the composer).
export default function ExerciseGenerator({ pageConfig = null, topics = [], mode = "score", compact = false, onMeasures }) {
  const saved = useSavedConfigs();
  const choices = useMemo(() => [
    ...(pageConfig ? [{ key: "page", label: "This page's configuration", config: pageConfig }] : []),
    ...(!pageConfig && !saved.configs.length ? [{ key: "default", label: "Default", config: DEFAULT_EXERCISE_CONFIG }] : []),
    ...saved.configs.map((config) => ({ key: config.id, label: config.name, config, saved: true })),
  ], [pageConfig, saved.configs]);
  const [selectedKey, setSelectedKey] = useState(null);
  const selected = choices.find((choice) => choice.key === selectedKey) || choices[0];
  const [draft, setDraft] = useState(selected?.config || DEFAULT_EXERCISE_CONFIG);
  const [measureCount, setMeasureCount] = useState(4);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  // Measures added one at a time continue the configuration's plan (e.g. the
  // next nested tuplet or step); changing the settings starts it over.
  const [nextMeasure, setNextMeasure] = useState(0);
  const draftKey = JSON.stringify(draft);

  useEffect(() => {
    if (selected) setDraft(selected.config);
  }, [selected?.key, selected?.config]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setNextMeasure(0), [draftKey]);

  const changed = selected && JSON.stringify(normalizeExerciseConfig(selected.config)) !== JSON.stringify(normalizeExerciseConfig(draft));

  const run = async (task) => {
    setBusy(true);
    setMessage(null);
    try {
      await task();
    } catch (error) {
      setMessage({ error: true, text: error.message });
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = (asNew) => run(async () => {
    const rest = { ...draft };
    delete rest.id;
    const result = await saved.save(asNew || !selected?.saved ? rest : { ...rest, id: selected.key });
    setSelectedKey(result.id);
    setMessage({ text: saved.signedIn ? "Configuration saved." : "Configuration saved in this browser. Sign in to keep it on your account." });
  });

  const generate = (count) => run(async () => {
    const start = mode === "append" ? nextMeasure : 0;
    const result = await generateMeasures(draft, count, start);
    if (mode === "append") setNextMeasure(start + count);
    onMeasures(result, draft);
  });

  const editor = (
    <>
      <ExerciseConfigEditor onChange={setDraft} topics={selected?.key === "page" ? topics : []} value={draft} />
      <div style={styles.row}>
        <button disabled={busy} onClick={() => saveDraft(true)} style={{ ...styles.button, ...styles.secondaryButton }} type="button">
          Save as new configuration
        </button>
        {selected?.saved && (
          <button disabled={busy || !changed} onClick={() => saveDraft(false)} style={{ ...styles.button, ...styles.secondaryButton, ...(changed ? {} : styles.disabled) }} type="button">
            Update “{selected.label}”
          </button>
        )}
        {selected?.saved && (
          <button disabled={busy} onClick={() => run(async () => { await saved.remove(selected.key); setSelectedKey(null); })} style={{ ...styles.button, ...styles.secondaryButton }} type="button">
            Delete
          </button>
        )}
        {changed && (
          <button onClick={() => setDraft(selected.config)} style={{ ...styles.button, ...styles.secondaryButton }} type="button">
            Undo changes
          </button>
        )}
      </div>
    </>
  );

  const status = message && <p style={message.error ? styles.error : styles.note}>{message.text}</p>;

  if (compact) {
    return (
      <div style={{ ...styles.row, justifyContent: "center", fontFamily: "Arial, sans-serif" }}>
        <select
          aria-label="Configuration"
          onChange={(event) => setSelectedKey(event.target.value)}
          style={{ ...styles.input, maxWidth: 260 }}
          value={selected?.key || ""}
        >
          {choices.map((choice) => <option key={choice.key} value={choice.key}>{choice.label}</option>)}
        </select>
        <button onClick={() => setEditorOpen(true)} style={{ ...styles.button, ...styles.secondaryButton }} type="button">Edit settings</button>
        <button disabled={busy} onClick={() => generate(1)} style={{ ...styles.button, ...(busy ? styles.disabled : {}) }} type="button">
          {busy ? "Generating…" : "Add measure"}
        </button>
        {status}
        <Dialog fullWidth maxWidth="md" onClose={() => setEditorOpen(false)} open={editorOpen}>
          <DialogTitle>Exercise settings</DialogTitle>
          <DialogContent>
            <div style={{ ...styles.panel, paddingTop: 8 }}>
              <p style={styles.note}>{describeConfig(draft)}</p>
              {editor}
              {status}
              <div style={styles.row}>
                <button onClick={() => setEditorOpen(false)} style={styles.button} type="button">Done</button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div style={styles.panel}>
      <div style={styles.section}>
        <p style={styles.heading}>Configurations</p>
        {saved.loading && <p style={styles.note}>Loading saved configurations…</p>}
        {saved.error && <p style={styles.error}>{saved.error}</p>}
        <div style={styles.configList}>
          {choices.map((choice) => (
            <button
              aria-pressed={choice.key === selected?.key}
              key={choice.key}
              onClick={() => setSelectedKey(choice.key)}
              style={{ ...styles.configItem, ...(choice.key === selected?.key ? styles.configItemOn : {}) }}
              type="button"
            >
              {choice.label}
              <span style={styles.configMeta}>{describeConfig(normalizeExerciseConfig(choice.config))}</span>
            </button>
          ))}
        </div>
        {!saved.loading && !saved.configs.length && (
          <p style={styles.note}>You have no saved configurations yet. Change the settings below and save them to reuse them.</p>
        )}
      </div>

      <div style={styles.section}>
        <p style={styles.heading}>Settings</p>
        {editor}
      </div>

      <div style={styles.section}>
        <p style={styles.heading}>Build a score</p>
        <div style={styles.row}>
          {mode === "score" && (
            <label style={{ ...styles.field, flex: "0 1 160px" }}>
              Measures (1–{MAX_GENERATED_MEASURES})
              <input
                max={MAX_GENERATED_MEASURES}
                min="1"
                onChange={(event) => setMeasureCount(Math.max(1, Math.min(MAX_GENERATED_MEASURES, Number(event.target.value) || 1)))}
                style={styles.input}
                type="number"
                value={measureCount}
              />
            </label>
          )}
          <button disabled={busy} onClick={() => generate(mode === "score" ? measureCount : 1)} style={{ ...styles.button, ...(busy ? styles.disabled : {}) }} type="button">
            {busy ? "Generating…" : mode === "score" ? `Build a ${measureCount}-measure score` : "Add measure"}
          </button>
        </div>
        {status}
      </div>
    </div>
  );
}
