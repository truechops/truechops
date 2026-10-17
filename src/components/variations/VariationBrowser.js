import { memo, useEffect, useMemo, useRef, useState } from "react";
import { FiMaximize2, FiMinimize2, FiPlay, FiSquare, FiRefreshCw } from "react-icons/fi";
import RhythmPreview from "../book-builder/RhythmPreview";
import usePreviewAudio from "../social/usePreviewAudio";
import { rhythmVariations, seededRandom, getVariationInstruments, getVariationOptions, instrumentLabel, MAX_VARIATION_TYPES } from "../../services/rhythm-variations";
import styles from "./variations.module.css";

const PAGE_SIZE = 12, ROW_HEIGHT = 166;

const VariationNotation = memo(function VariationNotation({ score, measure }) {
  const preview = useMemo(() => ({ ...score, measures: [measure] }), [score, measure]);
  return <RhythmPreview score={preview} minWidth={200} fit compact maxHeight="100px" />;
});

export default function VariationBrowser(props) {
  const instruments = getVariationInstruments(props.score);
  const [requestedInstrument, setRequestedInstrument] = useState(props.initialInstrument);
  const instrument = instruments.includes(requestedInstrument) ? requestedInstrument : instruments[0];
  return <InstrumentVariations key={instrument || "empty"} {...props} instrument={instrument} instruments={instruments}
    onInstrumentChange={(value) => { props.onSelect(null); setRequestedInstrument(value); }} />;
}

