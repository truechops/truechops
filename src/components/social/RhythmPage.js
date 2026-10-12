import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import RhythmPreview from "../book-builder/RhythmPreview";
import { RhythmActions } from "./RhythmCard";
import RhythmDialog from "./RhythmDialog";
import { Shell, Avatar, Status, useAccount, useResource } from "./shared";
import styles from "./social.module.css";

export default function RhythmPage() {
  const router = useRouter(), { user,loaded } = useAccount();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const { data,error,refresh } = useResource(router.isReady && loaded && id ? `rhythms/${encodeURIComponent(id)}` : null,user?.id);
  const [editing,setEditing] = useState(false), [notice,setNotice] = useState("");
  useEffect(() => { setEditing(false); setNotice(""); },[user?.id,id]);
  const rhythm = data?.rhythm;
  async function share() {
    try { await navigator.clipboard.writeText(window.location.href); setNotice("Link copied."); }
    catch { setNotice("Copy the address from your browser to share this rhythm."); }
  }
  return <Shell title={rhythm?.name || "Rhythm"}>
    <Link href="/discover" className={styles.back}>← Back to the community</Link>
    <Status error={error} loading={!data && !error} retry={refresh} />
    {rhythm && <article className={styles.detail}><p className={styles.eyebrow}>{rhythm.instruments.join(" / ")} · {rhythm.difficulty || "Rhythm study"}</p><h1>{rhythm.name}</h1>
      <div className={styles.byline}>{rhythm.creator && <Link href={`/u/${rhythm.creator.handle}`}><Avatar profile={rhythm.creator} />{rhythm.creator.displayName}</Link>}<span>{rhythm.tempo} BPM / {rhythm.measureCount} bars</span></div>
      {rhythm.visibility === "private" && <p className={styles.hint}>Private rhythm. Only you can view this page.</p>}
      {rhythm.description && <p className={styles.description}>{rhythm.description}</p>}
      <div className={styles.detailNotation} role="img" aria-label={`Complete notation for ${rhythm.name}`}><RhythmPreview score={rhythm.score} minWidth={260} /></div>
      <div className={styles.tags}>{rhythm.tags.map((tag) => <Link key={tag} href={{ pathname: "/discover", query: { q: tag } }}>#{tag}</Link>)}</div>
      <RhythmActions key={`${user?.id}-${rhythm.id}-${rhythm.saved}`} rhythm={rhythm} full onEdit={() => setEditing(true)} />
      {rhythm.visibility === "public" && <button className={styles.share} onClick={share}>Copy rhythm link</button>}
      <p className={styles.hint}>Practice opens the complete rhythm in the composer, ready to play and develop.</p>
      {notice && <p role="status" className={styles.notice}>{notice}</p>}
    </article>}
    {editing && <RhythmDialog rhythm={rhythm} onClose={() => setEditing(false)} onSaved={(saved) => { setEditing(false); if (saved) refresh(); else router.push("/profile"); }} />}
  </Shell>;
}
