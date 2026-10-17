import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { FiHeart, FiMessageCircle, FiX, FiTrash2, FiSend, FiLock, FiBookmark, FiLayers, FiArrowUpRight } from "react-icons/fi";
import { useDispatch } from "react-redux";
import { scoreActions } from "../../store/score";
import RhythmPreview from "../book-builder/RhythmPreview";
import RhythmDialog from "./RhythmDialog";
import RhythmMedia, { useMediaStatus } from "./RhythmMedia";
import YouTubeVideo from "./YouTubeVideo";
import { videoForRhythm } from "../../lib/social/youtube";
import RhythmVariations from "./RhythmVariations";
import { Avatar, Status, useAccount, useResource } from "./shared";
import { socialRequest } from "./api";
import styles from "./immersive.module.css";

export default function RhythmSlide({ id, active, onLoaded, onChanged, onClose }) {
  const router = useRouter(), dispatch = useDispatch(), { user, loaded } = useAccount();
  const resource = useResource(loaded && id ? `rhythms/${encodeURIComponent(id)}` : null, user?.id);
  const rhythm = resource.data?.rhythm, isPublic = rhythm?.visibility === "public";
  const engagement = useResource(isPublic && active ? `rhythms/${encodeURIComponent(id)}/engagement` : null, user?.id);
  const [panel, setPanel] = useState(null), [commentPage, setCommentPage] = useState(1);
  const comments = useResource(isPublic && active && panel === "comments" ? `rhythms/${encodeURIComponent(id)}/comments?page=${commentPage}` : null, user?.id);
  const [text, setText] = useState(""), [busy, setBusy] = useState(""), [error, setError] = useState(""), [notice, setNotice] = useState(""), [editing, setEditing] = useState(false);
  const [variation, setVariation] = useState(null);
  const [variationsExpanded, setVariationsExpanded] = useState(false);
  const [extraAudioOpen, setExtraAudioOpen] = useState(false);
  const revision = useRef(0), panelRef = useRef(null), commentsTrigger = useRef(null), variationsTrigger = useRef(null);
  useEffect(() => { if (rhythm) onLoaded?.(rhythm); }, [rhythm, onLoaded]);
  useEffect(() => {
    const current = ++revision.current;
    setText(""); setError(""); setNotice(""); setBusy(""); setEditing(false); setCommentPage(1); setPanel(null); setVariation(null);
    return () => { revision.current = current + 1; };
  }, [user?.id, id]);
  useEffect(() => { if (!active) { setPanel(null); setVariation(null); } }, [active]);
  useEffect(() => { if (panel !== "variations") setVariationsExpanded(false); }, [panel]);
  useEffect(() => { if (panel) panelRef.current?.focus({ preventScroll: true }); }, [panel]);
  const recordings = rhythm?.media || [];
  const video = videoForRhythm(rhythm);
  const audio = recordings.find((item) => item.status === "ready" && item.kind === "audio");
  const primaryRecording = video || audio;
  useMediaStatus(active ? rhythm : null, resource.refresh);
  const signIn = `/api/auth/google?returnTo=${encodeURIComponent(`/rhythms/${id}`)}`;
  function closePanel() {
    setPanel(null);
    setVariationsExpanded(false);
    requestAnimationFrame(() => (panel === "comments" ? commentsTrigger : variationsTrigger).current?.focus({ preventScroll: true }));
  }
  async function mutate(action, run) {
    const current = revision.current;
    setBusy(action); setError(""); setNotice("");
    try { const value = await run(); if (current === revision.current) return value; }
    catch (failure) { if (current === revision.current) setError(failure.message); }
    finally { if (current === revision.current) setBusy(""); }
  }
  async function like() {
    const value = await mutate("like", () => socialRequest(`rhythms/${id}/like`, { method: engagement.data?.liked ? "DELETE" : "PUT" }));
    if (value) engagement.update(() => value);
  }
  async function save() {
    const value = await mutate("save", () => socialRequest(`rhythms/${id}/save`, { method: rhythm.saved ? "DELETE" : "PUT" }));
    if (value) { resource.update((data) => ({ ...data, rhythm: { ...data.rhythm, saved: value.saved } })); onChanged?.(); setNotice(value.saved ? "Saved to your profile." : "Removed from saved rhythms."); }
  }
  async function comment(event) {
    event.preventDefault();
    const value = await mutate("comment", () => socialRequest(`rhythms/${id}/comments`, { method: "POST", body: { text } }));
    if (value) { setText(""); setCommentPage(1); comments.refresh(); engagement.update(() => value); }
  }
  async function removeComment(commentId) {
    const value = await mutate(commentId, () => socialRequest(`rhythms/${id}/comments/${commentId}`, { method: "DELETE" }));
    if (value) { comments.refresh(); engagement.update(() => value); }
  }
  async function practice() {
    await mutate("practice", async () => {
      dispatch(scoreActions.updateScore({ score: variation || rhythm.score, name: rhythm.name, tempo: rhythm.tempo, mutations: variation ? [] : rhythm.mutations || [] }));
      await router.push("/");
    });
  }
  async function share() {
    const ok = await mutate("share", async () => { await navigator.clipboard.writeText(`${window.location.origin}/rhythms/${id}`); return true; });
    if (ok) setNotice("Link copied.");
  }
  return <div className={`${styles.slide} ${panel ? styles.withPanel : ""}`}>
    {video?.thumbnailUrl && <div className={styles.ambience} style={{ backgroundImage: `url(${JSON.stringify(video.thumbnailUrl)})` }} aria-hidden="true" />}
    <Status error={resource.error} loading={!rhythm && !resource.error} retry={resource.refresh} />
    {rhythm && <>
      <header className={styles.metadata} inert={variationsExpanded ? "" : undefined}>
        <div className={styles.identity}>{rhythm.creator ? <Link href={`/u/${rhythm.creator.handle}`}><Avatar profile={rhythm.creator} /><span><strong>{rhythm.creator.displayName}</strong><small>@{rhythm.creator.handle}</small></span></Link> : <span>Your private composition</span>}</div>
        <h1 id={active ? "rhythm-post-title" : undefined}>{rhythm.name}</h1>
        <div className={styles.badges}><span data-instrument>{rhythm.instruments.map((instrument) => instrument === "drumset" ? "Drum set" : instrument).join(" / ")}</span><span>{rhythm.tempo} BPM</span>{!isPublic && <span><FiLock /> Private</span>}</div>
        {rhythm.tags?.length > 0 && <div className={styles.tags}>{rhythm.tags.map((tag) => <Link key={tag} href={`/discover?q=${encodeURIComponent(tag)}`}>#{tag}</Link>)}</div>}
        <div className={styles.metadataActions}><button className={styles.openScore} onClick={practice} disabled={Boolean(busy)}>Open in score <FiArrowUpRight /></button>{rhythm.isOwner && <button onClick={() => setEditing(true)}>Edit details</button>}</div>
        {(notice || error || engagement.error) && <div className={styles.feedback}>{notice && <p role="status">{notice}</p>}{(error || engagement.error) && <p role="alert">{error || engagement.error}{error.includes("public profile") && <> <Link href="/profile">Set up your profile</Link></>}</p>}</div>}
      </header>
      <section className={styles.content} aria-label="Exercise content" inert={variationsExpanded ? "" : undefined}>
        {primaryRecording && <div className={styles.video}>{active ? video?.provider === "youtube" ? <YouTubeVideo key={`${video.id}:${video.start}`} video={video} name={rhythm.name} /> : <RhythmMedia key={primaryRecording.id} rhythmId={rhythm.id} media={primaryRecording} /> : video?.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" loading="lazy" /> : null}</div>}
        <div className={`${styles.notation} ${!primaryRecording ? styles.notationOnly : ""}`}>
          {variation && <div className={styles.previewLabel}><span>Variation preview</span><button onClick={() => setVariation(null)}>Original rhythm</button></div>}
          <div role="img" aria-label="Exercise notation"><RhythmPreview score={variation || rhythm.score} minWidth={260} fit compact maxHeight={primaryRecording ? "min(180px, 22dvh)" : "65dvh"} /></div>
        </div>
        {video && audio && <details className={styles.extraAudio} onToggle={(event) => setExtraAudioOpen(event.currentTarget.open)}><summary>Audio recording</summary>{active && extraAudioOpen && <RhythmMedia rhythmId={rhythm.id} media={audio} />}</details>}
        {recordings.some((item) => ["uploading", "processing"].includes(item.status)) && <p className={styles.mediaStatus} role="status">Your recording is processing.</p>}
        {recordings.some((item) => item.status === "failed") && <p className={styles.mediaStatus} role="status">A recording couldn&apos;t be processed.{rhythm.isOwner && " Choose a new file in Edit details."}</p>}
      </section>
      <nav className={styles.rail} aria-label="Rhythm actions" inert={variationsExpanded ? "" : undefined}>
        {isPublic && <>{user ? <button onClick={like} aria-label={engagement.data?.liked ? "Unlike rhythm" : "Like rhythm"} aria-pressed={Boolean(engagement.data?.liked)} disabled={Boolean(busy) || !engagement.data}><FiHeart /><span>{engagement.data?.likeCount ?? 0}</span></button> : <a href={signIn} aria-label="Sign in to like"><FiHeart /><span>{engagement.data?.likeCount ?? 0}</span></a>}
          <button ref={commentsTrigger} onClick={() => panel === "comments" ? closePanel() : setPanel("comments")} aria-label="Comments" aria-expanded={panel === "comments"} aria-controls={`rhythm-panel-${id}`}><FiMessageCircle /><span>{engagement.data?.commentCount ?? 0}</span></button></>}
        <button ref={variationsTrigger} onClick={() => panel === "variations" ? closePanel() : setPanel("variations")} aria-label="Variations" aria-expanded={panel === "variations"} aria-controls={`rhythm-panel-${id}`}><FiLayers /><span>Variations</span></button>
        {rhythm.isOwner ? <Link href="/profile" aria-label="In your profile" title="This rhythm is already in your profile"><FiBookmark /><span>In profile</span></Link> : user ? <button onClick={save} disabled={Boolean(busy)} aria-label={rhythm.saved ? "Unsave rhythm" : "Save rhythm"} aria-pressed={Boolean(rhythm.saved)}><FiBookmark /><span>{rhythm.saved ? "Saved" : "Save"}</span></button> : <a href={signIn} aria-label="Sign in to save"><FiBookmark /><span>Save</span></a>}
        <button onClick={share} disabled={Boolean(busy)} aria-label="Copy rhythm link"><FiSend /><span>Share</span></button>
      </nav>
      {panel && <aside className={`${styles.panel} ${variationsExpanded ? styles.panelExpanded : ""}`} ref={panelRef} id={`rhythm-panel-${id}`} tabIndex={-1} aria-label={panel === "comments" ? "Comments panel" : "Variations panel"} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closePanel(); } }}>
        <div className={styles.panelHeader}><div>{isPublic && <button onClick={() => setPanel("comments")} aria-pressed={panel === "comments"}><FiMessageCircle /> Comments {engagement.data ? `(${engagement.data.commentCount})` : ""}</button>}<button onClick={() => setPanel("variations")} aria-pressed={panel === "variations"}><FiLayers /> Variations</button></div><button onClick={closePanel} aria-label="Close side panel"><FiX /></button></div>
        {panel === "variations" ? <RhythmVariations rhythm={rhythm} user={user} signIn={signIn} onSelect={setVariation} onSaved={onChanged} expanded={variationsExpanded} onToggleExpand={() => setVariationsExpanded((value) => !value)} /> : <>
          <div className={styles.comments}>
            <Status error={comments.error} loading={!comments.data && !comments.error} retry={comments.refresh} />
            {comments.data?.items.map((entry) => <article className={styles.comment} key={entry.id}><Avatar profile={entry.author} /><div><div className={styles.commentByline}>{entry.author ? <Link href={`/u/${entry.author.handle}`}><strong>{entry.author.handle || entry.author.displayName}</strong></Link> : <strong>Community member</strong>}<time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time></div><p>{entry.text}</p></div>{entry.canDelete && <button disabled={Boolean(busy)} onClick={() => removeComment(entry.id)} aria-label="Delete comment"><FiTrash2 /></button>}</article>)}
            {comments.data && !comments.data.items.length && <p className={styles.empty}>Be the first to comment.</p>}
            {(commentPage > 1 || comments.data?.hasMore) && <div className={styles.commentPages}><button disabled={commentPage <= 1} onClick={() => setCommentPage((value) => value - 1)}>Newer</button><span>Page {commentPage}</span><button disabled={!comments.data?.hasMore} onClick={() => setCommentPage((value) => value + 1)}>Older</button></div>}
          </div>
          {user ? <form className={styles.commentForm} onSubmit={comment}><Avatar profile={{ displayName: user.name }} /><div><label className={styles.srOnly} htmlFor={`new-comment-${id}`}>Add a comment</label><textarea id={`new-comment-${id}`} rows={1} maxLength={1000} value={text} onChange={(event) => setText(event.target.value)} placeholder="Add a comment..." required /><button disabled={!text.trim() || Boolean(busy)}>{busy === "comment" ? "Posting…" : "Post"}</button></div></form> : <p className={styles.panelNote}><a href={signIn}>Sign in</a> to comment and save rhythms.</p>}
        </>}
      </aside>}
    </>}
    {editing && <RhythmDialog rhythm={rhythm} onClose={() => setEditing(false)} onSaved={(saved) => { setEditing(false); onChanged?.(); if (saved) resource.refresh(); else onClose(); }} />}
  </div>;
}
