import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Dialog from "@mui/material/Dialog";
import { FiX } from "react-icons/fi";
import VariationBrowser from "../variations/VariationBrowser";
import { scoreActions } from "../../store/score";
import styles from "../variations/variations.module.css";

export default function MeasureVariationDialog({ source, onClose }) {
  const dispatch = useDispatch(), tempo = useSelector((state) => state.score.present.tempo);
  const [expanded, setExpanded] = useState(false), [selected, setSelected] = useState(null);
  const [previewScore] = useState(() => ({ ...source.score, measures: [source.measure] }));
  function apply() {
    dispatch(scoreActions.replaceMeasure({ index: source.index, measure: selected.measure, expected: source.measure }));
    onClose();
  }
  return <Dialog open fullWidth maxWidth="sm" fullScreen={expanded} onClose={() => expanded ? setExpanded(false) : onClose()} aria-labelledby="measure-variations-title" PaperProps={{ className: expanded ? undefined : styles.dialog }}>
    <header className={styles.dialogHeader}><div><h2 id="measure-variations-title">Measure {source.index + 1} variations</h2><p>Choose a variation, then apply it to this measure.</p></div><button onClick={onClose} aria-label="Close measure variations"><FiX /></button></header>
    <VariationBrowser score={previewScore} tempo={tempo} onSelect={setSelected} light expanded={expanded} onToggleExpand={() => setExpanded((value) => !value)} />
    <footer className={styles.dialogFooter}><span>{selected ? `Variation ${selected.number} selected` : "Your score stays unchanged until you apply."}</span><button disabled={!selected} onClick={apply}>Use variation</button></footer>
  </Dialog>;
}
