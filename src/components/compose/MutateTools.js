import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Tooltip from "@mui/material/Tooltip";
import MenuItem from "@mui/material/MenuItem";
import { FiShuffle, FiMoreHorizontal, FiLayers, FiHelpCircle } from "react-icons/fi";
import { scoreActions, getScoreVoices } from "../../store/score";
import { DEFAULT_MUTATION_NUM_REPEATS } from "../../consts/score";
import { instrumentLabel } from "../../services/rhythm-variations";
import { useVariations, VARIATION_SYMBOLS } from "./score-tools";
import useRepeat from "./buttons/mutate/common/repeat-hook";
import MeasureVariationDialog from "./MeasureVariationDialog";
import Dialog from "../ui/Dialog";
import { Tile, ToolMenu } from "./EditTools";
import styles from "./score-workspace.module.css";

const TYPES = [["swap", "Swap"], ["shuffle", "Shuffle"], ["reverse", "Reverse"]];
const GRIDS = [["4", "4th"], ["8", "8th"], ["16", "16th"], ["32", "32nd"]];
const HELP = "Generate repeats the whole score, then swaps, shuffles or reverses its notes on the chosen grid. "
  + "The variation buttons reshuffle one kind of marking (or drum voice) in the measures chosen here, without changing the rhythm.";

// Mutate mode's two toolbar rows: which measures variations apply to (where the
// edit tabs sit), then the Generate settings and variation buttons as tiles.
export default function MutateTools() {
  const dispatch = useDispatch();
  const mutation = useSelector((state) => state.score.present.mutations[0]);
  const voices = useSelector((state) => getScoreVoices(state.score.present));
  const score = useSelector((state) => state.score.present.score);
  const { numRepeats, setNumRepeats, repeatOptions } = useRepeat(DEFAULT_MUTATION_NUM_REPEATS);
  const [onePartOnly, setOnePartOnly] = useState(false);
  const [applyTo, setApplyTo] = useState("selected");
  const [menu, setMenu] = useState(null), [browse, setBrowse] = useState(null);
  const variations = useVariations(applyTo === "all");
  const { index, measure, instrument, instruments, options, available } = variations;

  const numParts = Object.values(score.parts).filter((part) => part != null).length;
  const repeats = Math.min(Number(numRepeats), repeatOptions.length) || 1;
  const types = TYPES.some(([value]) => value === mutation.type) ? TYPES : [...TYPES, [mutation.type, mutation.type]];
  const fields = [
    ["Type", mutation.type, types, (value) => dispatch(scoreActions.updateMutateType(value))],
    ["Context", mutation.context, [["All", "All"], ...Object.entries(voices)], (value) => dispatch(scoreActions.updateMutateContext(value))],
    ["Grid", String(mutation.grid), GRIDS, (value) => dispatch(scoreActions.updateMutateGrid(value))],
    ["Repeat", String(repeats), repeatOptions.map((count) => [String(count), count]), (value) => setNumRepeats(Number(value))],
  ];
  // The drum set has more voices than fit beside the settings; the rest are under More.
  const inline = options.length > 5 ? options.slice(0, 4) : options, overflow = options.slice(inline.length);
  const closeMenu = () => setMenu(null);

  return <>
    <div className={styles.scope}>
      <label>Apply to
        <select value={applyTo} onChange={(event) => setApplyTo(event.target.value)}>
          <option value="selected">{measure ? `Measure ${index + 1}` : "Selected measure"}</option>
          <option value="all">All measures</option>
        </select>
      </label>
      {instruments.length > 1 && <select aria-label="Variation part" title="Part to vary" value={instrument} onChange={(event) => variations.setInstrument(event.target.value)}>
        {instruments.map((value) => <option key={value} value={value}>{instrumentLabel(value)}</option>)}
      </select>}
      <Tooltip title={HELP} describeChild arrow><button type="button" className={styles.help} aria-label="How mutate works"><FiHelpCircle /></button></Tooltip>
    </div>

    <div className={styles.tools}>
      {fields.map(([label, value, choices, onChange]) => <label key={label} className={`${styles.tile} ${styles.fieldTile}`}>
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {choices.map(([choice, name]) => <option key={choice} value={choice}>{name}</option>)}
        </select>
        <span>{label}</span>
      </label>)}
      <Tile label="Generate" className={styles.generate} onClick={() => numParts > 1 ? setOnePartOnly(true) : dispatch(scoreActions.mutateNotes(repeats))}><FiShuffle /></Tile>
      <span className={styles.divider} />
      <div className={`${styles.groupItems} ${styles.tileGroup}`} role="group" aria-label="Vary the measure">
        {inline.map(([category, name]) => <Tile key={category} label={name} aria-label={name} disabled={!available.has(category)}
          title={available.has(category) ? `Vary ${name.toLowerCase()}` : variations.unavailableReason(name)} onClick={() => variations.vary(category, name)}>
          <span className={styles.badge} data-category={category}>{VARIATION_SYMBOLS[category]}</span>
        </Tile>)}
        {overflow.length > 0 && <Tile label="More" aria-haspopup="menu" aria-expanded={Boolean(menu)} onClick={(event) => setMenu({ anchor: event.currentTarget, type: "more" })}><FiMoreHorizontal /></Tile>}
      </div>
      <Tile label="Variations" disabled={!measure} title={measure ? `Browse variations of measure ${index + 1}` : "Select a measure first"}
        onClick={() => setBrowse({ score, measure, index, instrument })}><FiLayers /></Tile>

      <ToolMenu menu={menu} type="more" onClose={closeMenu} label="More variations">
        {overflow.map(([category, name]) => <MenuItem key={category} aria-label={name} disabled={!available.has(category)} onClick={() => { closeMenu(); variations.vary(category, name); }}>
          <span className={styles.badge} data-category={category} aria-hidden="true">{VARIATION_SYMBOLS[category]}</span>{name}
        </MenuItem>)}
      </ToolMenu>
      {browse && <MeasureVariationDialog source={browse} onClose={() => setBrowse(null)} />}
      <Dialog onOk={() => setOnePartOnly(false)} message="Mutate can only be used with one part." isOpen={onePartOnly} />
    </div>
  </>;
}
