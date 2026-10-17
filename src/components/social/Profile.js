import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { FiArrowUpRight, FiLock, FiGrid, FiBookmark, FiPlus } from "react-icons/fi";
import { INSTRUMENTS } from "../../lib/social/config";
import { socialRequest } from "./api";
import RhythmCard from "./RhythmCard";
import { useRhythmModal } from "./RhythmPost";
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
  const [editingProfile,setEditingProfile] = useState(false), [notice,setNotice] = useState("");
  useEffect(() => { setEditingProfile(false); setNotice(""); },[user?.id,handle]);
  const profile = profileResource.data?.profile;
  const result = publicView ? profileResource : library;
  const modal = useRhythmModal(result.refresh);
  function navigate(changes) { router.push({ pathname: router.pathname, query: { ...router.query, page: 1, ...changes } },undefined,{ shallow: true, scroll: false }); }
  return <Shell title={publicView ? profile?.displayName || "Musician profile" : "Profile"} className={styles.profilePage}>
    {!loaded ? <Status loading /> : !publicView && !user ? <section className={styles.signInPanel}><p className={styles.eyebrow}>YOUR PRACTICE, ALL IN ONE PLACE</p><h1>A home for your rhythms.</h1><p>Save what inspires you, publish your own ideas, and return to your collection on any device.</p><SignIn /><Link href="/discover">Explore the community first <FiArrowUpRight aria-hidden="true" /></Link></section> : <>
      <Status error={profileResource.error} loading={!profileResource.data && !profileResource.error} retry={profileResource.refresh} />
      {profileResource.data && <header className={styles.profileHero}>
        <Avatar large profile={profile || { displayName: user?.name }} />
        <div className={styles.profileInfo}>
          <div className={styles.profileName}><h1>{profile?.handle || user?.name || "Your profile"}</h1>
            {!publicView && profile && <Link href={`/u/${profile.handle}`} aria-label="View public profile" title="View public profile"><FiArrowUpRight aria-hidden="true" /></Link>}
          </div>
          {profile && <p className={styles.profileDisplayName}>{profile.displayName}</p>}
          {!!profile?.instruments?.length && <p className={styles.profileInstruments}>{profile.instruments.map((instrument) => instrument === "drumset" ? "Drum set" : instrument).join(" · ")}</p>}
          {(profile?.bio || !publicView && !profile) && <p className={styles.profileBio}>{profile?.bio || "Make this space yours. Create a public profile to share your rhythms."}</p>}
        </div>
        {!publicView && <div className={styles.profileButtons}>
          <button onClick={() => setEditingProfile((value) => !value)} aria-expanded={editingProfile}>{profile ? "Edit profile" : "Create public profile"}</button>
          <Link href="/"><FiPlus aria-hidden="true" /> Create rhythm</Link>
        </div>}
        {publicView && profileResource.data.isOwner && <div className={styles.profileButtons}><Link href="/profile">Edit profile</Link><Link href="/"><FiPlus aria-hidden="true" /> Create rhythm</Link></div>}
      </header>}
      {!publicView && editingProfile && <ProfileEditor key={`${user.id}-${profile?.id || "new"}`} profile={profile} user={user} onCancel={() => setEditingProfile(false)} onSaved={() => { profileResource.refresh(); setEditingProfile(false); setNotice("Your public profile is saved."); }} />}
      {notice && <p role="status" className={styles.notice}>{notice}</p>}
      {publicView ? <div className={styles.profileCollectionHeading}><FiGrid aria-hidden="true" /><h2>Rhythms</h2></div> : <>
        <div className={styles.profileTabs} aria-label="Your collection">
          <button aria-pressed={tab === "created"} onClick={() => navigate({ tab: "created" })}><FiGrid aria-hidden="true" /> Rhythms</button>
          <button aria-pressed={tab === "saved"} onClick={() => navigate({ tab: "saved" })}><FiBookmark aria-hidden="true" /> Saved</button>
        </div>
        {tab === "saved" && <p className={styles.collectionPrivacy}><FiLock aria-hidden="true" /> Only you can see your saved rhythms.</p>}
      </>}
      {!publicView && <Status error={result.error} loading={!result.data && !result.error} retry={result.refresh} />}
      {result.data && <><div className={styles.profileGrid}>{result.data.items.map((rhythm) => <RhythmCard key={`${user?.id}-${rhythm.id}`} rhythm={rhythm} onOpen={modal.open} />)}</div>
        {!result.data.items.length && <Empty title={publicView ? "The next idea is still taking shape." : tab === "saved" ? "Keep a rhythm for later." : "Start your collection."}>{publicView ? "Published rhythms will appear here." : tab === "saved" ? <><Link href="/discover">Explore the community</Link> and save a rhythm to practice later.</> : <>Open the <Link href="/">composer</Link> and save your first rhythm. Existing saved compositions also appear here.</>}</Empty>}
        <Pagination page={page} hasMore={result.data.hasMore} onChange={(next) => navigate({ page: next })} /></>}
      {modal.element}
    </>}
  </Shell>;
}
