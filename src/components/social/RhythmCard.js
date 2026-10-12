import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { FiBookmark, FiCheck, FiArrowUpRight, FiLock } from "react-icons/fi";
import { scoreActions } from "../../store/score";
import RhythmPreview from "../book-builder/RhythmPreview";
import { socialRequest } from "./api";
import { Avatar, useAccount } from "./shared";
import styles from "./social.module.css";

export function RhythmActions({ rhythm, onSaved, onEdit, full = false, compact = false }) {
  const { user } = useAccount(), router = useRouter(), dispatch = useDispatch();
  const [saved,setSaved] = useState(rhythm.saved), [busy,setBusy] = useState(""), [error,setError] = useState("");
  async function save() {
    setBusy("save"); setError("");
    try { const result = await socialRequest(`rhythms/${rhythm.id}/save`,{ method: saved ? "DELETE" : "PUT" }); setSaved(result.saved); onSaved?.(result.saved); }
    catch (failure) { setError(failure.message); } finally { setBusy(""); }
  }
  async function practice() {
    setBusy("practice"); setError("");
    try {
      const data = full ? rhythm : (await socialRequest(`rhythms/${rhythm.id}`)).rhythm;
      dispatch(scoreActions.updateScore({ score: data.score, name: data.name, tempo: data.tempo, mutations: data.mutations || [] }));
      await router.push("/");
    } catch (failure) { setError(failure.message); } finally { setBusy(""); }
  }
  return <div className={styles.actionArea}><div className={styles.actions}>
    <button className={styles.practiceButton} onClick={practice} disabled={Boolean(busy)}>{busy === "practice" ? "Opening..." : "Practice"}<FiArrowUpRight aria-hidden="true" /></button>
    {rhythm.isOwner ? <button onClick={onEdit} disabled={Boolean(busy)}>Edit details</button> : user ?
      <button onClick={save} disabled={Boolean(busy)} aria-pressed={saved} className={`${saved ? styles.saved : ""} ${compact ? styles.iconAction : ""}`} title={saved ? "Remove from saved rhythms" : "Save rhythm"}>{saved ? <FiCheck aria-hidden="true" /> : <FiBookmark aria-hidden="true" />}<span className={compact ? styles.srOnly : undefined}>{busy === "save" ? "Saving..." : saved ? "Saved" : "Save rhythm"}</span></button>
      : <a className={compact ? styles.iconAction : undefined} href={`/api/auth/google?returnTo=${encodeURIComponent(router.asPath)}`} title="Sign in to save"><FiBookmark aria-hidden="true" /><span className={compact ? styles.srOnly : undefined}>Sign in to save</span></a>}
  </div>{error && <p role="alert" className={styles.inlineError}>{error}</p>}</div>;
}
export default function RhythmCard({ rhythm, onEdit, onSaved, compact = false }) {
  const previewScore = useMemo(() => compact ? { ...rhythm.score, measures: rhythm.score.measures.slice(0,1) } : rhythm.score,[compact,rhythm.score]);
  return <article className={`${styles.rhythmCard} ${compact ? styles.compactCard : ""}`}>
    <div className={styles.cardHeading}><span className={styles.eyebrow}>{rhythm.instruments.join(" / ") || "Rhythm"}</span>
      {rhythm.visibility === "private" && <span className={styles.private}><FiLock aria-hidden="true" />Private</span>}
      {rhythm.difficulty && <span className={styles.difficulty}>{rhythm.difficulty}</span>}</div>
    <h2><Link href={`/rhythms/${rhythm.id}`}>{rhythm.name}</Link></h2>
    <div className={styles.byline}>{rhythm.creator ? <Link href={`/u/${rhythm.creator.handle}`}><Avatar profile={rhythm.creator} />{rhythm.creator.displayName}</Link> : <span>Your composition</span>}
      <span>{rhythm.tempo} BPM <span aria-hidden="true">/</span> {rhythm.measureCount} {rhythm.measureCount === 1 ? "bar" : "bars"}</span></div>
    <div className={styles.notation} role="img" aria-label={`Notation preview of ${rhythm.name}, first ${compact ? "measure" : `${Math.min(2,rhythm.measureCount)} measures`}`}><RhythmPreview score={previewScore} minWidth={260} /></div>
    {!compact && rhythm.description && <p className={styles.cardDescription}>{rhythm.description}</p>}
    {!compact && <div className={styles.tags}>{rhythm.tags.map((tag) => <Link key={tag} href={{ pathname: "/search", query: { q: tag } }}>#{tag}</Link>)}</div>}
    <RhythmActions key={`${rhythm.id}-${rhythm.saved}`} rhythm={rhythm} onEdit={() => onEdit?.(rhythm)} onSaved={onSaved} compact={compact} />
  </article>;
}
export function PersonCard({ profile, compact = false }) {
  return <article className={`${styles.personCard} ${compact ? styles.compactPerson : ""}`}><Link href={`/u/${profile.handle}`} className={styles.personIdentity}><Avatar profile={profile} large /><div><h2>{profile.displayName}</h2><span>@{profile.handle}</span></div><FiArrowUpRight aria-hidden="true" /></Link>
    {!compact && <><p>{profile.bio || ""}</p><div className={styles.tags}>{profile.instruments.map((instrument) => <span key={instrument}>{instrument}</span>)}</div></>}
  </article>;
}
