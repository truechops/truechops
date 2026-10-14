import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Dialog from "@mui/material/Dialog";
import { FiHeart, FiMessageCircle, FiX, FiTrash2, FiSend, FiLock } from "react-icons/fi";
import RhythmPreview from "../book-builder/RhythmPreview";
import RhythmDialog from "./RhythmDialog";
import RhythmMedia, { useMediaStatus } from "./RhythmMedia";
import { RhythmActions } from "./RhythmCard";
import { Avatar, Status, useAccount, useResource } from "./shared";
import { socialRequest } from "./api";
import styles from "./social.module.css";

export function useRhythmModal(onChanged) {
  const router = useRouter(), opened = useRef(false);
  const id = typeof router.query.rhythm === "string" ? router.query.rhythm : "";
  useEffect(() => { if (!id) opened.current = false; },[id]);
  function open(event,rhythm) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); opened.current = true;
    router.push({ pathname: router.pathname, query: { ...router.query, rhythm: rhythm.id } },undefined,{ shallow: true, scroll: false });
  }
  function close() {
    if (opened.current) { router.back(); return; }
    const query = { ...router.query };
    delete query.rhythm;
    router.replace({ pathname: router.pathname, query },undefined,{ shallow: true, scroll: false });
  }
  return { open, element: <Dialog open={Boolean(id)} onClose={close} maxWidth={false} className={styles.socialDialog}
    PaperProps={{ className: styles.postModal }} aria-labelledby="rhythm-post-title">
    {id && <RhythmPost key={id} id={id} onClose={close} onChanged={onChanged} />}
  </Dialog> };
}

