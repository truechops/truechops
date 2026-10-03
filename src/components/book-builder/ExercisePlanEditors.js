import { FaArrowDown, FaArrowUp, FaPlus, FaTrash } from "react-icons/fa";
import { ORNAMENT_OPTIONS, SUBDIVISION_OPTIONS, TUPLET_TYPE_OPTIONS } from "./book-data";
import { rhythmOrnamentKey } from "../../lib/book-structure";
import styles from "./BookBuilder.module.css";

// Editors for a page's exercise plan: ornament topics by exercise, the simpler
// secondary rhythms on the first rows, and per-rhythm secondary ornaments.

const SECONDARY_ORNAMENT_OPTIONS = ORNAMENT_OPTIONS.filter((option) => option.id !== "stickings");
const TUPLET_NAMES = { 3: "Triplets", 5: "Quintuplets", 6: "Sextuplets", 7: "Septuplets", 9: "9s" };

export function rhythmLabel(rhythm) {
  if (typeof rhythm === "string") {
    return SUBDIVISION_OPTIONS.find((option) => option.id === rhythm)?.label || rhythm;
  }
  const type = TUPLET_TYPE_OPTIONS.find((option) => option.type === Number(rhythm.type))?.label.toLowerCase();
  const name = TUPLET_NAMES[rhythm.actual] || `${rhythm.actual}-note groups`;
  return `${name} (${rhythm.actual}:${rhythm.normal} ${type}s)`;
}

function poolRhythms(pool) {
  return [...(pool?.subdivisions || []), ...(pool?.tuplets || [])];
}

