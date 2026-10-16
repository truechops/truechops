import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useDispatch, useSelector } from "react-redux";
import { appActions } from "../../store/app";
import { practiceRequest } from "./practice-api";
import styles from "./practice.module.css";

export default function BookAccount() {
  const router = useRouter();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.realm.currentUser);
  const sessionLoaded = useSelector((state) => state.realm.sessionLoaded);
  const [sets, setSets] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState("");
  const [revision, setRevision] = useState(0);
  const returnTo = typeof router.query.returnTo === "string" && /^\/book\?token=[\w-]{12}$/.test(router.query.returnTo) ? router.query.returnTo : "";
  useEffect(() => { dispatch(appActions.setPageLoaded()); }, [dispatch]);
  useEffect(() => {
    setSets(null); setDeleteId(""); setError("");
    if (!user || !router.isReady) return;
    const abort = new AbortController();
    practiceRequest("book-practice/sets", "GET", null, abort.signal)
      .then((saved) => { if (!abort.signal.aborted) setSets(saved.sets); })
      .catch((failure) => { if (!abort.signal.aborted) setError(failure.message); });
    return () => abort.abort();
  }, [user, router.isReady, revision]);
  async function remove(id) {
    setBusy(true); setError("");
    try { await practiceRequest(`book-practice/sets?id=${encodeURIComponent(id)}`, "DELETE"); setSets((current) => current.filter((entry) => entry._id !== id)); setDeleteId(""); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <main className={styles.page}>
    <header className={styles.header}><Link href="/profile" className={styles.eyebrow}>Back to profile</Link><h1>Books &amp; saved practice</h1>
      <p>Scan a QR code in your book to open its rhythms, then open them in the score to practice and adjust individual measures.</p>
      {user && <p className={styles.muted}>Signed in as {user.email || user.name}. <a href={`/api/auth/google?returnTo=${encodeURIComponent(router.asPath)}`}>Switch account</a></p>}
      {returnTo && <Link href={returnTo}>Return to your practice page</Link>}
    </header>
    {!sessionLoaded && <p role="status">Loading your account…</p>}
    {sessionLoaded && !user && <p><a href={`/api/auth/google?returnTo=${encodeURIComponent(router.asPath)}`}>Sign in with Google</a> to save and reopen your practice sets.</p>}
    {error && <p role="alert" className={styles.error}>{error} <button onClick={() => setRevision((value) => value+1)}>Try again</button></p>}
    {user && !sets && !error && <p role="status">Loading saved practice...</p>}
    {user && sets && <>
      <section aria-label="Saved practice" style={{ marginTop: 36 }}>
        <h2>Saved practice</h2>
        <p className={styles.muted}>Reopen your saved rhythms here. Open them in the score to play or adjust individual measures.</p>
        {!sets.length && <p>No saved sets yet. Save selected rhythms from a book practice page.</p>}
        <div className={styles.list}>{sets.map((entry) => <div className={`${styles.panel} ${styles.row} ${styles.spread}`} key={entry._id}>
          <div><Link href={`/book?set=${entry._id}`}>{entry.name}</Link><p className={styles.muted}>{entry.tempo} BPM · {new Date(entry.createdAt).toLocaleDateString()}</p></div>
          {deleteId === entry._id ? <div className={styles.row}><span>Delete this set?</span><button disabled={busy} onClick={() => remove(entry._id)}>Delete permanently</button><button disabled={busy} onClick={() => setDeleteId("")}>Keep</button></div>
            : <button onClick={() => setDeleteId(entry._id)} aria-label={`Delete ${entry.name}`}>Delete</button>}
        </div>)}</div>
      </section>
    </>}
  </main>;
}
