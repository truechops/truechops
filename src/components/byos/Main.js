import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { useRouter } from "next/router";
import { FiArrowUp, FiArrowUpRight, FiBookOpen, FiChevronDown, FiChevronUp, FiGrid, FiPlus, FiX } from "react-icons/fi";
import { scoreActions } from "../../store/score";
import { buildByosScore, byosLetters, BYOS_PHRASE_LIMIT, BYOS_TEMPO } from "../../lib/byos";
import byosAlphabet from "../../../data/byos/alphabet/all";
import RhythmPreview from "../book-builder/RhythmPreview";
import { Shell } from "../social/shared";
import LegendDialog from "./legend-dialog";
import libraryStyles from "../practice/practice.module.css";
import styles from "./byos.module.css";

function LetterCard({ rhythm, used, disabled, onAdd }) {
  const root = useRef(null);
  const [visible, setVisible] = useState(false);
  const letter = rhythm.name.toUpperCase();
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "250px" });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  return <button ref={root} type="button" className={styles.letterCard} data-used={used} disabled={disabled} onClick={onAdd} aria-label={`Add ${letter} to phrase`}>
    <span className={styles.cardTop}><span className={styles.letter}>{letter}</span><span className={styles.cardAction}>Add <FiPlus aria-hidden="true" /></span></span>
    <div className={styles.cardNotation} role="img" aria-label={`Rhythm for ${letter}`}>
      {visible && <RhythmPreview score={rhythm.score} minWidth={260} fit compact maxHeight="110px" />}
    </div>
  </button>;
}

export default function Main() {
  const [word, setWord] = useState("");
  const [alphabetShown, setAlphabetShown] = useState(true), [legendOpen, setLegendOpen] = useState(false);
  const [opening, setOpening] = useState(false), [error, setError] = useState("");
  const [controlsAbove, setControlsAbove] = useState(false);
  const input = useRef(null), controls = useRef(null), router = useRouter(), dispatch = useDispatch();
  const score = useMemo(() => buildByosScore(word), [word]);
  const usedLetters = new Set(byosLetters(word));
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setControlsAbove(entry.boundingClientRect.bottom < 64), { rootMargin: "-64px 0px 0px" });
    observer.observe(controls.current);
    return () => observer.disconnect();
  }, []);
  function changeWord(value) { setWord(value.slice(0, BYOS_PHRASE_LIMIT)); setError(""); }
  async function practice(event) {
    event.preventDefault();
    if (!score || opening) return;
    setOpening(true); setError("");
    try {
      dispatch(scoreActions.updateScore({ score, name: word.trim(), tempo: BYOS_TEMPO, mutations: [] }));
      await router.push("/");
    } catch { setError("Could not open your rhythm. Please try again."); }
    finally { setOpening(false); }
  }
  return <Shell title="BYOS" description="Turn words into rhythms with the BYOS alphabet. Build a phrase and practice it in Score." className={styles.page}>
    <header className={libraryStyles.heading}>
      <div><p className={libraryStyles.eyebrow}>Practice library</p><h1>BYOS</h1><p className={libraryStyles.description}>Your words. Your rhythm. Build a phrase with the BYOS alphabet.</p></div>
      <span className={libraryStyles.headingIcon} aria-hidden="true"><FiGrid /></span>
    </header>
    <section className={styles.builder} aria-label="Phrase builder">
      <form ref={controls} className={styles.builderControls} onSubmit={practice}>
        <div className={styles.labelRow}><label htmlFor="byosWord">Your phrase</label><span className={styles.counter}>{word.length} / {BYOS_PHRASE_LIMIT}</span></div>
        <div className={styles.inputRow}>
          <div className={styles.inputWrap}><input ref={input} id="byosWord" type="text" value={word} maxLength={BYOS_PHRASE_LIMIT} onChange={(event) => changeWord(event.target.value)} placeholder="Type a word, like howdy" autoComplete="off" spellCheck={false} aria-describedby="byos-phrase-help" />
            {word && <button type="button" className={styles.clear} aria-label="Clear phrase" onClick={() => { changeWord(""); input.current?.focus(); }}><FiX aria-hidden="true" /></button>}
          </div>
          <button type="submit" className={styles.practice} disabled={!score || opening}>{opening ? "Opening…" : "Open in score"}<FiArrowUpRight aria-hidden="true" /></button>
        </div>
        <p className={styles.help} id="byos-phrase-help">Type A–Z or add letters below. Spaces, numbers, and punctuation are skipped.</p>
        {!word && <div className={styles.examples}><span>Try a phrase</span>{["HOWDY", "CHOPS", "GROOVE"].map((example) => <button type="button" key={example} onClick={() => changeWord(example)}>{example}</button>)}</div>}
        {error && <p className={styles.error} role="alert">{error}</p>}
      </form>
      <div className={styles.preview}>
        {score ? <><div className={styles.previewHeader}><h2>Your rhythm</h2><span className={styles.tempo}>{BYOS_TEMPO} BPM</span></div>
          <div className={styles.score} role="img" aria-label="Your BYOS rhythm"><RhythmPreview score={score} minWidth={260} fit compact /></div></> :
          <div className={styles.empty}><div className={styles.emptyLetters} aria-hidden="true"><span>A</span><span>B</span><span>C</span></div><h2>A little word. A new rhythm.</h2><p>{word ? "Add a letter from A–Z to start your rhythm." : "Your notation will appear here as you build your phrase."}</p></div>}
      </div>
    </section>
    <div className={styles.alphabetHeader}>
      <div><h2 id="byos-alphabet-title">The alphabet</h2><p>26 letters. Choose one to add its rhythm to your phrase.</p></div>
      <div className={styles.alphabetActions}>
        <button onClick={() => setLegendOpen(true)}><FiBookOpen aria-hidden="true" />Notation guide</button>
        <button onClick={() => setAlphabetShown((shown) => !shown)} aria-expanded={alphabetShown} aria-controls="byos-alphabet">{alphabetShown ? "Hide alphabet" : "Show alphabet"}{alphabetShown ? <FiChevronUp aria-hidden="true" /> : <FiChevronDown aria-hidden="true" />}</button>
      </div>
    </div>
    {alphabetShown && <section id="byos-alphabet" className={styles.alphabet} aria-labelledby="byos-alphabet-title">
      {byosAlphabet.map((rhythm) => <LetterCard key={rhythm.id} rhythm={rhythm} used={usedLetters.has(rhythm.name)} disabled={word.length >= BYOS_PHRASE_LIMIT || opening} onAdd={() => changeWord(word + rhythm.name.toUpperCase())} />)}
    </section>}
    {controlsAbove && score && <aside className={styles.phraseDock} aria-label="Phrase quick actions">
      <button className={styles.phraseJump} aria-label="Back to phrase" onClick={() => { controls.current?.scrollIntoView({ block: "center" }); input.current?.focus({ preventScroll: true }); }}>
        <FiArrowUp aria-hidden="true" /><span><small>Your phrase</small><strong aria-live="polite">{word.trim()}</strong></span>
      </button>
      <button className={styles.practice} onClick={practice} disabled={opening}>{opening ? "Opening…" : "Open in score"}<FiArrowUpRight aria-hidden="true" /></button>
    </aside>}
    <LegendDialog open={legendOpen} onClose={() => setLegendOpen(false)} />
  </Shell>;
}
