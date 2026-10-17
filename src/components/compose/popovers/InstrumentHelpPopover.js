import Popover from "@mui/material/Popover";
import useInstruments from "../buttons/instruments-hook";
import { instrumentLabel } from "../../../services/rhythm-variations";
import styles from "../score-workspace.module.css";

const SHORTCUTS = [
  ["← →", "Previous / next note"],
  ["A", "Accent"],
  ["F", "Flam"],
  ["D", "Diddle"],
  ["C", "Cheese"],
  ["R / L", "Right / left sticking"],
  ["Space", "Play or stop the score"],
  ["1 2 3 4", "Quarter, 8th, 16th, 32nd note"],
  ["5 6 7 8", "Quarter, 8th, 16th, 32nd rest"],
  ["9 / 0", "Whole / half note"],
  ["- / =", "Whole / half rest"],
  ["Ctrl+Z / Ctrl+Y", "Undo / redo"],
];

export default function HelpPopover({ anchorEl, onClose }) {
  const { instrument, legend } = useInstruments();

  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
      PaperProps={{ className: `${styles.menu} ${styles.helpCard}`, role: "dialog", "aria-label": "Help and shortcuts" }}
    >
      <h3>{instrumentLabel(instrument)} voices</h3>
      <dl>{legend.map(([key, name]) => <div key={key} style={{ display: "contents" }}><dt>{key}</dt><dd>{name}</dd></div>)}</dl>
      <h3>Keyboard shortcuts</h3>
      <dl>{SHORTCUTS.map(([key, action]) => <div key={key} style={{ display: "contents" }}><dt>{key}</dt><dd>{action}</dd></div>)}</dl>
    </Popover>
  );
}
