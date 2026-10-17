import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { FiBookmark, FiArrowUpRight, FiLock, FiPlay, FiHeadphones } from "react-icons/fi";
import { scoreActions } from "../../store/score";
import RhythmPreview from "../book-builder/RhythmPreview";
import { socialRequest } from "./api";
import { Avatar, useAccount } from "./shared";
import styles from "./social.module.css";

export function RhythmActions({ rhythm, onSaved, full = false, action = "practice" }) {
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
  if (action === "save" && rhythm.isOwner) return null;
  return <div className={action === "save" ? styles.saveAction : styles.actionArea}><div className={styles.actions}>
    {action === "practice" ? <button className={styles.practiceButton} onClick={practice} disabled={Boolean(busy)}>{busy === "practice" ? "Opening..." : "Open in score"}<FiArrowUpRight aria-hidden="true" /></button> : user ?
      <button onClick={save} disabled={Boolean(busy)} aria-pressed={saved} className={`${saved ? styles.saved : ""} ${styles.iconAction}`} title={saved ? "Remove from saved rhythms" : "Save rhythm"}><FiBookmark aria-hidden="true" /><span className={styles.srOnly}>{busy === "save" ? "Saving..." : saved ? "Saved" : "Save rhythm"}</span></button>
      : <a className={styles.iconAction} href={`/api/auth/google?returnTo=${encodeURIComponent(router.asPath)}`} title="Sign in to save"><FiBookmark aria-hidden="true" /><span className={styles.srOnly}>Sign in to save</span></a>}
  </div>{error && <p role="alert" className={styles.inlineError}>{error}</p>}</div>;
}
export default function RhythmCard({ rhythm, onOpen }) {
  const video = rhythm.media?.find((item) => item.kind === "video" && item.status === "ready");
  const audio = rhythm.media?.some((item) => item.kind === "audio" && item.status === "ready");
  const [thumbnailFailed,setThumbnailFailed] = useState(false);
  useEffect(() => setThumbnailFailed(false),[video?.thumbnailUrl]);
  const previewScore = useMemo(() => ({ ...rhythm.score, measures: rhythm.score.measures.slice(0,1) }),[rhythm.score]);
  const notationLabel = `${rhythm.matchMeasureIndex != null ? "Matching notation from" : "First measure of"} ${rhythm.name}`;
  return <article className={styles.exerciseCard}>
    <Link href={`/rhythms/${rhythm.id}`} onClick={onOpen ? (event) => onOpen(event,rhythm) : undefined} className={styles.exerciseLink} aria-label={`Open ${rhythm.name}`}>
      <div className={`${styles.exercisePreview} ${video ? styles.videoPreview : ""}`}>
        {video ? video.thumbnailUrl && !thumbnailFailed ? <img src={video.thumbnailUrl} alt={`Video demonstration of ${rhythm.name}`} loading="lazy" onError={() => setThumbnailFailed(true)} /> : <span className={styles.videoPlaceholder}>Video demonstration</span> :
          <div role="img" aria-label={notationLabel}><RhythmPreview score={previewScore} minWidth={260} fit compact /></div>}
        {video ? <span className={styles.mediaBadge}><FiPlay aria-hidden="true" /><span className={styles.srOnly}>Video</span></span> :
          audio && <span className={styles.mediaBadge}><FiHeadphones aria-hidden="true" /><span className={styles.srOnly}>Audio recording</span></span>}
      </div>
      {video && <div className={styles.cardNotation} role="img" aria-label={notationLabel}><RhythmPreview score={previewScore} minWidth={260} fit compact maxHeight="86px" /></div>}
      <div className={styles.exerciseCaption}><h2>{rhythm.name}</h2>
        <div className={styles.exerciseBadges}><span data-instrument>{rhythm.instruments.map((name) => name === "drumset" ? "Drum set" : name).join(" / ")}</span>
          {rhythm.visibility === "private" && <span><FiLock aria-hidden="true" /> Private</span>}
          <span className={styles.exerciseTempo}>{rhythm.tempo} BPM</span>
        </div>
      </div>
    </Link>
  </article>;
}
export function PersonCard({ profile, compact = false }) {
  return <article className={`${styles.personCard} ${compact ? styles.compactPerson : ""}`}><Link href={`/u/${profile.handle}`} className={styles.personIdentity}><Avatar profile={profile} large /><div><h2>{profile.displayName}</h2><span>@{profile.handle}</span></div><FiArrowUpRight aria-hidden="true" /></Link>
    {!compact && <><p>{profile.bio || ""}</p><div className={styles.tags}>{profile.instruments.map((instrument) => <span key={instrument}>{instrument}</span>)}</div></>}
  </article>;
}
