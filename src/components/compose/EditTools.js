import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/router";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import { FiCopy, FiClipboard, FiChevronDown, FiMoreHorizontal, FiLayers, FiSearch, FiTrash2, FiCheck, FiSliders, FiArrowLeft, FiArrowRight } from "react-icons/fi";
import ReactGA from "react-ga";
import { scoreActions, getSelectedNote, modifyNote, ACCENT, BUZZ, FLAM, DIDDLE, CHEESE, LEFT_STICKING, RIGHT_STICKING } from "../../store/score";
import { openNotationSearch } from "../../services/notation-search";
import useInstruments from "./buttons/instruments-hook";
import TimeSigMenu from "./menus/TimeSigMenu";
import TupletPickerPopover from "./popovers/TupletPickerPopover";
import styles from "./score-workspace.module.css";

import WholeNoteIcon from "../../../icons/notes/whole.svg";
import HalfNoteIcon from "../../../icons/notes/half.svg";
import QuarterNoteIcon from "../../../icons/notes/quarter.svg";
import EighthNoteIcon from "../../../icons/notes/eighth.svg";
import SixteenthNoteIcon from "../../../icons/notes/sixteenth.svg";
import ThirtysecondNoteIcon from "../../../icons/notes/thirtysecond.svg";
import WholeNoteRestIcon from "../../../icons/notes/wholeRest.svg";
import HalfNoteRestIcon from "../../../icons/notes/halfRest.svg";
import QuarterNoteRestIcon from "../../../icons/notes/quarterRest.svg";
import EighthNoteRestIcon from "../../../icons/notes/eighthRest.svg";
import SixteenthNoteRestIcon from "../../../icons/notes/sixteenthRest.svg";
import ThirtysecondNoteRestIcon from "../../../icons/notes/thirtysecondRest.svg";
import AddMeasureLeftIcon from "../../../icons/measure/addMeasureLeft.svg";
import AddMeasureRightIcon from "../../../icons/measure/addMeasureRight.svg";
import DeleteMeasureIcon from "../../../icons/measure/deleteMeasure.svg";
import RepeatStartIcon from "../../../icons/measure/repeatStart.svg";
import AccentIcon from "../../../icons/ornaments/accent.svg";
import BuzzIcon from "../../../icons/ornaments/buzz.svg";
import FlamIcon from "../../../icons/ornaments/flam.svg";
import DiddleIcon from "../../../icons/ornaments/diddle.svg";
import CheeseIcon from "../../../icons/ornaments/cheese.svg";
import LeftStickingIcon from "../../../icons/ornaments/leftSticking.svg";
import RightStickingIcon from "../../../icons/ornaments/rightSticking.svg";

export const EDIT_TABS = ["Measure", "Notes", "Ornaments", "Sticking"];

// [type, label, note icon, note viewBox, rest icon, rest viewBox, note key, rest key]
const DURATIONS = [
  ["whole", "Whole", WholeNoteIcon, "-12 -12 40 32", WholeNoteRestIcon, "-14 -12 80 40", "9", "-"],
  ["half", "Half", HalfNoteIcon, "0 0 15.28 42.64", HalfNoteRestIcon, "-14 -12 80 40", "0", "="],
  ["quarter", "Quarter", QuarterNoteIcon, "0 0 15.28 42.64", QuarterNoteRestIcon, "0 0 16.05 43.81", "1", "5"],
  ["eighth", "Eighth", EighthNoteIcon, "0 0 29 43", EighthNoteRestIcon, "0 0 20.04 34", "2", "6"],
  ["sixteenth", "Sixteenth", SixteenthNoteIcon, "0 0 28.43 50", SixteenthNoteRestIcon, "0 0 26.27 50", "3", "7"],
  ["thirtysecond", "Thirty-second", ThirtysecondNoteIcon, "0 0 28.43 50", ThirtysecondNoteRestIcon, "0 0 25.82 50", "4", "8"],
];
// [label, ornament, action, icon, viewBox, shortcut]
const ORNAMENTS = [
  ["Accent", ACCENT, "toggleAccent", AccentIcon, "0 0 42.39 50", "A"],
  ["Buzz", BUZZ, "toggleBuzz", BuzzIcon, "0 0 75 68"],
  ["Flam", FLAM, "toggleFlam", FlamIcon, "0 0 47.58 50", "F"],
  ["Diddle", DIDDLE, "toggleDiddle", DiddleIcon, "0 0 55.55 50", "D"],
  ["Cheese", CHEESE, "toggleCheese", CheeseIcon, "0 0 66.8 50", "C"],
];
const STICKINGS = [
  ["Right", RIGHT_STICKING, "toggleRightSticking", RightStickingIcon, "0 0 39.33 49.55", "R"],
  ["Left", LEFT_STICKING, "toggleLeftSticking", LeftStickingIcon, "0 0 39.33 50", "L"],
];

