import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/router";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { FiCopy, FiClipboard, FiLayers, FiSliders, FiChevronDown, FiChevronRight, FiArrowLeft, FiArrowRight, FiShuffle, FiX, FiSearch } from "react-icons/fi";
import { scoreActions } from "../../store/score";
import { canAdjustMeasure, getVariationOptions, instrumentLabel } from "../../services/rhythm-variations";
import { openNotationSearch } from "../../services/notation-search";
import MeasureVariationDialog from "./MeasureVariationDialog";
import styles from "./measure-toolbar.module.css";

const symbols = { stickings: "R L", accents: ">", diddles: "≋", cheese: "♬", flams: "♮", kick: "K", snare: "S", hiHat: "HH", ride: "R", hiHatFoot: "HF", tom1: "T1", tom2: "T2", tom3: "T3", tom4: "T4" };

export default function MeasureToolbar({ scoreId, score, selectedIndex, open, onClose }) {
  const dispatch = useDispatch();
  const router = useRouter(), [browse, setBrowse] = useState(null);
  const [clipboard,setClipboard] = useState(null), [notice,setNotice] = useState("");
  const [menu,setMenu] = useState(null), [category,setCategory] = useState("");
  const [position,setPosition] = useState(null);
  const toolbar = useRef(null);
  const measure = score.measures[selectedIndex];
  const selectedPartIndex = useSelector((state) => state.score.present.selectedPartIndex);
  const [targetInstrument, setTargetInstrument] = useState(null);
  const instruments = measure?.parts.filter((part) => score.parts?.[part.instrument]?.enabled !== false).map((part) => part.instrument) || [];
  const selectedInstrument = measure?.parts[selectedPartIndex]?.instrument;
  const instrument = instruments.includes(targetInstrument) ? targetInstrument : instruments.includes(selectedInstrument) ? selectedInstrument : instruments[0];
  const options = getVariationOptions(instrument);
  const closeMenu = () => { setMenu(null); setCategory(""); };

  useLayoutEffect(() => {
    function positionToolbar() {
      const element = document.getElementById(scoreId)?.querySelector(`[data-measure-index="${selectedIndex}"]`);
      if (!element) { setPosition(null); return; }
      const box = element.getBoundingClientRect();
      const contentLeft = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--site-sidebar-width")) || 0;
      const width = Math.min(390,window.innerWidth - contentLeft - 24);
      const visible = box.bottom > 80 && box.top < window.innerHeight - 80;
      setPosition(visible ? { left:Math.max(contentLeft+12,Math.min(box.left + box.width / 2 - width / 2,window.innerWidth-width-12)), top:Math.max(12,box.top-82), width } : null);
    }
    const frame = requestAnimationFrame(positionToolbar);
    const observer = new ResizeObserver(positionToolbar);
    const main = document.getElementById(scoreId)?.closest("main");
    if (main) observer.observe(main);
    window.addEventListener("resize",positionToolbar);
    window.addEventListener("scroll",positionToolbar,true);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("resize",positionToolbar); window.removeEventListener("scroll",positionToolbar,true); };
  },[scoreId,score,selectedIndex,open]);

  useEffect(() => { closeMenu(); setNotice(""); setTargetInstrument(null); },[selectedIndex,open]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""),2200);
    return () => clearTimeout(timer);
  },[notice]);
  useEffect(() => {
    if (!measure || !open) return;
    function dismiss(event) {
      if (event.key === "Escape" && !menu && !browse) {
        onClose();
        document.getElementById(scoreId)?.querySelector(`[data-measure-index="${selectedIndex}"] [data-measure-trigger]`)?.focus();
      }
    }
    function clickAway(event) {
      if (!browse && !event.composedPath().some((element) => element.matches?.("[data-measure-toolbar],[data-measure-trigger],.MuiPopover-root,.MuiDialog-root"))) onClose();
    }
    window.addEventListener("keydown",dismiss);
    window.addEventListener("click",clickAway);
    return () => { window.removeEventListener("keydown",dismiss); window.removeEventListener("click",clickAway); };
  },[measure,menu,open,onClose,scoreId,selectedIndex,browse]);

  function copy() { setClipboard(JSON.parse(JSON.stringify(measure))); setNotice("Measure copied"); }
  function paste(side, source = clipboard) {
    dispatch(scoreActions.pasteMeasure({ measure:source, side })); closeMenu();
    setNotice(side === "left" ? "Inserted to the left" : "Inserted to the right");
  }
  function openMenu(event,type) { setCategory(""); setMenu({ anchor:event.currentTarget,type }); }
  const label = options.find(([value]) => value === category)?.[1];

  if (!measure || !position || !open) return null;
  return createPortal(<>
    <div ref={toolbar} className={styles.toolbar} style={position} role="toolbar" aria-label={`Measure ${selectedIndex+1} tools`} data-measure-toolbar>
      <button onClick={copy}><FiCopy aria-hidden="true" /><span>Copy</span></button>
      <button disabled={!clipboard} title={!clipboard ? "Copy a measure first" : "Insert the copied measure"} aria-haspopup="menu" aria-expanded={menu?.type === "paste"} onClick={(event) => openMenu(event,"paste")}><FiClipboard aria-hidden="true" /><span>Paste</span></button>
      <button onClick={() => paste("right",measure)}><FiLayers aria-hidden="true" /><span>Duplicate</span></button>
      <span className={styles.divider} />
      <button className={styles.adjust} aria-haspopup="menu" aria-expanded={menu?.type === "adjust"} onClick={(event) => openMenu(event,"adjust")}><FiSliders aria-hidden="true" /><span>Adjust</span><FiChevronDown aria-hidden="true" /></button>
      <button className={styles.dismiss} aria-label="Close measure tools" onClick={onClose}><FiX aria-hidden="true" /></button>
      <span className={styles.notice} role="status">{notice}</span>
    </div>
    <Menu anchorEl={menu?.anchor} open={Boolean(menu)} onClose={closeMenu} transitionDuration={120}
      anchorOrigin={{vertical:"bottom",horizontal:"left"}} transformOrigin={{vertical:"top",horizontal:"left"}}
      PaperProps={{className:styles.menu}} MenuListProps={{"aria-label":menu?.type === "paste" ? "Paste measure" : category ? `${label} adjustments` : "Adjust measure"}}>
      {menu?.type === "paste" ? [
        <MenuItem key="left" onClick={() => paste("left")}><FiArrowLeft />Paste to the left</MenuItem>,
        <MenuItem key="right" onClick={() => paste("right")}><FiArrowRight />Paste to the right</MenuItem>
      ] : category ? [
        <MenuItem key="back" onClick={() => setCategory("")}><FiArrowLeft />{label}</MenuItem>,
        <MenuItem key="shuffle" disabled={!instrument || !canAdjustMeasure(measure,category,instrument)} onClick={() => { dispatch(scoreActions.shuffleSelectedMeasure({ category, instrument })); closeMenu(); setNotice(`${label} adjusted`); }}><FiShuffle />Shuffle</MenuItem>,
        !canAdjustMeasure(measure,category,instrument) && <li key="hint" className={styles.menuHint}>No available notes for this adjustment.</li>
      ] : [instruments.length > 1 && <li key="instrument" className={styles.menuHint}><label>Instrument <select aria-label="Adjustment instrument" value={instrument} onChange={(event) => setTargetInstrument(event.target.value)}>{instruments.map((value) => <option key={value} value={value}>{instrumentLabel(value)}</option>)}</select></label></li>,
        ...options.map(([value,name]) => <MenuItem key={value} aria-label={name} onClick={() => setCategory(value)} aria-haspopup="menu"><span className={styles.categoryIcon} data-category={value} aria-hidden="true">{symbols[value]}</span>{name}<FiChevronRight className={styles.chevron} /></MenuItem>),
        <MenuItem key="browse" aria-label="Browse variations" onClick={() => { setBrowse({ score, measure, index: selectedIndex, instrument }); closeMenu(); }}><FiLayers />Browse variations</MenuItem>,
        <MenuItem key="search" aria-label="Find matching rhythms" onClick={async () => { closeMenu(); try { await openNotationSearch(router, { ...score, measures: [measure] }, `Measure ${selectedIndex + 1}`); } catch { setNotice("Couldn't open notation search. Please try again."); } }}><FiSearch />Find matching rhythms</MenuItem>,
      ]}
    </Menu>
    {browse && <MeasureVariationDialog source={browse} onClose={() => { setBrowse(null); requestAnimationFrame(() => toolbar.current?.querySelector("button")?.focus()); }} />}
  </>,document.body);
}
