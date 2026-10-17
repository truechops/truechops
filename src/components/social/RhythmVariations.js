import { useState } from "react";
import { FiBookmark, FiCheck } from "react-icons/fi";
import VariationBrowser from "../variations/VariationBrowser";
import { socialRequest } from "./api";
import styles from "./immersive.module.css";

export default function RhythmVariations({ rhythm, user, signIn, onSelect, onSaved, expanded, onToggleExpand }) {
  const [saved, setSaved] = useState({}), [busy, setBusy] = useState(""), [error, setError] = useState("");
  async function save(variation) {
    setBusy(variation.key); setError("");
    try {
      await socialRequest("rhythms", { method: "POST", body: {
        name: `${rhythm.name.slice(0, 80)} · variation`, score: variation.score, tempo: rhythm.tempo,
        tags: rhythm.tags || [], visibility: "private", mutations: [],
      } });
      setSaved((previous) => ({ ...previous, [variation.key]: true })); onSaved?.();
    } catch (failure) { setError(failure.message); }
    finally { setBusy(""); }
  }
  return <div className={styles.variations}>
    <VariationBrowser score={rhythm.score} tempo={rhythm.tempo} onSelect={(variation) => onSelect(variation?.score || null)}
      expanded={expanded} onToggleExpand={onToggleExpand} renderAction={(variation) => user ?
        <button aria-label={saved[variation.key] ? `Variation ${variation.number} saved` : `Save variation ${variation.number}`} disabled={Boolean(busy) || saved[variation.key]} onClick={() => save(variation)}>{saved[variation.key] ? <FiCheck /> : <FiBookmark />}</button>
        : <a href={signIn} aria-label="Sign in to save variation"><FiBookmark /></a>} />
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {Object.keys(saved).length > 0 && <p role="status" className={styles.panelNote}>Saved privately to your profile.</p>}
  </div>;
}