// Clicking a tool must not move focus off the score, or the keyboard
// shortcuts (A, F, R, space…) would stop working until the user clicks away.
const keepFocus = (event) => event.preventDefault();

export function Tile({ icon: Icon, viewBox, label, caret, className = "", children, ...props }) {
  return <button type="button" className={`${styles.tile} ${className}`} onMouseDown={keepFocus} {...props}>
    <span className={styles.tileIcon} aria-hidden="true">{Icon && <Icon viewBox={viewBox} className={styles.glyph} />}{children}{caret && <FiChevronDown className={styles.menuCaret} />}</span>
    {label && <span>{label}</span>}
  </button>;
}

export function ToolMenu({ menu, type, onClose, label, children }) {
  return <Menu anchorEl={menu?.anchor} open={menu?.type === type} onClose={onClose} transitionDuration={120}
    anchorOrigin={{ vertical: "bottom", horizontal: "left" }} transformOrigin={{ vertical: "top", horizontal: "left" }}
    PaperProps={{ className: styles.menu }} MenuListProps={{ "aria-label": label }}>
    {children}
  </Menu>;
}

export function EditTabs({ tab, onTabChange }) {
  function onKeyDown(event) {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    const next = (tab + step + EDIT_TABS.length) % EDIT_TABS.length;
    onTabChange(next);
    document.getElementById(`edit-tab-${next}`)?.focus();
  }
  return <div className={styles.tabs} role="tablist" aria-label="Edit tools" onKeyDown={onKeyDown}>
    {EDIT_TABS.map((name, index) => <button key={name} id={`edit-tab-${index}`} type="button" role="tab" className={styles.tab}
      aria-selected={tab === index} aria-controls="edit-tools" tabIndex={tab === index ? 0 : -1} onClick={() => onTabChange(index)}>{name}</button>)}
  </div>;
}

