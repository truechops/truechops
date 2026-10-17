import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/router";
import { scoreActions } from "../../store/score";
import { canAdjustMeasure, getVariationInstruments, getVariationOptions } from "../../services/rhythm-variations";
import { openNotationSearch } from "../../services/notation-search";

// Measure and variation actions shared by the score toolbar and each measure's "…" menu.
const ScoreToolsContext = createContext(null);

export const VARIATION_SYMBOLS = { stickings: "R L", accents: ">", diddles: "≋", cheese: "♬", flams: "♮", kick: "K", snare: "S", hiHat: "HH", ride: "R", hiHatFoot: "HF", tom1: "T1", tom2: "T2", tom3: "T3", tom4: "T4" };

export function ScoreToolsProvider({ children }) {
  const [clipboard, setClipboard] = useState(null);
  const [notice, setNotice] = useState("");
  const [variationPart, setVariationPart] = useState(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  const value = useMemo(() => ({ clipboard, setClipboard, notice, setNotice, variationPart, setVariationPart }), [clipboard, notice, variationPart]);
  return <ScoreToolsContext.Provider value={value}>{children}</ScoreToolsContext.Provider>;
}

export const useScoreTools = () => useContext(ScoreToolsContext);

// Actions on the selected measure.
export function useMeasureActions() {
  const { clipboard, setClipboard, setNotice } = useScoreTools();
  const dispatch = useDispatch(), router = useRouter();
  const score = useSelector((state) => state.score.present.score);
  const repeat = useSelector((state) => state.score.present.repeat);
  const isPlaying = useSelector((state) => state.score.present.isPlaying);
  const currentTimeSig = useSelector((state) => state.score.present.timeSig);
  const index = useSelector((state) => state.score.present.selectedNoteIndex?.measureIndex);
  const measure = score.measures[index];

  function paste(side, source = clipboard) {
    dispatch(scoreActions.pasteMeasure({ measure: source, side }));
    setNotice(side === "left" ? "Inserted before" : "Inserted after");
  }

  return {
    index, measure, isPlaying, clipboard,
    timeSig: measure?.timeSig || currentTimeSig,
    addMeasure: (after) => dispatch(scoreActions.addMeasure(after)),
    deleteMeasure: () => dispatch(scoreActions.deleteMeasure()),
    copy() { setClipboard(JSON.parse(JSON.stringify(measure))); setNotice(`Measure ${index + 1} copied`); },
    paste,
    duplicate() { paste("right", measure); setNotice("Measure duplicated"); },
    // Without a selection, repeats start at the first measure and end at the last.
    isRepeat: (edge) => measure ? repeat[edge] === index : edge in repeat,
    toggleRepeat: (edge) => dispatch(edge === "start" ? scoreActions.setRepeatStart() : scoreActions.setRepeatEnd()),
    setTimeSig(value) { const [num, type] = value.split("/"); dispatch(scoreActions.updateTimeSig({ num, type })); },
    async findSimilar() {
      try { await openNotationSearch(router, { ...score, measures: [measure] }, `Measure ${index + 1}`); }
      catch { setNotice("Couldn't open notation search. Please try again."); }
    },
    clearScore: () => dispatch(scoreActions.clearScore()),
  };
}

// Reshuffles one marking (or drum voice) in the selected measure, or in every measure.
export function useVariations(allMeasures = false) {
  const { setNotice, variationPart, setVariationPart } = useScoreTools();
  const dispatch = useDispatch();
  const score = useSelector((state) => state.score.present.score);
  const index = useSelector((state) => state.score.present.selectedNoteIndex?.measureIndex);
  const selectedPartIndex = useSelector((state) => state.score.present.selectedPartIndex);
  const measure = score.measures[index];
  const instruments = getVariationInstruments(score);
  const selectedInstrument = measure?.parts[selectedPartIndex]?.instrument;
  const instrument = instruments.includes(variationPart) ? variationPart : instruments.includes(selectedInstrument) ? selectedInstrument : instruments[0];
  const options = getVariationOptions(instrument);
  const indexes = useMemo(() => allMeasures ? score.measures.map((_, i) => i) : measure ? [index] : [], [allMeasures, score, measure, index]);
  const available = useMemo(() => new Set(options.filter(([category]) =>
    indexes.some((i) => canAdjustMeasure(score.measures[i], category, instrument))).map(([category]) => category)), [options, indexes, score, instrument]);

  return {
    index, measure, instrument, instruments, options, available,
    setInstrument: setVariationPart,
    unavailableReason: (name) => indexes.length ? `No ${name.toLowerCase()} to vary here` : "Select a measure first",
    vary(category, name) {
      dispatch(scoreActions.adjustMeasures({ category, instrument, indexes }));
      setNotice(`${name} varied in ${allMeasures ? "every measure" : `measure ${index + 1}`}`);
    },
  };
}
