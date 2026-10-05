import { FaArrowDown, FaArrowUp, FaPlus, FaTrash } from "react-icons/fa";
import { ORNAMENT_OPTIONS, SUBDIVISION_OPTIONS, TUPLET_TYPE_OPTIONS } from "./book-data";
import {
  getNestedStageCounts, getNestedTupletVariants, getSpanPrimaryRhythms, nestedTupletLabel, normalizeRhythmPool, rhythmOrnamentKey,
} from "../../lib/book-structure";
import { NESTED_TUPLET_STAGES, RANDOM_ORNAMENTS } from "../../lib/book-curriculum";
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
const DEFAULT_RANDOM_ORNAMENTS = RANDOM_ORNAMENTS;

// Every ornament a random set can produce, in display order.
function randomOrnamentIds(value) {
  return ORNAMENT_OPTIONS.map((option) => option.id)
    .filter((id) => (value.always || []).includes(id) || value.from.includes(id));
}

// Ornaments on every exercise, plus min-max more chosen at random.
function RandomOrnamentFields({ value, onChange, label = "" }) {
  const always = value.always || [];
  const update = (changes) => onChange({ ...value, ...changes });
  return (
    <div className={styles.randomOrnamentFields}>
      <span className={styles.layoutSummary}>On every exercise</span>
      <OrnamentToggles
        label={`${label}Ornaments on every exercise`}
        onToggle={(id) => {
          const next = toggle(always, id);
          update({ always: next, from: value.from.filter((item) => !next.includes(item)) });
        }}
        value={always}
      />
      <span className={styles.layoutSummary}>Plus, chosen at random</span>
      <OrnamentToggles
        label={`${label}Ornaments chosen at random`}
        onToggle={(id) => update({ from: toggle(value.from, id) })}
        options={ORNAMENT_OPTIONS.filter((option) => !always.includes(option.id))}
        value={value.from}
      />
      <label className={styles.topicCount}>
        <span>Each exercise adds</span>
        <input aria-label={`${label}Fewest random ornaments per exercise`} min="1" max={value.from.length}
          onChange={(event) => update({ min: Number(event.target.value) || 1 })} type="number" value={value.min} />
        <span>to</span>
        <input aria-label={`${label}Most random ornaments per exercise`} min={value.min} max={value.from.length}
          onChange={(event) => update({ max: Number(event.target.value) || value.min })} type="number" value={value.max} />
        <span>of them; consecutive exercises never use the same set.</span>
      </label>
    </div>
  );
}

// Page level: ornaments chosen at random for each exercise.
function RandomOrnamentsEditor({ value, onChange }) {
  return (
    <div className={styles.fieldGroup}>
      <span>Ornaments, chosen at random for each exercise</span>
      <RandomOrnamentFields
        onChange={(next) => onChange({ randomOrnaments: next, ornaments: randomOrnamentIds(next) })}
        value={value}
      />
      <div className={styles.topicFooter}>
        <button className={styles.button} onClick={() => onChange({ randomOrnaments: null })} type="button">
          Use one set for the whole page
        </button>
      </div>
    </div>
  );
}

