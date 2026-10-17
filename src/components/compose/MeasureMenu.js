import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import ListSubheader from "@mui/material/ListSubheader";
import { FiArrowLeft, FiCheck, FiChevronRight, FiClipboard, FiCopy, FiLayers, FiPlusSquare, FiSearch, FiShuffle } from "react-icons/fi";
import { timeSigs } from "../../consts/score";
import { instrumentLabel } from "../../services/rhythm-variations";
import { useMeasureActions, useVariations, VARIATION_SYMBOLS } from "./score-tools";
import MeasureVariationDialog from "./MeasureVariationDialog";
import styles from "./score-workspace.module.css";

import AddMeasureLeftIcon from "../../../icons/measure/addMeasureLeft.svg";
import AddMeasureRightIcon from "../../../icons/measure/addMeasureRight.svg";
import DeleteMeasureIcon from "../../../icons/measure/deleteMeasure.svg";
import RepeatStartIcon from "../../../icons/measure/repeatStart.svg";
import RepeatEndIcon from "../../../icons/measure/repeatEnd.svg";

const SUBMENU_WIDTH = 240;
const SUBMENU_LABELS = { vary: "Vary", timeSig: "Time signature" };

// The selected measure's options and variations, opened from its "…" button.
// anchor is a viewport position: { top, left, align: "left" | "right" }.
// Time signature and Vary open as flyouts beside the menu on hover (or →), and
// in place, with a back item, when there's no room beside it.
export default function MeasureMenu({ anchor, onClose }) {
  const score = useSelector((state) => state.score.present.score);
  const actions = useMeasureActions();
  const variations = useVariations(false);
  const [view, setView] = useState("main"), [sub, setSub] = useState(null), [browse, setBrowse] = useState(null);
  const closeTimer = useRef();
  const { index, measure, isPlaying, clipboard, timeSig } = actions;
  const check = (on) => on && <FiCheck className={styles.check} aria-hidden="true" />;

  const cancelClose = () => clearTimeout(closeTimer.current);
  // A short delay lets the pointer cross other items on its way into a flyout.
  const scheduleClose = () => { cancelClose(); closeTimer.current = setTimeout(() => setSub(null), 150); };
  function closeAll() { cancelClose(); setSub(null); onClose(); }
  const run = (action) => () => { closeAll(); action(); };
  function openSub(type, element, via) {
    cancelClose();
    const box = element.getBoundingClientRect();
    const side = box.right + SUBMENU_WIDTH <= window.innerWidth - 8 ? "right" : box.left - SUBMENU_WIDTH >= 8 ? "left" : null;
    if (side) setSub({ type, anchor: element, side, focus: via === "keyboard" });
    else if (via !== "hover") setView(type);
  }
  function closeSub() {
    const parent = sub?.anchor;
    setSub(null);
    parent?.focus();
  }
  const parentProps = (type) => ({
    "aria-haspopup": "menu", "aria-expanded": sub?.type === type,
    // A class, not `selected`: MUI moves focus to a menu's selected item when it changes.
    className: sub?.type === type ? styles.expanded : undefined,
    onMouseEnter: (event) => openSub(type, event.currentTarget, "hover"),
    onClick: (event) => openSub(type, event.currentTarget, event.detail === 0 ? "keyboard" : "click"),
    onKeyDown: (event) => { if (event.key === "ArrowRight") { event.preventDefault(); openSub(type, event.currentTarget, "keyboard"); } },
  });
  // Hovering any other item closes an open flyout.
  const itemProps = { onMouseEnter: scheduleClose };

  useEffect(() => { if (anchor) { setView("main"); setSub(null); } }, [anchor]);
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  function submenuItems(type) {
    if (type === "vary") return [
      variations.instruments.length > 1 && <li key="part" className={styles.menuField}><label>Part
        <select value={variations.instrument} onChange={(event) => variations.setInstrument(event.target.value)}>
          {variations.instruments.map((value) => <option key={value} value={value}>{instrumentLabel(value)}</option>)}
        </select></label></li>,
      ...variations.options.map(([category, name]) => <MenuItem key={category} aria-label={name} disabled={!variations.available.has(category)} onClick={run(() => variations.vary(category, name))}>
        <span className={styles.badge} data-category={category} aria-hidden="true">{VARIATION_SYMBOLS[category]}</span>{name}
      </MenuItem>),
    ];
    return Object.keys(timeSigs).map((value) => {
      const current = value === `${timeSig.num}/${timeSig.type}`;
      return <MenuItem key={value} role="menuitemradio" aria-checked={current} onClick={run(() => actions.setTimeSig(value))}>{value}{check(current)}</MenuItem>;
    });
  }

  let items, label;
  if (view !== "main") {
    label = view === "vary" ? `Vary measure ${index + 1}` : SUBMENU_LABELS[view];
    items = [<MenuItem key="back" onClick={() => setView("main")}><FiArrowLeft />{SUBMENU_LABELS[view]}</MenuItem>, ...submenuItems(view)];
  } else {
    label = `Measure ${index + 1} options`;
    items = [
      <ListSubheader key="title" className={styles.menuTitle} onMouseEnter={scheduleClose}>Measure {index + 1}</ListSubheader>,
      <MenuItem key="before" {...itemProps} disabled={isPlaying} onClick={run(() => actions.addMeasure(false))}><AddMeasureLeftIcon viewBox="0 0 90 52" className={styles.glyph} />Add measure before</MenuItem>,
      <MenuItem key="after" {...itemProps} disabled={isPlaying} onClick={run(() => actions.addMeasure(true))}><AddMeasureRightIcon viewBox="0 0 88 52" className={styles.glyph} />Add measure after</MenuItem>,
      <MenuItem key="duplicate" {...itemProps} disabled={isPlaying} onClick={run(actions.duplicate)}><FiPlusSquare />Duplicate</MenuItem>,
      <MenuItem key="copy" {...itemProps} onClick={run(actions.copy)}><FiCopy />Copy</MenuItem>,
      <MenuItem key="pasteBefore" {...itemProps} disabled={!clipboard || isPlaying} onClick={run(() => actions.paste("left"))}><FiClipboard />Paste before</MenuItem>,
      <MenuItem key="pasteAfter" {...itemProps} disabled={!clipboard || isPlaying} onClick={run(() => actions.paste("right"))}><FiClipboard />Paste after</MenuItem>,
      <MenuItem key="delete" {...itemProps} disabled={isPlaying} onClick={run(actions.deleteMeasure)}><DeleteMeasureIcon viewBox="0 0 68.2 52.01" className={styles.glyph} />Delete</MenuItem>,
      <Divider key="edit" />,
      ...[["start", "Start repeat here", RepeatStartIcon], ["end", "End repeat here", RepeatEndIcon]].map(([edge, text, Icon]) =>
        <MenuItem key={edge} {...itemProps} role="menuitemcheckbox" aria-checked={actions.isRepeat(edge)} disabled={isPlaying} onClick={run(() => actions.toggleRepeat(edge))}>
          <Icon viewBox="0 0 68.2 52.01" className={styles.glyph} />{text}{check(actions.isRepeat(edge))}
        </MenuItem>),
      <MenuItem key="timeSig" disabled={isPlaying} {...parentProps("timeSig")}>
        <span className={styles.menuTimeSig} aria-hidden="true">{timeSig.num}/{timeSig.type}</span>Time signature<FiChevronRight className={styles.chevron} />
      </MenuItem>,
      <Divider key="vary" />,
      <MenuItem key="varyMenu" {...parentProps("vary")}><FiShuffle />Vary<FiChevronRight className={styles.chevron} /></MenuItem>,
      <MenuItem key="browse" {...itemProps} onClick={run(() => setBrowse({ score, measure, index, instrument: variations.instrument }))}><FiLayers />Browse variations</MenuItem>,
      <MenuItem key="find" {...itemProps} onClick={run(actions.findSimilar)}><FiSearch />Find similar rhythms</MenuItem>,
    ];
  }

  const open = Boolean(anchor && measure);
  return <>
    <Menu open={open} onClose={closeAll} transitionDuration={120} anchorReference="anchorPosition"
      anchorPosition={anchor ? { top: anchor.top, left: anchor.left } : { top: 0, left: 0 }}
      transformOrigin={{ vertical: "top", horizontal: anchor?.align === "right" ? "right" : "left" }}
      PaperProps={{ className: styles.menu }} MenuListProps={{ "aria-label": label }}>
      {items}
    </Menu>
    {/* The flyout lets the pointer and clicks reach the main menu beneath it, and only
        takes focus when opened from the keyboard. */}
    <Menu open={open && Boolean(sub)} anchorEl={sub?.anchor} onClose={closeSub} transitionDuration={100}
      anchorOrigin={{ vertical: "top", horizontal: sub?.side === "left" ? "left" : "right" }}
      transformOrigin={{ vertical: "top", horizontal: sub?.side === "left" ? "right" : "left" }}
      hideBackdrop disableEnforceFocus disableRestoreFocus disableAutoFocus={!sub?.focus} autoFocus={Boolean(sub?.focus)}
      sx={{ pointerEvents: "none" }}
      PaperProps={{ className: `${styles.menu} ${styles.submenu}`, "data-side": sub?.side, sx: { pointerEvents: "auto" }, onMouseEnter: cancelClose }}
      MenuListProps={{ "aria-label": sub?.type === "vary" ? `Vary measure ${index + 1}` : SUBMENU_LABELS[sub?.type],
        onKeyDown: (event) => { if (event.key === "ArrowLeft") { event.preventDefault(); closeSub(); } } }}>
      {sub && submenuItems(sub.type)}
    </Menu>
    {browse && <MeasureVariationDialog source={browse} onClose={() => setBrowse(null)} />}
  </>;
}
