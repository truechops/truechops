import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { FiArrowUpRight, FiLock } from "react-icons/fi";
import { INSTRUMENTS } from "../../lib/social/config";
import { socialRequest } from "./api";
import RhythmCard from "./RhythmCard";
import RhythmDialog from "./RhythmDialog";
import { Shell, Avatar, SignIn, Status, Empty, Pagination, useAccount, useResource } from "./shared";
import styles from "./social.module.css";

function ProfileEditor({ profile, user, onSaved, onCancel }) {
  const [values,setValues] = useState({ handle: profile?.handle || "", displayName: profile?.displayName || (user.name?.includes("@") ? "" : user.name) || "", bio: profile?.bio || "", instruments: profile?.instruments || [] });
  const [error,setError] = useState(""), [busy,setBusy] = useState(false);
  function update(key) { return (event) => setValues((v) => ({ ...v,[key]: event.target.value })); }
  async function save(event) {
    event.preventDefault(); setBusy(true); setError("");
    try { const result = await socialRequest("profile",{ method: "PUT", body: values }); onSaved(result.profile); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <section className={styles.editor} aria-labelledby="profile-editor-title"><h2 id="profile-editor-title">{profile ? "Edit your profile" : "Introduce yourself"}</h2>
    <p>Your name, handle, bio, instruments and published rhythms will be public. Your email and private collection stay private.</p>
    <form className={styles.form} onSubmit={save}>
      <div className={styles.formRow}><label>Display name<input required maxLength={60} value={values.displayName} onChange={update("displayName")} /></label><label>Handle<input required minLength={3} maxLength={24} pattern="[A-Za-z0-9][A-Za-z0-9_]{2,23}" value={values.handle} onChange={update("handle")} placeholder="your_drummer_name" autoCapitalize="none" spellCheck="false" /><small>3–24 letters, numbers or underscores.</small></label></div>
      <label>Bio<textarea rows={3} maxLength={360} value={values.bio} onChange={update("bio")} placeholder="Your sound, your practice, what you're working on." /></label>
      <fieldset className={styles.instrumentChoices}><legend>Your instruments</legend>{INSTRUMENTS.map((instrument) => <label className={styles.check} key={instrument}><input type="checkbox" checked={values.instruments.includes(instrument)} onChange={(event) => setValues((v) => ({ ...v, instruments: event.target.checked ? [...v.instruments,instrument] : v.instruments.filter((value) => value !== instrument) }))} />{instrument}</label>)}</fieldset>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.formActions}><button type="button" disabled={busy} onClick={onCancel}>Cancel</button><button className={styles.primary} disabled={busy}>{busy ? "Saving..." : profile ? "Save profile" : "Create public profile"}</button></div>
    </form>
  </section>;
}

export default function Profile({ publicView = false }) {
  const router = useRouter(), { user,loaded } = useAccount();
  const handle = typeof router.query.handle === "string" ? router.query.handle : "";
  const page = Number(router.query.page) || 1, tab = router.query.tab === "saved" ? "saved" : "created";
  const enabled = router.isReady && loaded;
  const profileResource = useResource(enabled && (publicView ? handle : user) ? publicView ? `profiles/${encodeURIComponent(handle)}?page=${page}` : "profile" : null,user?.id);
  const library = useResource(enabled && user && !publicView ? `library?tab=${tab}&page=${page}` : null,user?.id);
  const [editingProfile,setEditingProfile] = useState(false), [editingRhythm,setEditingRhythm] = useState(null), [notice,setNotice] = useState("");
  useEffect(() => { setEditingProfile(false); setEditingRhythm(null); setNotice(""); },[user?.id,handle]);
  const profile = profileResource.data?.profile;
  const result = publicView ? profileResource : library;
  function navigate(changes) { router.push({ pathname: router.pathname, query: { ...router.query, page: 1, ...changes } },undefined,{ shallow: true, scroll: false }); }
  return <Shell title={publicView ? profile?.displayName || "Musician profile" : "My profile & rhythms"} active="profile">
    {!loaded ? <Status loading /> : !publicView && !user ? <section className={styles.signInPanel}><p className={styles.eyebrow}>YOUR PRACTICE, ALL IN ONE PLACE</p><h1>A home for your rhythms.</h1><p>Save what inspires you, publish your own ideas, and return to your collection on any device.</p><SignIn /><Link href="/discover">Explore the community first <FiArrowUpRight aria-hidden="true" /></Link></section> : <>
      <Status error={profileResource.error} loading={!profileResource.data && !profileResource.error} retry={profileResource.refresh} />
      {profileResource.data && <header className={styles.profileHero}><Avatar large profile={profile || { displayName: user?.name }} /><div><p className={styles.eyebrow}>{profile ? `@${profile.handle}` : "YOUR PRACTICE SPACE"}</p><h1>{profile?.displayName || "Make yourself at home."}</h1><p>{profile?.bio || (publicView ? "A little more practice. A few new ideas." : "Keep the rhythms you love. Share the ones you create.")}</p><div className={styles.tags}>{profile?.instruments.map((instrument) => <span key={instrument}>{instrument}</span>)}</div></div>
        {!publicView && <div className={styles.profileButtons}><button onClick={() => setEditingProfile((value) => !value)}>{profile ? "Edit profile" : "Create public profile"}</button>{profile && <Link href={`/u/${profile.handle}`}>View public profile <FiArrowUpRight aria-hidden="true" /></Link>}<Link href="/account/books">My books &amp; saved book practice</Link></div>}
        {publicView && profileResource.data.isOwner && <Link href="/profile" className={styles.primary}>Manage my profile</Link>}
      </header>}
      {!publicView && editingProfile && <ProfileEditor key={`${user.id}-${profile?.id || "new"}`} profile={profile} user={user} onCancel={() => setEditingProfile(false)} onSaved={() => { profileResource.refresh(); setEditingProfile(false); setNotice("Your public profile is saved."); }} />}
      {notice && <p role="status" className={styles.notice}>{notice}</p>}
      <div className={styles.collectionHeader}><div>{publicView ? <h2>Published rhythms</h2> : <><h2>Your rhythm collection</h2><p><FiLock aria-hidden="true" /> Saved rhythms and private compositions are visible only to you.</p></>}</div>{!publicView && <Link href="/" className={styles.primary}>Create a rhythm <FiArrowUpRight aria-hidden="true" /></Link>}</div>
      {!publicView && <div className={styles.tabs} aria-label="Your rhythms"><button aria-pressed={tab === "created"} onClick={() => navigate({ tab: "created" })}>My creations</button><button aria-pressed={tab === "saved"} onClick={() => navigate({ tab: "saved" })}>Saved from the community</button></div>}
      {!publicView && <Status error={result.error} loading={!result.data && !result.error} retry={result.refresh} />}
      {result.data && <><div className={styles.grid}>{result.data.items.map((rhythm) => <RhythmCard key={`${user?.id}-${rhythm.id}`} rhythm={rhythm} onEdit={setEditingRhythm} onSaved={!publicView && tab === "saved" ? result.refresh : undefined} />)}</div>
        {!result.data.items.length && <Empty title={publicView ? "The next idea is still taking shape." : tab === "saved" ? "Keep a rhythm for later." : "Start your collection."}>{publicView ? "Published rhythms will appear here." : tab === "saved" ? <><Link href="/discover">Explore the community</Link> and save a rhythm to practice later.</> : <>Open the <Link href="/">composer</Link> and save your first rhythm. Existing saved compositions also appear here.</>}</Empty>}
        <Pagination page={page} hasMore={result.data.hasMore} onChange={(next) => navigate({ page: next })} /></>}
      {editingRhythm && <RhythmDialog rhythm={editingRhythm} onClose={() => setEditingRhythm(null)} onSaved={(saved) => { setEditingRhythm(null); result.refresh(); setNotice(saved ? "Rhythm updated." : "Rhythm deleted."); }} />}
    </>}
  </Shell>;
}