export default function RhythmPost({ id, onClose, onChanged }) {
  const router = useRouter(), { user,loaded } = useAccount();
  const resource = useResource(loaded && id ? `rhythms/${encodeURIComponent(id)}` : null,user?.id);
  const rhythm = resource.data?.rhythm, isPublic = rhythm?.visibility === "public";
  const engagement = useResource(isPublic ? `rhythms/${encodeURIComponent(id)}/engagement` : null,user?.id);
  const [commentPage,setCommentPage] = useState(1);
  const comments = useResource(isPublic ? `rhythms/${encodeURIComponent(id)}/comments?page=${commentPage}` : null,user?.id);
  const [text,setText] = useState(""), [busy,setBusy] = useState(""), [error,setError] = useState(""), [notice,setNotice] = useState(""), [editing,setEditing] = useState(false);
  const input = useRef(null), revision = useRef(0);
  useEffect(() => {
    revision.current++;
    setText(""); setError(""); setNotice(""); setBusy(""); setEditing(false); setCommentPage(1);
    return () => { revision.current++; };
  },[user?.id,id]);
  const recordings = rhythm?.media || [];
  const video = recordings.find((item) => item.status === "ready" && item.kind === "video");
  const audio = recordings.find((item) => item.status === "ready" && item.kind === "audio");
  const primaryRecording = video || audio;
  useMediaStatus(rhythm,resource.refresh);
  const signIn = `/api/auth/google?returnTo=${encodeURIComponent(router.asPath)}`;
  async function mutate(action,run) {
    const current = revision.current;
    setBusy(action); setError(""); setNotice("");
    try { const value = await run(); if (current !== revision.current) return; return value; }
    catch (failure) { if (current === revision.current) setError(failure.message); }
    finally { if (current === revision.current) setBusy(""); }
  }
  async function like() {
    const value = await mutate("like",() => socialRequest(`rhythms/${id}/like`,{ method: engagement.data?.liked ? "DELETE" : "PUT" }));
    if (value) engagement.update(() => value);
  }
  async function comment(event) {
    event.preventDefault();
    const value = await mutate("comment",() => socialRequest(`rhythms/${id}/comments`,{ method: "POST", body: { text } }));
    if (value) { setText(""); setCommentPage(1); comments.refresh(); engagement.update(() => value); }
  }
  async function removeComment(commentId) {
    const value = await mutate(commentId,() => socialRequest(`rhythms/${id}/comments/${commentId}`,{ method: "DELETE" }));
    if (value) { comments.refresh(); engagement.update(() => value); }
  }
  async function share() {
    await mutate("share",async () => { await navigator.clipboard.writeText(`${window.location.origin}/rhythms/${id}`); return true; }).then((ok) => { if (ok) setNotice("Link copied."); });
  }
  return <div className={styles.post}>
    {onClose && <button className={styles.closePost} onClick={onClose} aria-label="Close rhythm"><FiX aria-hidden="true" /></button>}
    <Status error={resource.error} loading={!rhythm && !resource.error} retry={resource.refresh} />
    {rhythm && <>
      <section className={styles.postScore} aria-label="Exercise content">
        {primaryRecording && <div className={styles.postVideo}><RhythmMedia key={primaryRecording.id} rhythmId={rhythm.id} media={primaryRecording} /></div>}
        <div className={`${styles.postNotation} ${!primaryRecording ? styles.notationOnly : ""}`} role="img" aria-label="Exercise notation"><RhythmPreview score={rhythm.score} minWidth={260} fit compact maxHeight={primaryRecording ? "min(210px, 28dvh)" : "min(560px, 65dvh)"} /></div>
        {video && audio && <details className={styles.additionalRecording}><summary>Audio recording</summary><RhythmMedia key={audio.id} rhythmId={rhythm.id} media={audio} /></details>}
        {recordings.some((item) => ["uploading","processing"].includes(item.status)) && <p role="status">Your recording is processing. It will appear here when ready.</p>}
        {recordings.some((item) => item.status === "failed") && <p role="status">A recording couldn&apos;t be processed.{rhythm.isOwner && " Choose a new file in Edit details."}</p>}
      </section>
      <section className={styles.postConversation} aria-label="Rhythm details and conversation">
        <header className={styles.postIdentity}>
          {rhythm.creator ? <Link href={`/u/${rhythm.creator.handle}`}><Avatar profile={rhythm.creator} /><span><strong>{rhythm.creator.displayName}</strong><small>@{rhythm.creator.handle}</small></span></Link> : <span>Your private composition</span>}
          {rhythm.isOwner && <button onClick={() => setEditing(true)}>Edit details</button>}
        </header>
        <div className={styles.postSummary}>
          <div><h1 id="rhythm-post-title">{rhythm.name}</h1>
            <div className={styles.postBadges}><span data-instrument>{rhythm.instruments.map((instrument) => instrument === "drumset" ? "Drum set" : instrument).join(" / ")}</span><span>{rhythm.tempo} BPM</span>{!isPublic && <span><FiLock aria-hidden="true" /> Private</span>}</div>
          </div>
          <RhythmActions rhythm={rhythm} full />
        </div>
        {isPublic ? <section className={styles.postComments} aria-labelledby="rhythm-comments-title">
          <h2 id="rhythm-comments-title">Comments{engagement.data && ` (${engagement.data.commentCount})`}</h2>
          <div className={styles.commentList}>
            <Status error={comments.error} loading={!comments.data && !comments.error} retry={comments.refresh} />
            {comments.data?.items.map((entry) => <article className={styles.comment} key={entry.id}>
              <Avatar profile={entry.author} /><div>
                <div className={styles.commentByline}>{entry.author ? <Link href={`/u/${entry.author.handle}`}><strong>{entry.author.handle || entry.author.displayName}</strong></Link> : <strong>Community member</strong>}
                  <time dateTime={entry.createdAt} title={new Date(entry.createdAt).toLocaleString()}>{new Date(entry.createdAt).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</time>
                </div><p>{entry.text}</p>
              </div>
              {entry.canDelete && <button disabled={Boolean(busy)} onClick={() => removeComment(entry.id)} aria-label="Delete comment"><FiTrash2 aria-hidden="true" /></button>}
            </article>)}
            {comments.data && !comments.data.items.length && <p className={styles.commentEmpty}>Be the first to comment.</p>}
            {(commentPage > 1 || comments.data?.hasMore) && <div className={styles.commentPages}>
              <button disabled={commentPage <= 1} onClick={() => setCommentPage((value) => value-1)}>Newer</button><span>Page {commentPage}</span>
              <button disabled={!comments.data?.hasMore} onClick={() => setCommentPage((value) => value+1)}>Older</button>
            </div>}
          </div>
        </section> : <p className={styles.privatePost}><FiLock aria-hidden="true" /> Only you can see this rhythm.</p>}
        {isPublic && (user ? <form className={styles.commentForm} onSubmit={comment}>
          <Avatar profile={{ displayName:user.name }} />
          <label className={styles.srOnly} htmlFor="new-comment">Add a comment</label>
          <div><textarea ref={input} id="new-comment" rows={1} maxLength={1000} value={text} onChange={(event) => setText(event.target.value)} placeholder="Add a comment..." required />
            <button disabled={!text.trim() || Boolean(busy)}>{busy === "comment" ? "Posting..." : "Post"}</button></div>
        </form> : <p className={styles.commentSignIn}><a href={signIn}>Sign in</a> to like, comment, and save rhythms.</p>)}
        <div className={styles.postControls}>
          {isPublic && <><Status error={engagement.error} retry={engagement.refresh} />
            <div className={styles.socialActions}>
              {user ? <button aria-label={engagement.data?.liked ? "Unlike rhythm" : "Like rhythm"} aria-pressed={Boolean(engagement.data?.liked)} disabled={Boolean(busy) || !engagement.data} onClick={like}><FiHeart aria-hidden="true" /></button> : <a href={signIn} aria-label="Sign in to like"><FiHeart aria-hidden="true" /></a>}
              <span aria-label={`${engagement.data?.likeCount || 0} likes`}>{engagement.data?.likeCount ?? ""}</span>
              <button aria-label="Write a comment" onClick={() => input.current?.focus()} disabled={!user}><FiMessageCircle aria-hidden="true" /></button>
              <span>{engagement.data?.commentCount ?? ""}</span>
              <button className={styles.sharePost} onClick={share} disabled={Boolean(busy)} aria-label="Copy rhythm link"><FiSend aria-hidden="true" /></button>
              <RhythmActions key={`${user?.id}-${rhythm.id}-${rhythm.saved}`} rhythm={rhythm} action="save" onSaved={onChanged} />
            </div></>}
          {notice && <p role="status" className={styles.hint}>{notice}</p>}
          {error && <p role="alert" className={styles.inlineError}>{error}{error.includes("public profile") && <> <Link href="/profile">Set up your profile</Link></>}</p>}
        </div>
      </section>
    </>}
    {editing && <RhythmDialog rhythm={rhythm} onClose={() => setEditing(false)} onSaved={(saved) => {
      setEditing(false); onChanged?.();
      if (saved) resource.refresh(); else if (onClose) onClose(); else router.push("/profile");
    }} />}
  </div>;
}