export default function EditTools({ tab, clipboard, setClipboard, notice, setNotice }) {
  const dispatch = useDispatch(), router = useRouter();
  const [menu, setMenu] = useState(null);
  const present = useSelector((state) => state.score.present);
  const selectedNote = useSelector((state) => getSelectedNote(state.score.present));
  const { voiceButtons } = useInstruments();
  const { score, repeat, isPlaying, dotSelected, tuplet } = present;
  const index = present.selectedNoteIndex?.measureIndex;
  const measure = score.measures[index];
  const timeSig = measure?.timeSig || present.timeSig;
  const openMenu = (event, type) => setMenu({ anchor: event.currentTarget, type });
  const closeMenu = () => setMenu(null);
  const noMeasure = measure ? undefined : "Select a measure first";
  const has = (ornament) => Boolean(selectedNote?.ornaments?.includes(ornament));

  function setNote(type, isRest) {
    const root = document.getElementById("score-root");
    dispatch(modifyNote({ type, isRest }, { top: root?.scrollTop || 0, left: root?.scrollLeft || 0 }));
  }
  function toggle([label, , action]) {
    ReactGA.event({ category: "ornament", action: `toggle ${label.toLowerCase()}` });
    dispatch(scoreActions[action]());
  }
  function paste(side, source = clipboard) {
    closeMenu();
    dispatch(scoreActions.pasteMeasure({ measure: source, side }));
    setNotice(side === "left" ? "Inserted before" : "Inserted after");
  }

  let tools;
  if (tab === 0) {
    const repeatHere = measure && (repeat.start === index || repeat.end === index);
    tools = <>
      <Tile icon={AddMeasureLeftIcon} viewBox="0 0 90 52" label="Add before" disabled={isPlaying} onClick={() => dispatch(scoreActions.addMeasure(false))} />
      <Tile icon={AddMeasureRightIcon} viewBox="0 0 88 52" label="Add after" disabled={isPlaying} onClick={() => dispatch(scoreActions.addMeasure(true))} />
      <Tile icon={DeleteMeasureIcon} viewBox="0 0 68.2 52.01" label="Delete" disabled={isPlaying || !measure} title={noMeasure} onClick={() => dispatch(scoreActions.deleteMeasure())} />
      <Tile label="Copy" disabled={!measure} title={noMeasure} onClick={() => { setClipboard(JSON.parse(JSON.stringify(measure))); setNotice(`Measure ${index + 1} copied`); }}><FiCopy /></Tile>
      <Tile label="Paste" caret disabled={!clipboard || !measure || isPlaying} title={!clipboard ? "Copy a measure first" : noMeasure}
        aria-haspopup="menu" aria-expanded={menu?.type === "paste"} onClick={(event) => openMenu(event, "paste")}><FiClipboard /></Tile>
      <Tile icon={RepeatStartIcon} viewBox="0 0 68.2 52.01" label="Repeat" caret aria-pressed={Boolean(repeatHere)} disabled={isPlaying}
        aria-haspopup="menu" aria-expanded={menu?.type === "repeat"} onClick={(event) => openMenu(event, "repeat")} />
      <Tile label="Time sig" caret disabled={!measure || isPlaying} title={noMeasure} aria-haspopup="menu" aria-expanded={menu?.type === "timeSig"}
        aria-label={`Time signature ${timeSig.num}/${timeSig.type}`} onClick={(event) => openMenu(event, "timeSig")}><span className={styles.timeSig}>{timeSig.num}/{timeSig.type}</span></Tile>
      <Tile label="More" aria-haspopup="menu" aria-expanded={menu?.type === "more"} onClick={(event) => openMenu(event, "more")}><FiMoreHorizontal /></Tile>

      <ToolMenu menu={menu} type="paste" onClose={closeMenu} label="Paste measure">
        <MenuItem onClick={() => paste("left")}><FiArrowLeft />Paste before</MenuItem>
        <MenuItem onClick={() => paste("right")}><FiArrowRight />Paste after</MenuItem>
      </ToolMenu>
      <ToolMenu menu={menu} type="repeat" onClose={closeMenu} label="Repeat">
        {[["start", "Start repeat", "setRepeatStart"], ["end", "End repeat", "setRepeatEnd"]].map(([edge, label, action]) =>
          <MenuItem key={edge} role="menuitemcheckbox" aria-checked={measure ? repeat[edge] === index : edge in repeat} onClick={() => { closeMenu(); dispatch(scoreActions[action]()); }}>
            {label} {measure ? `at measure ${index + 1}` : edge === "start" ? "at the beginning" : "at the end"}
            {(measure ? repeat[edge] === index : edge in repeat) && <FiCheck className={styles.check} aria-hidden="true" />}
          </MenuItem>)}
      </ToolMenu>
      <TimeSigMenu isOpen={menu?.type === "timeSig"} anchorEl={menu?.anchor} onClose={closeMenu} className={styles.menu}
        onChange={(value) => { const [num, type] = value.split("/"); dispatch(scoreActions.updateTimeSig({ num, type })); closeMenu(); }} />
      <ToolMenu menu={menu} type="more" onClose={closeMenu} label="More measure tools">
        <MenuItem disabled={!measure || isPlaying} onClick={() => { paste("right", measure); setNotice("Measure duplicated"); }}><FiLayers />Duplicate measure</MenuItem>
        <MenuItem disabled={!measure} onClick={async () => { closeMenu(); try { await openNotationSearch(router, { ...score, measures: [measure] }, `Measure ${index + 1}`); } catch { setNotice("Couldn't open notation search. Please try again."); } }}><FiSearch />Find matching rhythms</MenuItem>
        <Divider />
        <MenuItem disabled={isPlaying} onClick={() => { closeMenu(); dispatch(scoreActions.clearScore()); }}><FiTrash2 />Clear score</MenuItem>
      </ToolMenu>
    </>;
  } else if (tab === 1) {
    tools = <>
      <div className={styles.group} role="group" aria-labelledby="voice-label">
        <span id="voice-label" className={styles.groupLabel}>Voice</span>
        <div className={styles.groupItems}>{voiceButtons.map(({ text, selected, onClick }) =>
          <button key={text} type="button" className={styles.chip} aria-pressed={Boolean(selected)} onMouseDown={keepFocus} onClick={onClick}>{text}</button>)}</div>
      </div>
      {[["Note", false], ["Rest", true]].map(([group, isRest]) => <div key={group} className={styles.group} role="group" aria-labelledby={`${group}-label`}>
        <span id={`${group}-label`} className={styles.groupLabel}>{group}</span>
        <div className={styles.groupItems}>{DURATIONS.map(([type, label, noteIcon, noteBox, restIcon, restBox, noteKey, restKey]) =>
          <Tile key={type} className={styles.square} icon={isRest ? restIcon : noteIcon} viewBox={isRest ? restBox : noteBox} aria-label={`${label} ${group.toLowerCase()}`} title={`${label} ${group.toLowerCase()} (${isRest ? restKey : noteKey})`}
            disabled={type === "thirtysecond" && dotSelected} onClick={() => setNote(type, isRest)} />)}</div>
      </div>)}
      <div className={styles.group} role="group" aria-labelledby="modifier-label">
        <span id="modifier-label" className={styles.groupLabel}>Modify</span>
        <div className={styles.groupItems}>
          <button type="button" className={styles.chip} aria-pressed={dotSelected} onMouseDown={keepFocus} onClick={() => dispatch(scoreActions.toggleDotSelected())}>Dot</button>
          <button type="button" className={styles.chip} aria-pressed={tuplet.selected} onMouseDown={keepFocus} onClick={() => dispatch(scoreActions.toggleTupletSelected())}>Tuplet {tuplet.actual}:{tuplet.normal}</button>
          <button type="button" className={styles.chip} aria-label="Tuplet settings" title="Tuplet settings" aria-haspopup="dialog" onClick={(event) => openMenu(event, "tuplet")}><FiSliders /></button>
        </div>
      </div>
      <TupletPickerPopover tupletPickerOpen={menu?.type === "tuplet"} tupletPickerAnchorEl={menu?.anchor} handleTupletPickerClose={closeMenu} />
    </>;
  } else {
    tools = (tab === 2 ? ORNAMENTS : STICKINGS).map((item) => {
      const [label, ornament, , icon, viewBox, shortcut] = item;
      return <Tile key={label} icon={icon} viewBox={viewBox} label={label} aria-pressed={has(ornament)} title={shortcut && `${label} (${shortcut})`} onClick={() => toggle(item)} />;
    });
  }

  return <div id="edit-tools" className={`${styles.tools} ${tab === 1 ? styles.noteTools : ""}`} role="tabpanel" aria-labelledby={`edit-tab-${tab}`}>
    {tools}
    <span className={styles.notice} role="status">{notice}</span>
  </div>;
}