function InstrumentVariations({ score, tempo, onSelect, renderAction, expanded, onToggleExpand, instrument, instruments, onInstrumentChange, light = false }) {
  const options = getVariationOptions(instrument);
  const [categories, setCategories] = useState(() => instrument ? [options[0][0]] : []), [seed, setSeed] = useState(1);
  const [selected, setSelected] = useState(null), [count, setCount] = useState(PAGE_SIZE);
  const [viewport, setViewport] = useState({ top: 0, height: 500, width: 300 });
  const root = useRef(null), audio = usePreviewAudio(), { stop } = audio;
  const columns = expanded && viewport.width >= 720 ? viewport.width >= 1150 ? 3 : 2 : 1;
  // Cache only a few deterministic pages. Returning to older rows regenerates
  // the same notation without retaining an unbounded number of SVGs or scores.
  const dataset = useMemo(() => ({ pages: new Map(), score, categories, seed, instrument }), [score, categories, seed, instrument]);
  const pages = dataset.pages;
  function getPage(index) {
    if (!pages.has(index)) {
      const rows = rhythmVariations(score, categories, PAGE_SIZE, seededRandom(seed * 100003 + index * 7919), instrument);
      if (pages.size >= 8) pages.delete(pages.keys().next().value);
      pages.set(index, rows);
    }
    return pages.get(index);
  }
  const initial = getPage(0);
  useEffect(() => {
    if (initial.length && Math.ceil(count / columns) * ROW_HEIGHT < viewport.height + ROW_HEIGHT) setCount((value) => value + PAGE_SIZE);
  }, [initial.length, count, columns, viewport.height]);
  useEffect(() => {
    setSelected(null); setCount(PAGE_SIZE); stop();
    if (root.current) root.current.scrollTop = 0;
    setViewport((value) => ({ ...value, top: 0 }));
  }, [score, categories, seed, stop]);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setViewport((value) => ({ ...value, width: entry.contentRect.width, height: entry.contentRect.height })));
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  function toggle(category) {
    if (!categories.includes(category) && categories.length >= MAX_VARIATION_TYPES) return;
    onSelect(null); setCategories((values) => values.includes(category) ? values.filter((value) => value !== category) : values.length < MAX_VARIATION_TYPES ? [...values, category] : values);
  }
  const start = Math.max(0, Math.floor(viewport.top / ROW_HEIGHT) - 2) * columns;
  const end = Math.min(count, (Math.ceil((viewport.top + viewport.height) / ROW_HEIGHT) + 2) * columns);
  const visible = [];
  for (let index = start; index < end && initial.length; index++) {
    const rows = getPage(Math.floor(index / PAGE_SIZE));
    const variation = rows[index % PAGE_SIZE % rows.length] || initial[index % initial.length];
    visible.push({ ...variation, number: index + 1, index });
  }
  const label = categories.map((category) => options.find(([key]) => key === category)[1].toLowerCase()).join(" + ");
  return <div className={`${styles.browser} ${light ? styles.light : ""}`} data-variation-browser>
    <div className={styles.heading}><span>{instrument ? `${instrumentLabel(instrument)} variations` : "Variations"}</span><div>
      <button onClick={() => { onSelect(null); setSeed((value) => value + 1); }} aria-label="Shuffle new variations" title="Start a fresh set"><FiRefreshCw /></button>
      <button onClick={onToggleExpand} aria-label={expanded ? "Restore variations" : "Maximize variations"} title={expanded ? "Restore" : "Maximize"}>{expanded ? <FiMinimize2 /> : <FiMaximize2 />}</button>
    </div></div>
    {instruments.length > 1 && <label className={styles.instrument}>Instrument <select value={instrument} onChange={(event) => onInstrumentChange(event.target.value)} aria-label="Variation instrument">{instruments.map((value) => <option key={value} value={value}>{instrumentLabel(value)}</option>)}</select></label>}
    <div className={styles.categories} role="group" aria-label="Variation types">
      {options.map(([key, name]) => <button key={key} aria-pressed={categories.includes(key)} disabled={!instrument || (!categories.includes(key) && categories.length >= MAX_VARIATION_TYPES)} onClick={() => toggle(key)}>{name}</button>)}
    </div>
    <p className={styles.hint}>Choose up to two {instrument === "drumset" ? "voices" : "types"} ({categories.length}/{MAX_VARIATION_TYPES}). {categories.length === MAX_VARIATION_TYPES ? "Deselect one to choose another." : "Scroll for more combinations."}</p>
    <div ref={root} className={styles.list} aria-label={`${label || "Rhythm"} variations`} data-variation-list data-generated-count={count} onScroll={(event) => {
      const { scrollTop, clientHeight, scrollHeight } = event.currentTarget;
      setViewport((value) => ({ ...value, top: scrollTop }));
      if (initial.length && scrollTop + clientHeight >= scrollHeight - ROW_HEIGHT * 2) setCount((value) => value + PAGE_SIZE);
    }}>
      {initial.length ? <div className={styles.virtualList} style={{ height: Math.ceil(count / columns) * ROW_HEIGHT }}>
        {visible.map((variation) => <article className={styles.card} data-variation-number={variation.number} data-selected={selected === variation.key} key={variation.index}
          style={{ top: Math.floor(variation.index / columns) * ROW_HEIGHT, left: `${variation.index % columns * 100 / columns}%`, width: `${100 / columns}%` }}>
          <div className={styles.cardInner}>
            <button className={styles.score} aria-label={`Preview ${label} variation ${variation.number}`} aria-pressed={selected === variation.key} onClick={() => { stop(); setSelected(variation.key); onSelect(variation); }}>
              <VariationNotation score={score} measure={variation.measure} />
              <span>Variation {variation.number}{score.measures.length > 1 ? ` · Measure ${variation.measureIndex + 1}` : ""}</span>
            </button>
            <div className={styles.actions}>
              <button aria-label={`${audio.playing === variation.key ? "Stop" : "Play"} variation ${variation.number}`} onClick={() => { setSelected(variation.key); onSelect(variation); audio.play(variation.key, { ...score, measures: [variation.measure] }, tempo); }}>{audio.playing === variation.key ? <FiSquare /> : <FiPlay />}</button>
              {renderAction?.(variation)}
            </div>
          </div>
        </article>)}
      </div> : <p className={styles.empty}>{categories.length ? "No variations fit these notes. Try fewer types, or add notes to the measure." : "Choose at least one type to start exploring."}</p>}
      {initial.length > 0 && <button className={styles.more} onClick={() => setCount((value) => value + PAGE_SIZE)}>More variations</button>}
    </div>
    {audio.error && <p role="alert" className={styles.error}>{audio.error}</p>}
    <span className={styles.footnote}>Small patterns may recur as you keep exploring.</span>
  </div>;
}
