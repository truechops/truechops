import { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { useRouter } from "next/router";
import { FiArrowUpRight, FiSearch, FiShuffle, FiX, FiLayers, FiActivity } from "react-icons/fi";
import { scoreActions } from "../../store/score";
import { DEFAULT_TEMPO } from "../../consts/score";
import { scrubTypename } from "../../helpers/mongodb";
import { mutate } from "../../services/mutate/mutate-service";
import { getScoreVoices } from "../../utils/score";
import RhythmPreview from "../book-builder/RhythmPreview";
import { Shell } from "../social/shared";
import styles from "./practice.module.css";

function Notation({ score, name }) {
  const root = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "250px" });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  return <div ref={root} className={styles.notation} role="img" aria-label={`Notation for ${name}`}>
    {visible && <RhythmPreview score={score} minWidth={280} fit compact maxHeight="140px" />}
  </div>;
}

export default function PracticeCatalog({ title, description, categories, drills = false }) {
  const dispatch = useDispatch(), router = useRouter();
  const [categoryIndex, setCategoryIndex] = useState(0), [query, setQuery] = useState("");
  const [variations, setVariations] = useState({}), [error, setError] = useState("");
  const [opening, setOpening] = useState(null);
  const category = categories[categoryIndex];
  const rhythms = category.rhythms.filter((rhythm) => rhythm.name.toLowerCase().includes(query.trim().toLowerCase()));
  const Icon = drills ? FiActivity : FiLayers;
  async function open(rhythm, key) {
    setOpening(key); setError("");
    try {
      dispatch(scoreActions.updateScore({ score: scrubTypename(variations[key] || rhythm.score), name: rhythm.name,
        tempo: rhythm.tempo ?? DEFAULT_TEMPO, mutations: rhythm.mutations || [] }));
      await router.push("/");
    } catch { setError("Could not open this rhythm. Please try again."); }
    finally { setOpening(null); }
  }
  function shuffle(rhythm, key) {
    try {
      const score = JSON.parse(JSON.stringify(variations[key] || rhythm.score));
      mutate(score, rhythm.mutations, 1, Object.keys(getScoreVoices(score)));
      setVariations((current) => ({ ...current, [key]: score })); setError("");
    } catch { setError("Could not shuffle this drill. You can still open the original in Score."); }
  }
  return <Shell title={title} description={description} className={styles.catalog}>
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}>Practice library</p><h1>{title}</h1><p className={styles.description}>{description}</p></div>
      <span className={styles.headingIcon} aria-hidden="true"><Icon /></span>
    </header>
    <div className={styles.controls}>
      <div className={styles.categories} role="group" aria-label={`${title} categories`}>
        {categories.map((item, index) => <button key={item.label} aria-pressed={categoryIndex === index} onClick={() => { setCategoryIndex(index); setQuery(""); setError(""); }}>
          {item.label}<span>{item.rhythms.length}</span>
        </button>)}
      </div>
      <div className={styles.search}><FiSearch aria-hidden="true" /><input type="search" aria-label={`Search ${title.toLowerCase()}`} placeholder={`Find a ${drills ? "drill" : "rudiment"}…`} value={query} onChange={(event) => setQuery(event.target.value)} />
        {query && <button onClick={() => setQuery("")} aria-label="Clear search"><FiX /></button>}
      </div>
    </div>
    <div className={styles.results}><span>{rhythms.length} {rhythms.length === 1 ? "rhythm" : "rhythms"}</span><span>Open a rhythm to practice in Score</span></div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <section className={styles.grid} aria-label={`${category.label} ${title.toLowerCase()}`}>
      {rhythms.map((rhythm) => {
        const key = `${categoryIndex}:${rhythm.id}`;
        return <article className={styles.card} key={key}>
          <div className={styles.cardTop}><span className={styles.category}>{category.label}</span><span className={styles.number}>{String(category.rhythms.indexOf(rhythm) + 1).padStart(2, "0")}</span></div>
          <button className={styles.previewButton} onClick={() => open(rhythm, key)} disabled={opening !== null} aria-label={`Open ${rhythm.name} in score`}>
            <Notation score={variations[key] || rhythm.score} name={rhythm.name} />
          </button>
          <div className={styles.cardBody}><h2>{rhythm.name}</h2>
            <div className={styles.cardActions}>
              <button className={styles.open} onClick={() => open(rhythm, key)} disabled={opening !== null}>{opening === key ? "Opening…" : "Open in score"}<FiArrowUpRight aria-hidden="true" /></button>
              {rhythm.mutations?.length > 0 && <button className={styles.shuffle} onClick={() => shuffle(rhythm, key)} title="Shuffle drill" aria-label={`Shuffle ${rhythm.name}`}><FiShuffle aria-hidden="true" /></button>}
              <span className={styles.tempo}>{rhythm.tempo ?? DEFAULT_TEMPO} BPM</span>
            </div>
          </div>
        </article>;
      })}
    </section>
    {!rhythms.length && <div className={styles.empty}><FiSearch aria-hidden="true" /><h2>No matching {title.toLowerCase()}</h2><p>Try another name or browse the full collection.</p><button onClick={() => setQuery("")}>Clear search</button></div>}
  </Shell>;
}
