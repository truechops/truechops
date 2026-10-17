import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import { FiX } from "react-icons/fi";
import Legend from "../../../data/byos/alphabet/legend";
import styles from "./byos.module.css";

const symbols = ["Rim click / ping", "Butt of the stick", "Backstick", "Crossover", "Stick click"];

export default function LegendDialog({ open, onClose }) {
  return <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ className: styles.guide }} aria-labelledby="byos-guide-title">
    <div className={styles.guideHeader}><h2 id="byos-guide-title">Notation guide</h2><button onClick={onClose} aria-label="Close notation guide"><FiX aria-hidden="true" /></button></div>
    <DialogContent className={styles.guideContent}>
      <p>A quick reference for the BYOS noteheads.</p>
      <ul className={styles.guideList}>{symbols.map((label, index) => <li key={label}><span className={styles.guideSymbol} aria-hidden="true"><Legend symbol={index} /></span><span>{label}</span></li>)}</ul>
      <p className={styles.stickingHint}><strong>R</strong> and <strong>L</strong> beneath the notes show right and left sticking.</p>
    </DialogContent>
  </Dialog>;
}
