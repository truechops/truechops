import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/router";
import Tooltip from "@mui/material/Tooltip";
import MenuItem from "@mui/material/MenuItem";
import { FiShuffle, FiMoreHorizontal, FiLayers, FiSearch, FiHelpCircle } from "react-icons/fi";
import { scoreActions, getScoreVoices } from "../../store/score";
import { DEFAULT_MUTATION_NUM_REPEATS } from "../../consts/score";
import { canAdjustMeasure, getVariationInstruments, getVariationOptions, instrumentLabel } from "../../services/rhythm-variations";
import { openNotationSearch } from "../../services/notation-search";
import useRepeat from "./buttons/mutate/common/repeat-hook";
import MeasureVariationDialog from "./MeasureVariationDialog";
import Dialog from "../ui/Dialog";
import { ToolMenu } from "./EditTools";
import styles from "./score-workspace.module.css";

const TYPES = [["swap", "Swap"], ["shuffle", "Shuffle"], ["reverse", "Reverse"]];
const GRIDS = [["4", "Quarter"], ["8", "8th"], ["16", "16th"], ["32", "32nd"]];
const symbols = { stickings: "R L", accents: ">", diddles: "≋", cheese: "♬", flams: "♮", kick: "K", snare: "S", hiHat: "HH", ride: "R", hiHatFoot: "HF", tom1: "T1", tom2: "T2", tom3: "T3", tom4: "T4" };
const HELP = "Generate repeats the whole score, then swaps, shuffles or reverses its notes on the chosen grid. "
  + "The variation buttons reshuffle one kind of marking (or drum voice) without changing the rhythm.";

// Settings for Generate, which mutates the whole score.
export function MutateSettings() {
  const dispatch = useDispatch();
  const mutation = useSelector((state) => state.score.present.mutations[0]);
  const voices = useSelector((state) => getScoreVoices(state.score.present));
  const numParts = useSelector((state) => Object.values(state.score.present.score.parts).filter((part) => part != null).length);
  const { numRepeats, setNumRepeats, repeatOptions } = useRepeat(DEFAULT_MUTATION_NUM_REPEATS);
  const [onePartOnly, setOnePartOnly] = useState(false);
  const repeats = Math.min(Number(numRepeats), repeatOptions.length) || 1;
  const types = TYPES.some(([value]) => value === mutation.type) ? TYPES : [...TYPES, [mutation.type, mutation.type]];
  const fields = [
    ["Type", mutation.type, types, scoreActions.updateMutateType],
    ["Context", mutation.context, [["All", "All"], ...Object.entries(voices)], scoreActions.updateMutateContext],
    ["Grid", String(mutation.grid), GRIDS, scoreActions.updateMutateGrid],
  ];

  return <div className={styles.mutateSettings}>
    {fields.map(([label, value, options, action]) => <label key={label} className={styles.field}>{label}
      <select value={value} onChange={(event) => dispatch(action(event.target.value))}>
        {options.map(([option, name]) => <option key={option} value={option}>{name}</option>)}
      </select>
    </label>)}
    <label className={styles.field}>Repeat
      <select value={repeats} onChange={(event) => setNumRepeats(Number(event.target.value))}>
        {repeatOptions.map((count) => <option key={count} value={count}>{count}</option>)}
      </select>
    </label>
    <button type="button" className={styles.generate} onClick={() => numParts > 1 ? setOnePartOnly(true) : dispatch(scoreActions.mutateNotes(repeats))}>
      <FiShuffle aria-hidden="true" />Generate
    </button>
    <Dialog onOk={() => setOnePartOnly(false)} message="Mutate can only be used with one part." isOpen={onePartOnly} />
  </div>;
}