export function OrnamentTopicsEditor({ segments, ornaments, randomOrnaments, exerciseCount, onChange }) {
  if (randomOrnaments) return <RandomOrnamentsEditor onChange={onChange} value={randomOrnaments} />;
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
        <div className={styles.topicFooter}>
          <button
            className={styles.button}
            onClick={() => onChange({ ornamentSegments: [{ title: "Topic 1", count: exerciseCount, ornaments }] })}
            type="button"
          >
            Change ornaments through the page
          </button>
          <button
            className={styles.button}
            onClick={() => onChange({ randomOrnaments: DEFAULT_RANDOM_ORNAMENTS, ornaments: randomOrnamentIds(DEFAULT_RANDOM_ORNAMENTS) })}
            type="button"
          >
            Choose ornaments at random per exercise
          </button>
        </div>
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

function evenNestedPlan(variants, exerciseCount) {
  const base = Math.max(1, Math.floor(exerciseCount / variants.length));
  const extra = Math.max(0, exerciseCount - base * variants.length);
  return variants.map((variant, index) => ({ ...variant, count: base + (index < extra ? 1 : 0) }));
}

const DENSITY_CHOICES = [
  { id: "every", label: "Every note", updates: { playEveryNote: true, fullPrimaryGroupShare: null, playedShare: null } },
  { id: "sparse", label: "Sparse", updates: { playEveryNote: false, fullPrimaryGroupShare: null, playedShare: null } },
  {
    id: "sparse-rests",
    label: "Sparse: 50–75% of notes, a rest in every primary group",
    updates: { playEveryNote: false, fullPrimaryGroupShare: 0, playedShare: [0.5, 0.75] },
  },
];

function stageDensity(stage) {
  if (stage.playEveryNote) return "every";
  return stage.fullPrimaryGroupShare === 0 ? "sparse-rests" : "sparse";
}

// The steps every nested tuplet goes through, each with its own density and
// ornaments (on primary and secondary notes).
function NestedStagesEditor({ stages, exampleCount, onChange }) {
  if (!stages) {
    return (
      <div className={styles.topicFooter}>
        <button className={styles.button} onClick={() => onChange(NESTED_TUPLET_STAGES)} type="button">
          Step each nested tuplet through density and ornaments
        </button>
      </div>
    );
  }
  const update = (index, updates) => onChange(stages.map((stage, i) => (i === index ? { ...stage, ...updates } : stage)));
  const move = (index, direction) => {
    const next = [...stages];
    const [stage] = next.splice(index, 1);
    next.splice(index + direction, 0, stage);
    onChange(next);
  };
  const counts = getNestedStageCounts(exampleCount, stages.length);

  return (
    <>
      <span>Steps for each nested tuplet</span>
      {stages.map((stage, index) => (
        <div className={styles.topicRow} key={index}>
          <input
            aria-label={`Step ${index + 1} title`}
            onChange={(event) => update(index, { title: event.target.value })}
            value={stage.title || ""}
          />
          <div className={styles.topicActions}>
            <button className={styles.button} disabled={index === 0} onClick={() => move(index, -1)} title="Move earlier" type="button"><FaArrowUp /></button>
            <button className={styles.button} disabled={index === stages.length - 1} onClick={() => move(index, 1)} title="Move later" type="button"><FaArrowDown /></button>
            <button className={`${styles.button} ${styles.danger}`} disabled={stages.length === 1} onClick={() => onChange(stages.filter((_, i) => i !== index))} title="Remove step" type="button"><FaTrash /></button>
          </div>
          <div className={styles.stageOrnaments}>
            <select
              aria-label={`Step ${index + 1} density`}
              onChange={(event) => update(index, DENSITY_CHOICES.find((choice) => choice.id === event.target.value).updates)}
              value={stageDensity(stage)}
            >
              {DENSITY_CHOICES.map((choice) => <option key={choice.id} value={choice.id}>{choice.label}</option>)}
            </select>
            <label className={styles.toggleField}>
              <input
                checked={Boolean(stage.randomOrnaments)}
                onChange={() => update(index, stage.randomOrnaments
                  ? { randomOrnaments: null }
                  : { randomOrnaments: DEFAULT_RANDOM_ORNAMENTS, ornaments: randomOrnamentIds(DEFAULT_RANDOM_ORNAMENTS) })}
                type="checkbox"
              />
              <span>Random ornaments</span>
            </label>
            {stage.randomOrnaments ? (
              <RandomOrnamentFields
                label={`Step ${index + 1}: `}
                onChange={(randomOrnaments) => update(index, { randomOrnaments, ornaments: randomOrnamentIds(randomOrnaments) })}
                value={stage.randomOrnaments}
              />
            ) : (
              <OrnamentToggles
                label={`Step ${index + 1} ornaments`}
                onToggle={(id) => update(index, { ornaments: toggle(stage.ornaments || [], id) })}
                value={stage.ornaments || []}
              />
            )}
          </div>
        </div>
      ))}
      <div className={styles.topicFooter}>
        <button
          className={styles.button}
          onClick={() => onChange([...stages, { title: `Step ${stages.length + 1}`, playEveryNote: true, ornaments: [...(stages.at(-1)?.ornaments || [])] }])}
          type="button"
        >
          <FaPlus /> Add step
        </button>
        <button className={styles.button} onClick={() => onChange(null)} type="button">
          Use the page&apos;s ornaments and density
        </button>
      </div>
      <p className={styles.layoutSummary}>
        Each nested tuplet&apos;s exercises run through these steps in order
        {exampleCount ? ` (${exampleCount} exercises: ${counts.join(", ")} per step; extras go to the later steps)` : ""}.
        Steps set the density and the ornaments on every note, in place of the page&apos;s settings.
        {counts.some((count) => count === 0) && <span className={styles.planWarning}> Some nested tuplets have fewer exercises than steps, so they skip the first steps.</span>}
      </p>
    </>
  );
}

// Subsection level: a smaller tuplet nested inside the primary tuplet, one
// variant per run of exercises (e.g. 3, 5, 7, 9 over two triplet notes, then 2
// and 4 over three, ...), each stepping through the stages. Needs a primary
// rhythm written as a tuplet.
export function NestedTupletPlanEditor({ plan, stages, primaryRhythms, rhythmSpan, exerciseCount, onChange }) {
  const host = getSpanPrimaryRhythms(normalizeRhythmPool(primaryRhythms, false), rhythmSpan).tuplets[0];
  const variants = host ? getNestedTupletVariants(host) : [];
  if (!variants.length) {
    if (!plan) return null;
    return (
      <div className={styles.fieldGroup}>
        <span>Nested tuplets</span>
        <p className={`${styles.layoutSummary} ${styles.planWarning}`}>This section&apos;s primary rhythm is not a tuplet, so nothing can be nested.</p>
        <button className={styles.button} onClick={() => onChange({ nestedTupletPlan: null, nestedTupletStages: null })} type="button">Turn off nested tuplets</button>
      </div>
    );
  }
  const hostName = `${host.actual}:${host.normal}`;
  if (!plan) {
    return (
      <div className={styles.fieldGroup}>
        <span>Nested tuplets</span>
        <p className={styles.layoutSummary}>No nesting. The {hostName} primary tuplet can hold {variants.length} nested tuplets.</p>
        <button
          className={styles.button}
          onClick={() => onChange({ nestedTupletPlan: evenNestedPlan(variants, exerciseCount), nestedTupletStages: NESTED_TUPLET_STAGES })}
          type="button"
        >
          Nest tuplets in the primary tuplet
        </button>
      </div>
    );
  }

  const key = (variant) => `${variant.actual}:${variant.hostNotes}`;
  const total = plan.reduce((sum, variant) => sum + variant.count, 0);
  const setPlan = (nestedTupletPlan) => onChange({ nestedTupletPlan });
  const update = (index, updates) => setPlan(plan.map((variant, i) => (i === index ? { ...variant, ...updates } : variant)));
  const move = (index, direction) => {
    const next = [...plan];
    const [variant] = next.splice(index, 1);
    next.splice(index + direction, 0, variant);
    setPlan(next);
  };
  let start = 1;

  return (
    <div className={styles.fieldGroup}>
      <span>Nested tuplets, in order</span>
      {plan.map((variant, index) => {
        const first = start;
        start += variant.count;
        const known = variants.some((candidate) => key(candidate) === key(variant));
        return (
          <div className={styles.topicRow} key={index}>
            <select
              aria-label={`Nested tuplet ${index + 1}`}
              onChange={(event) => {
                const [actual, hostNotes] = event.target.value.split(":").map(Number);
                update(index, { actual, hostNotes });
              }}
              value={key(variant)}
            >
              {!known && <option value={key(variant)}>{variant.actual} over {variant.hostNotes} notes (not available)</option>}
              {variants.map((candidate) => (
                <option key={key(candidate)} value={key(candidate)}>{nestedTupletLabel(candidate, host)}</option>
              ))}
            </select>
            <label className={styles.topicCount}>
              <input
                aria-label={`Nested tuplet ${index + 1} exercises`}
                min="1"
                onChange={(event) => update(index, { count: Math.max(1, Number.parseInt(event.target.value, 10) || 1) })}
                type="number"
                value={variant.count}
              />
              <span>{first > exerciseCount ? "unused" : `ex. ${first}${variant.count > 1 ? `–${Math.min(exerciseCount, first + variant.count - 1)}` : ""}`}</span>
            </label>
            <div className={styles.topicActions}>
              <button className={styles.button} disabled={index === 0} onClick={() => move(index, -1)} title="Move earlier" type="button"><FaArrowUp /></button>
              <button className={styles.button} disabled={index === plan.length - 1} onClick={() => move(index, 1)} title="Move later" type="button"><FaArrowDown /></button>
              <button className={`${styles.button} ${styles.danger}`} disabled={plan.length === 1} onClick={() => setPlan(plan.filter((_, i) => i !== index))} title="Remove nested tuplet" type="button"><FaTrash /></button>
            </div>
          </div>
        );
      })}
      <div className={styles.topicFooter}>
        <button
          className={styles.button}
          onClick={() => setPlan([...plan, { ...(variants.find((candidate) => !plan.some((variant) => key(variant) === key(candidate))) || variants[0]), count: stages?.length || 1 }])}
          type="button"
        >
          <FaPlus /> Add nested tuplet
        </button>
        <button className={styles.button} onClick={() => setPlan(evenNestedPlan(variants, exerciseCount))} type="button">
          Spread all {variants.length} evenly
        </button>
        <button className={styles.button} onClick={() => onChange({ nestedTupletPlan: null, nestedTupletStages: null })} type="button">
          Turn off nested tuplets
        </button>
      </div>
      <p className={`${styles.layoutSummary} ${total !== exerciseCount ? styles.planWarning : ""}`}>
        Each exercise nests its tuplet inside one {hostName} primary group. {total} of {exerciseCount} exercises assigned.
        {total < exerciseCount && " The last nested tuplet continues to the end."}
        {total > exerciseCount && " Nested tuplets past the last exercise are not used."}
      </p>
      <NestedStagesEditor
        exampleCount={plan[0].count}
        onChange={(nestedTupletStages) => onChange({ nestedTupletStages })}
        stages={stages}
      />
    </div>
  );
}

// Page level: the printed row where each secondary rhythm joins the pool.
export function SecondaryRowsEditor({ rows, phases, exerciseJoins, pool, rowCount, measuresPerLine, onChange }) {
  const rhythms = poolRhythms(pool);
  if (!rhythms.length) return null;
  if (phases) {
    // Passes repeat a row plan (e.g. easy, medium, hard basic notes); shown here, set in the curriculum.
    let start = 1;
    return (
      <div className={styles.fieldGroup}>
        <span>Secondary rhythms by pass</span>
        <table className={styles.planTable}>
          <thead><tr><th scope="col">Pass</th><th scope="col">Rows</th><th scope="col">From its first row</th><th scope="col">Joins later in the pass</th></tr></thead>
          <tbody>
            {phases.map((phase) => {
              const first = start;
              start += phase.rows;
              const label = (keys) => rhythms.filter((rhythm) => keys.includes(rhythmOrnamentKey(rhythm))).map(rhythmLabel).join(", ") || "None";
              const entries = Object.entries(phase.rhythmRows);
              return (
                <tr key={first}>
                  <td>{phase.title || `Pass ${first}`}</td>
                  <td>{first}–{first + phase.rows - 1}</td>
                  <td>{label(entries.filter(([, row]) => row === 1).map(([key]) => key))}</td>
                  <td>{label(entries.filter(([, row]) => row > 1).map(([key]) => key))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className={styles.layoutSummary}>Each pass starts over: rhythms join at their row within the pass and stay until it ends.</p>
        {exerciseJoins && (
          <table className={styles.planTable}>
            <thead><tr><th scope="col">Joins at exercise</th><th scope="col">Groupings</th></tr></thead>
            <tbody>
              {[...new Set(Object.values(exerciseJoins))].sort((left, right) => left - right).map((exercise) => (
                <tr key={exercise}>
                  <td>{exercise}</td>
                  <td>{rhythms.filter((rhythm) => exerciseJoins[rhythmOrnamentKey(rhythm)] === exercise).map(rhythmLabel).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }
  if (!rows) {
    return (
      <div className={styles.fieldGroup}>
        <span>Secondary rhythms by row</span>
        <p className={styles.layoutSummary}>Every exercise may use any secondary rhythm.</p>
        <button
          className={styles.button}
          onClick={() => onChange(Object.fromEntries(rhythms.map((rhythm) => [rhythmOrnamentKey(rhythm), 1])))}
          type="button"
        >
          Add secondary rhythms row by row
        </button>
      </div>
    );
  }
  const setRow = (rhythm, value) => {
    const next = { ...rows };
    if (value === "never") delete next[rhythmOrnamentKey(rhythm)];
    else next[rhythmOrnamentKey(rhythm)] = Number(value);
    onChange(next);
  };
  const exercises = (row) => `${(row - 1) * measuresPerLine + 1}`;

  return (
    <div className={styles.fieldGroup}>
      <span>Secondary rhythms by row</span>
      <table className={styles.planTable}>
        <thead>
          <tr><th scope="col">Secondary rhythm</th><th scope="col">Joins at</th></tr>
        </thead>
        <tbody>
          {rhythms.map((rhythm) => {
            const row = rows[rhythmOrnamentKey(rhythm)];
            return (
              <tr key={rhythmOrnamentKey(rhythm)}>
                <th scope="row">{rhythmLabel(rhythm)}</th>
                <td>
                  <select
                    aria-label={`Row where ${rhythmLabel(rhythm)} joins`}
                    onChange={(event) => setRow(rhythm, event.target.value)}
                    value={row || "never"}
                  >
                    {Array.from({ length: rowCount }, (_, index) => index + 1).map((option) => (
                      <option key={option} value={option}>Row {option} (exercise {exercises(option)})</option>
                    ))}
                    <option value="never">Never</option>
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className={styles.layoutSummary}>Each rhythm stays available on every row after it joins.</p>
      <button className={styles.button} onClick={() => onChange(null)} type="button">
        Allow every secondary rhythm on every row
      </button>
    </div>
  );
}

// Read-only overview: which exercises, rows, ornaments, and secondary rhythms each topic covers.
export function PagePlanSummary({ segments, ornaments, randomOrnaments, nestedStages, rows: rhythmRows, pool, exerciseCount, measuresPerLine, playEveryNote }) {
  const rhythms = poolRhythms(pool);
  const ornamentNames = (list) => ORNAMENT_OPTIONS.filter((option) => list.includes(option.id))
    .map((option) => option.label).join(", ") || "None";
  const row = (exercise) => Math.ceil(exercise / measuresPerLine);
  const joinRow = (rhythm) => rhythmRows ? rhythmRows[rhythmOrnamentKey(rhythm)] : 1;
  const secondaryFor = (firstRow, lastRow) => {
    if (!rhythms.length) return "None";
    const atStart = rhythms.filter((rhythm) => joinRow(rhythm) <= firstRow).map(rhythmLabel);
    const joining = rhythms.filter((rhythm) => joinRow(rhythm) > firstRow && joinRow(rhythm) <= lastRow)
      .map((rhythm) => `+ ${rhythmLabel(rhythm)} from row ${joinRow(rhythm)}`);
    return [atStart.join(", ") || "None", ...joining].join("; ");
  };
  const plan = [];
  let start = 1;
  const fallback = nestedStages
    ? { title: `Nested tuplet steps: ${nestedStages.map((stage) => stage.title).join(" → ")}`, count: exerciseCount, ornaments: [...new Set(nestedStages.flatMap((stage) => stage.ornaments))] }
    : randomOrnaments
      ? {
        title: `${randomOrnaments.always?.length ? `${ornamentNames(randomOrnaments.always)} + ` : ""}${randomOrnaments.min}–${randomOrnaments.max} random per exercise`,
        count: exerciseCount,
        ornaments: randomOrnamentIds(randomOrnaments),
      }
      : { title: "All exercises", count: exerciseCount, ornaments };
  for (const [index, segment] of (randomOrnaments || nestedStages ? [fallback] : segments || [fallback]).entries()) {
    if (start > exerciseCount) break;
    const isLast = index === (segments?.length || 1) - 1;
    const end = Math.min(exerciseCount, isLast ? exerciseCount : start + segment.count - 1);
    plan.push({ start, end, segment, secondary: secondaryFor(row(start), row(end)) });
    start = end + 1;
  }

  return (
    <div className={styles.fieldGroup}>
      <span>Page plan</span>
      <table className={styles.planTable}>
        <thead>
          <tr><th scope="col">Exercises</th><th scope="col">Rows</th><th scope="col">Topic</th><th scope="col">Primary ornaments</th><th scope="col">Secondary rhythms</th></tr>
        </thead>
        <tbody>
          {plan.map(({ start: first, end, segment, secondary }) => (
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
        {nestedStages ? "Each nested tuplet step sets its own density." : playEveryNote ? "Every note is played (no rests)." : "Sparse: notes and rests are mixed."}
      </p>
    </div>
  );
}
