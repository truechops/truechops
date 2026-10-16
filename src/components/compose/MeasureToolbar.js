import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDispatch } from "react-redux";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { FiCopy, FiClipboard, FiLayers, FiSliders, FiChevronDown, FiChevronRight, FiArrowLeft, FiArrowRight, FiShuffle, FiX } from "react-icons/fi";
import { scoreActions } from "../../store/score";
import { canShuffleMeasure } from "../../services/measure-editing";
import styles from "./measure-toolbar.module.css";

const options = [["stickings","Stickings","R L"],["accents","Accents",">"],["diddles","Diddles","≋"],["cheese","Cheese","♬"],["flams","Flams","♮"]];

export default function MeasureToolbar({ scoreId, score, selectedIndex, open, onClose }) {
  const dispatch = useDispatch();
  const [clipboard,setClipboard] = useState(null), [notice,setNotice] = useState("");
  const [menu,setMenu] = useState(null), [category,setCategory] = useState("");
  const [position,setPosition] = useState(null);
  const toolbar = useRef(null);
  const measure = score.measures[selectedIndex];
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

  useEffect(() => { closeMenu(); setNotice(""); },[selectedIndex,open]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""),2200);
    return () => clearTimeout(timer);
  },[notice]);
  useEffect(() => {
    if (!measure || !open) return;
    function dismiss(event) {
      if (event.key === "Escape" && !menu) {
        onClose();
        document.getElementById(scoreId)?.querySelector(`[data-measure-index="${selectedIndex}"] [data-measure-trigger]`)?.focus();
      }
    }
    function clickAway(event) {
      if (!event.composedPath().some((element) => element.matches?.("[data-measure-toolbar],[data-measure-trigger],.MuiPopover-root"))) onClose();
    }
    window.addEventListener("keydown",dismiss);
    window.addEventListener("click",clickAway);
    return () => { window.removeEventListener("keydown",dismiss); window.removeEventListener("click",clickAway); };
  },[measure,menu,open,onClose,scoreId,selectedIndex]);

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
        <MenuItem key="shuffle" disabled={!canShuffleMeasure(measure,category)} onClick={() => { dispatch(scoreActions.shuffleSelectedMeasure(category)); closeMenu(); setNotice(`${label} shuffled`); }}><FiShuffle />Shuffle</MenuItem>,
        !canShuffleMeasure(measure,category) && <li key="hint" className={styles.menuHint}>No different pattern to shuffle. Add or vary these markings first.</li>
      ] : options.map(([value,name,symbol]) => <MenuItem key={value} aria-label={name} onClick={() => setCategory(value)} aria-haspopup="menu"><span className={styles.categoryIcon} data-category={value} aria-hidden="true">{symbol}</span>{name}<FiChevronRight className={styles.chevron} /></MenuItem>)}
    </Menu>
  </>,document.body);
}