function OrnamentToggles({ value, onToggle, options = ORNAMENT_OPTIONS, label }) {
  return (
    <div className={styles.ornamentToggles} role="group" aria-label={label}>
      {options.map((option) => {
        const checked = value.includes(option.id);
        return (
          <label
            className={`${styles.pickerOption} ${checked ? styles.activePickerOption : ""}`}
            key={option.id}
          >
            <input checked={checked} onChange={() => onToggle(option.id)} type="checkbox" />
            <span>{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}

function toggle(list, id) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

// Section level: which ornaments each secondary rhythm may carry.
export function SecondaryOrnamentGrid({ pool, onChange }) {
  const rhythms = poolRhythms(pool);
  if (!rhythms.length) return null;
  const ornamentsFor = (rhythm) => pool.rhythmOrnaments
    ? pool.rhythmOrnaments[rhythmOrnamentKey(rhythm)] || []
    : (pool.ornaments || []).filter((id) => id !== "stickings");
  const update = (rhythm, ornamentId) => onChange({
    ...pool,
    rhythmOrnaments: Object.fromEntries(rhythms.map((candidate) => [
      rhythmOrnamentKey(candidate),
      candidate === rhythm ? toggle(ornamentsFor(candidate), ornamentId) : ornamentsFor(candidate),
    ])),
  });

  return (
    <div className={styles.fieldGroup}>
      <span>Ornaments by rhythm</span>
      <table className={styles.planTable}>
        <thead>
          <tr>
            <th scope="col">Secondary rhythm</th>
            {SECONDARY_ORNAMENT_OPTIONS.map((option) => <th key={option.id} scope="col">{option.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rhythms.map((rhythm) => (
            <tr key={rhythmOrnamentKey(rhythm)}>
              <th scope="row">{rhythmLabel(rhythm)}</th>
              {SECONDARY_ORNAMENT_OPTIONS.map((option) => (
                <td key={option.id}>
                  <input
                    aria-label={`${option.label} on ${rhythmLabel(rhythm)}`}
                    checked={ornamentsFor(rhythm).includes(option.id)}
                    onChange={() => update(rhythm, option.id)}
                    type="checkbox"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.layoutSummary}>
        Secondary ornaments are optional. Stickings are not set here: when an exercise&apos;s topic
        includes stickings, every note gets one.
      </p>
    </div>
  );
}

// Page level: ornament topics that change by exercise.
export function OrnamentTopicsEditor({ segments, ornaments, exerciseCount, onChange }) {
  if (!segments) {
    return (
      <div className={styles.fieldGroup}>
        <span>Primary ornaments</span>
        <OrnamentToggles
          label="Primary ornaments"
          onToggle={(id) => onChange({ ornaments: toggle(ornaments, id) })}
          value={ornaments}
        />
        <p className={styles.layoutSummary}>Every exercise on this page uses these ornaments on its primary rhythms.</p>
        <button
          className={styles.button}
          onClick={() => onChange({ ornamentSegments: [{ title: "Topic 1", count: exerciseCount, ornaments }] })}
          type="button"
        >
          Change ornaments through the page
        </button>
      </div>
    );
  }

  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  const setSegments = (next) => onChange({
    ornamentSegments: next,
    ornaments: [...new Set(next.flatMap((segment) => segment.ornaments))],
  });
  const updateSegment = (index, updates) => setSegments(segments.map((segment, i) =>
    i === index ? { ...segment, ...updates } : segment));
  const move = (index, direction) => {
    const next = [...segments];
    const [segment] = next.splice(index, 1);
    next.splice(index + direction, 0, segment);
    setSegments(next);
  };

  return (
    <div className={styles.fieldGroup}>
      <span>Ornament topics, in order</span>
      {segments.map((segment, index) => (
        <div className={styles.topicRow} key={index}>
          <input
            aria-label={`Topic ${index + 1} title`}
            onChange={(event) => updateSegment(index, { title: event.target.value })}
            value={segment.title || ""}
          />
          <label className={styles.topicCount}>
            <input
              aria-label={`Topic ${index + 1} exercises`}
              min="1"
              onChange={(event) => updateSegment(index, { count: Math.max(1, Number.parseInt(event.target.value, 10) || 1) })}
              type="number"
              value={segment.count}
            />
            <span>exercises</span>
          </label>
          <div className={styles.topicActions}>
            <button className={styles.button} disabled={index === 0} onClick={() => move(index, -1)} title="Move earlier" type="button"><FaArrowUp /></button>
            <button className={styles.button} disabled={index === segments.length - 1} onClick={() => move(index, 1)} title="Move later" type="button"><FaArrowDown /></button>
            <button className={`${styles.button} ${styles.danger}`} disabled={segments.length === 1} onClick={() => setSegments(segments.filter((_, i) => i !== index))} title="Remove topic" type="button"><FaTrash /></button>
          </div>
          <OrnamentToggles
            label={`Topic ${index + 1} ornaments`}
            onToggle={(id) => updateSegment(index, { ornaments: toggle(segment.ornaments, id) })}
            value={segment.ornaments}
          />
        </div>
      ))}
      <div className={styles.topicFooter}>
        <button
          className={styles.button}
          onClick={() => setSegments([...segments, { title: `Topic ${segments.length + 1}`, count: 3, ornaments: [...(segments.at(-1)?.ornaments || [])] }])}
          type="button"
        >
          <FaPlus /> Add topic
        </button>
        <button className={styles.button} onClick={() => onChange({ ornamentSegments: null })} type="button">
          Use one set for the whole page
        </button>
      </div>
      <p className={`${styles.layoutSummary} ${total !== exerciseCount ? styles.planWarning : ""}`}>
        {total} of {exerciseCount} exercises assigned.
        {total < exerciseCount && " The last topic continues to the end of the page."}
        {total > exerciseCount && " Topics past the end of the page are not used."}
      </p>
    </div>
  );
}

// Page level: limit secondary rhythms on the first printed rows.
export function SecondaryIntroEditor({ intro, pool, rowCount, measuresPerLine, onChange }) {
  const rhythms = poolRhythms(pool);
  if (!rhythms.length) return null;
  if (!intro) {
    return (
      <div className={styles.fieldGroup}>
        <span>Secondary rhythms by row</span>
        <p className={styles.layoutSummary}>Every exercise may use any secondary rhythm.</p>
        <button
          className={styles.button}
          onClick={() => onChange({ count: Math.min(5, rowCount), unit: "staffRows", subdivisions: [], tuplets: [] })}
          type="button"
        >
          Start with simpler secondary rhythms
        </button>
      </div>
    );
  }
  const allowed = (rhythm) => typeof rhythm === "string"
    ? intro.subdivisions.includes(rhythm)
    : intro.tuplets.some((tuplet) => rhythmOrnamentKey(tuplet) === rhythmOrnamentKey(rhythm));
  const toggleRhythm = (rhythm) => onChange(typeof rhythm === "string"
    ? { ...intro, subdivisions: toggle(intro.subdivisions, rhythm) }
    : {
        ...intro,
        tuplets: allowed(rhythm)
          ? intro.tuplets.filter((tuplet) => rhythmOrnamentKey(tuplet) !== rhythmOrnamentKey(rhythm))
          : [...intro.tuplets, rhythm],
      });

  return (
    <div className={styles.fieldGroup}>
      <span>Secondary rhythms by row</span>
      <label className={styles.topicCount}>
        <span>First</span>
        <input
          aria-label="Rows that use only the simpler secondary rhythms"
          max={rowCount}
          min="1"
          onChange={(event) => onChange({ ...intro, count: Math.max(1, Number.parseInt(event.target.value, 10) || 1) })}
          type="number"
          value={intro.count}
        />
        <span>rows ({intro.count * measuresPerLine} exercises) use only:</span>
      </label>
      <div className={styles.ornamentToggles} role="group" aria-label="Secondary rhythms on the first rows">
        {rhythms.map((rhythm) => (
          <label
            className={`${styles.pickerOption} ${allowed(rhythm) ? styles.activePickerOption : ""}`}
            key={rhythmOrnamentKey(rhythm)}
          >
            <input checked={allowed(rhythm)} onChange={() => toggleRhythm(rhythm)} type="checkbox" />
            <span>{rhythmLabel(rhythm)}</span>
          </label>
        ))}
      </div>
      <p className={styles.layoutSummary}>Later rows may use every secondary rhythm.</p>
      <button className={styles.button} onClick={() => onChange(null)} type="button">
        Allow every secondary rhythm on every row
      </button>
    </div>
  );
}

// Read-only overview: which exercises and rows each topic covers.
export function PagePlanSummary({ segments, ornaments, intro, pool, exerciseCount, measuresPerLine, playEveryNote }) {
  const introExercises = intro ? intro.count * measuresPerLine : 0;
  const rhythms = poolRhythms(pool);
  const introNames = rhythms.filter((rhythm) => typeof rhythm === "string"
    ? intro?.subdivisions.includes(rhythm)
    : intro?.tuplets.some((tuplet) => rhythmOrnamentKey(tuplet) === rhythmOrnamentKey(rhythm))).map(rhythmLabel);
  const ornamentNames = (list) => ORNAMENT_OPTIONS.filter((option) => list.includes(option.id))
    .map((option) => option.label).join(", ") || "None";
  const rows = [];
  let start = 1;
  for (const [index, segment] of (segments || [{ title: "All exercises", count: exerciseCount, ornaments }]).entries()) {
    const isLast = index === (segments?.length || 1) - 1;
    const end = Math.min(exerciseCount, isLast ? exerciseCount : start + segment.count - 1);
    if (start > exerciseCount) break;
    const secondary = !rhythms.length ? "None"
      : end <= introExercises ? introNames.join(", ") || "None"
      : start > introExercises ? "All"
      : `${introNames.join(", ") || "None"} until exercise ${introExercises}, then all`;
    rows.push({ start, end, segment, secondary });
    start = end + 1;
  }
  const row = (exercise) => Math.ceil(exercise / measuresPerLine);

  return (
    <div className={styles.fieldGroup}>
      <span>Page plan</span>
      <table className={styles.planTable}>
        <thead>
          <tr><th scope="col">Exercises</th><th scope="col">Rows</th><th scope="col">Topic</th><th scope="col">Primary ornaments</th><th scope="col">Secondary rhythms</th></tr>
        </thead>
        <tbody>
          {rows.map(({ start: first, end, segment, secondary }) => (
            <tr key={first}>
              <td>{first === end ? first : `${first}–${end}`}</td>
              <td>{row(first) === row(end) ? row(first) : `${row(first)}–${row(end)}`}</td>
              <td>{segment.title || ""}</td>
              <td>{ornamentNames(segment.ornaments)}</td>
              <td>{secondary}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.layoutSummary}>
        {playEveryNote ? "Every note is played (no rests)." : "Sparse: notes and rests are mixed."}
      </p>
    </div>
  );
}
