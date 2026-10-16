import { useEffect, useMemo, useRef, useState } from "react";
import { FiBookmark, FiCheck, FiPlay, FiSquare, FiRefreshCw } from "react-icons/fi";
import RhythmPreview from "../book-builder/RhythmPreview";
import { rhythmVariations, VARIATION_CATEGORIES } from "../../services/rhythm-variations";
import { socialRequest } from "./api";
import usePreviewAudio from "./usePreviewAudio";
import styles from "./immersive.module.css";

export default function RhythmVariations({ rhythm, user, signIn, onSelect, onSaved }) {
  const [category, setCategory] = useState("stickings"), [batch, setBatch] = useState(0);
  const [selected, setSelected] = useState(null), [saved, setSaved] = useState({}), [busy, setBusy] = useState(""), [error, setError] = useState("");
  const audio = usePreviewAudio(), { stop } = audio, revision = useRef(0);
  const variations = useMemo(() => {
    let seed = batch + 1;
    return rhythmVariations(rhythm.score, category, 8, () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; });
  }, [rhythm.score, category, batch]);
  useEffect(() => {
    const current = ++revision.current;
    setSelected(null); setError(""); setBusy(""); stop();
    return () => { revision.current = current + 1; };
  }, [category, batch, stop]);
  async function save(variation, key) {
    const current = revision.current;
    setBusy(key); setError("");
    try {
      await socialRequest("rhythms", { method: "POST", body: {
        name: `${rhythm.name.slice(0, 72)} · ${category} variation`, score: variation.score, tempo: rhythm.tempo,
        tags: rhythm.tags || [], visibility: "private", mutations: [],
      } });
      if (revision.current === current) { setSaved((previous) => ({ ...previous, [key]: true })); onSaved?.(); }
    } catch (failure) { if (revision.current === current) setError(failure.message); }
    finally { if (revision.current === current) setBusy(""); }
  }
  return <div className={styles.variations}>
    <div className={styles.categories} role="group" aria-label="Variation type">
      {VARIATION_CATEGORIES.map(([key, label]) => <button key={key} aria-pressed={category === key} onClick={() => setCategory(key)}>{label}</button>)}
    </div>
    <div className={styles.variationIntro}><span>Shuffle one measure at a time</span><button onClick={() => setBatch((value) => value + 1)} aria-label="Shuffle new variations" title="Shuffle new variations"><FiRefreshCw /></button></div>
    <div className={styles.variationList} aria-label={`${category} variations`}>
      {variations.map((variation, index) => {
        const key = `${category}-${batch}-${index}`;
        return <article className={styles.variationCard} data-selected={selected === key} key={key}>
          <button className={styles.variationScore} aria-label={`Preview ${category} variation ${index + 1}`} aria-pressed={selected === key} onClick={() => { audio.stop(); setSelected(key); onSelect(variation.score); }}>
            <RhythmPreview score={{ ...variation.score, measures: [variation.score.measures[variation.measureIndex]] }} minWidth={200} fit compact maxHeight="100px" />
            <span>Variation {index + 1}</span>
          </button>
          <div className={styles.variationActions}>
            <button aria-label={`${audio.playing === key ? "Stop" : "Play"} variation ${index + 1}`} onClick={() => { setSelected(key); onSelect(variation.score); audio.play(key, variation.score, rhythm.tempo); }}>{audio.playing === key ? <FiSquare /> : <FiPlay />}</button>
            {user ? <button aria-label={saved[key] ? `Variation ${index + 1} saved` : `Save variation ${index + 1}`} disabled={Boolean(busy) || saved[key]} onClick={() => save(variation, key)}>{saved[key] ? <FiCheck /> : <FiBookmark />}</button> : <a href={signIn} aria-label="Sign in to save variation"><FiBookmark /></a>}
          </div>
        </article>;
      })}
      {!variations.length && <p className={styles.empty}>There are no different {category} to shuffle in this rhythm. Try another type.</p>}
    </div>
    {(error || audio.error) && <p role="alert" className={styles.error}>{error || audio.error}</p>}
    {Object.keys(saved).length > 0 && <p role="status" className={styles.panelNote}>Saved privately to your profile.</p>}
  </div>;
}