// Reshuffles one marking (or drum voice) in the selected measure or every measure.
export function VariationTools({ notice, setNotice }) {
  const dispatch = useDispatch(), router = useRouter();
  const score = useSelector((state) => state.score.present.score);
  const index = useSelector((state) => state.score.present.selectedNoteIndex?.measureIndex);
  const selectedPartIndex = useSelector((state) => state.score.present.selectedPartIndex);
  const [applyTo, setApplyTo] = useState("selected"), [requested, setRequested] = useState(null);
  const [menu, setMenu] = useState(null), [browse, setBrowse] = useState(null);
  const measure = score.measures[index];
  const instruments = getVariationInstruments(score);
  const selectedInstrument = measure?.parts[selectedPartIndex]?.instrument;
  const instrument = instruments.includes(requested) ? requested : instruments.includes(selectedInstrument) ? selectedInstrument : instruments[0];
  const options = getVariationOptions(instrument);
  const indexes = useMemo(() => applyTo === "all" ? score.measures.map((_, i) => i) : measure ? [index] : [], [applyTo, score, measure, index]);
  const available = useMemo(() => new Set(options.filter(([category]) =>
    indexes.some((i) => canAdjustMeasure(score.measures[i], category, instrument))).map(([category]) => category)), [options, indexes, score, instrument]);
  const closeMenu = () => setMenu(null);

  function vary(category, name) {
    dispatch(scoreActions.adjustMeasures({ category, instrument, indexes }));
    setNotice(`${name} varied in ${applyTo === "all" ? "every measure" : `measure ${index + 1}`}`);
  }

  return <div className={styles.tools}>
    <div className={styles.groupItems} role="group" aria-label="Vary the measure">
      {options.map(([category, name]) => <button key={category} type="button" className={styles.variation} disabled={!available.has(category)}
        title={available.has(category) ? `Vary ${name.toLowerCase()}` : indexes.length ? `No ${name.toLowerCase()} to vary here` : "Select a measure first"}
        aria-label={name} onMouseDown={(event) => event.preventDefault()} onClick={() => vary(category, name)}>
        <span className={styles.badge} data-category={category} aria-hidden="true">{symbols[category]}</span>{name}
      </button>)}
      <button type="button" className={styles.variation} aria-haspopup="menu" aria-expanded={Boolean(menu)} onClick={(event) => setMenu({ anchor: event.currentTarget, type: "more" })}>
        <span className={styles.badge} style={{ background: "#f5f4f7", color: "#4d4753" }} aria-hidden="true"><FiMoreHorizontal /></span>More
      </button>
    </div>
    <span className={styles.divider} />
    <label className={`${styles.field} ${styles.inlineField}`}>Apply to
      <select value={applyTo} onChange={(event) => setApplyTo(event.target.value)}>
        <option value="selected">{measure ? `Measure ${index + 1}` : "Selected measure"}</option>
        <option value="all">All measures</option>
      </select>
    </label>
    {instruments.length > 1 && <label className={`${styles.field} ${styles.inlineField}`}>
      <select aria-label="Variation part" title="Part to vary" value={instrument} onChange={(event) => setRequested(event.target.value)}>
        {instruments.map((value) => <option key={value} value={value}>{instrumentLabel(value)}</option>)}
      </select>
    </label>}
    <Tooltip title={HELP} describeChild arrow><button type="button" className={styles.help} aria-label="How mutate works"><FiHelpCircle /></button></Tooltip>
    <span className={styles.notice} role="status">{notice}</span>

    <ToolMenu menu={menu} type="more" onClose={closeMenu} label="More variations">
      <MenuItem disabled={!measure} onClick={() => { closeMenu(); setBrowse({ score, measure, index, instrument }); }}><FiLayers />Browse variations</MenuItem>
      <MenuItem disabled={!measure} onClick={async () => { closeMenu(); try { await openNotationSearch(router, { ...score, measures: [measure] }, `Measure ${index + 1}`); } catch { setNotice("Couldn't open notation search. Please try again."); } }}><FiSearch />Find matching rhythms</MenuItem>
    </ToolMenu>
    {browse && <MeasureVariationDialog source={browse} onClose={() => setBrowse(null)} />}
  </div>;
}
