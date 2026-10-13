import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useDispatch, useSelector } from "react-redux";
import { appActions } from "../../store/app";
import RhythmPreview from "./RhythmPreview";
import { practiceRequest } from "./practice-api";
import useBookAccess from "./useBookAccess";
import styles from "./practice.module.css";

export default function BookAccount() {
  const router = useRouter();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.realm.currentUser);
  const sessionLoaded = useSelector((state) => state.realm.sessionLoaded);
  const { access, error: accessError, refreshing, refresh: refreshAccess } = useBookAccess(router.isReady ? user?.id : null);
  const [sets, setSets] = useState([]);
  const [book, setBook] = useState("");
  const [challenge, setChallenge] = useState(null);
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleteId, setDeleteId] = useState("");
  const returnTo = typeof router.query.returnTo === "string" && /^\/book\?token=[\w-]{12}$/.test(router.query.returnTo) ? router.query.returnTo : "";
  useEffect(() => { dispatch(appActions.setPageLoaded()); }, [dispatch]);
  useEffect(() => {
    setSets([]); setBook(""); setChallenge(null); setAnswers({}); setNotice(""); setError("");
    if (!user || !router.isReady) return;
    const abort = new AbortController();
    practiceRequest("book-practice/sets", "GET", null, abort.signal)
      .then((saved) => { if (!abort.signal.aborted) setSets(saved.sets); })
      .catch((failure) => { if (!abort.signal.aborted) setError(failure.message); });
    return () => abort.abort();
  }, [user, router.isReady, router.query.book]);
  useEffect(() => {
    if (!access) return;
    const requested = access.books.find((entry) => entry.book === router.query.book);
    const owned = access.books.find((entry) => access.verifiedBooks.some((verified) => verified.book === entry.book && verified.edition === entry.edition));
    setBook((current) => access.books.some((entry) => entry.book === current) ? current : requested?.book || owned?.book || access.books[0]?.book || "");
  }, [access, router.query.book]);
  async function start() {
    setBusy(true); setError(""); setNotice(""); setChallenge(null); setAnswers({});
    try {
      const result = await practiceRequest("book-practice/access", "POST", { book });
      if (result.verified) { await refreshAccess(); setNotice("This book is already verified on your account."); }
      else setChallenge(result.challenge);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  async function submit() {
    setBusy(true); setError("");
    try {
      await practiceRequest("book-practice/access", "PUT", { book: challenge.book.book, challengeId: challenge.id,
        answers: Object.entries(answers).map(([questionId, optionId]) => ({ questionId, optionId })) });
      await refreshAccess();
      setChallenge(null); setNotice("Your book is verified on your account.");
    } catch (failure) { setError(failure.message); setChallenge(null); }
    finally { setBusy(false); }
  }
  async function remove(id) {
    setBusy(true); setError("");
    try { await practiceRequest(`book-practice/sets?id=${encodeURIComponent(id)}`, "DELETE"); setSets((current) => current.filter((entry) => entry._id !== id)); setDeleteId(""); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  const verified = access?.verifiedBooks.some((entry) => entry.book === book && entry.edition === access.books.find((candidate) => candidate.book === book)?.edition);
  return <main className={styles.page}>
    <header className={styles.header}><span className={styles.eyebrow}>Your account</span><h1>Books &amp; saved practice</h1>
      <p>Verify your book once. Verification is saved to your account and works on every device.</p>
      {user && <p className={styles.muted}>Signed in as {user.email || user.name}. <a href={`/api/auth/google?returnTo=${encodeURIComponent(router.asPath)}`}>Switch account</a></p>}
      {returnTo && <Link href={returnTo}>Return to your practice page</Link>}
    </header>
    {!sessionLoaded && <p role="status">Loading your account…</p>}
    {sessionLoaded && !user && <p><a href={`/api/auth/google?returnTo=${encodeURIComponent(router.asPath)}`}>Sign in with Google</a> to verify your books and save your rhythms.</p>}
    {(error || accessError) && <p role="alert" className={styles.error}>{error || accessError}</p>}
    {user && <p><button disabled={refreshing || busy} onClick={refreshAccess}>{refreshing ? "Checking verification..." : "Refresh book verification"}</button></p>}
    {notice && <p role="status" className={styles.success}>{notice}</p>}
    {user && !access && !accessError && !error && <p role="status">Loading books and saved practice…</p>}
    {user && access && <>
      {access.verifiedBooks.length > 0 && <section className={styles.panel} aria-label="Verified books">
        <h2>Your verified books</h2>
        <ul>{access.verifiedBooks.map((entry) => <li key={`${entry.book}:${entry.edition}`}>{entry.title} <span className={styles.badge}>Verified</span></li>)}</ul>
        <p className={styles.muted}>These books are verified on every device signed in to this account. Scan a book QR code to open its exercises, then send them to the score to practice.</p>
      </section>}
      <section className={styles.panel}>
        <h2>Verify a book</h2>
        <p>Have your book ready. Match the notation at three locations to the choices below. Use the page number printed beside the QR code, and count each exercise from the top, left to right. A two-measure phrase counts as one exercise.</p>
        <div className={styles.row}><label className={styles.field}>Book <select value={book} disabled={busy || Boolean(challenge)} onChange={(event) => { setBook(event.target.value); setNotice(""); }}>
          {access.books.map((entry) => <option key={entry.book} value={entry.book}>{entry.title}</option>)}
        </select></label>
        {verified ? <span className={styles.badge}>Verified</span> : <button className={styles.primary} disabled={busy || !book || Boolean(challenge)} onClick={start}>{busy && !challenge ? "Preparing check…" : "Start three rhythm matches"}</button>}
        </div>
      </section>
      {challenge && <section aria-label="Book verification">
        <h2>{challenge.book.title}</h2><p className={styles.muted}>Select one match for each location. This check expires in 10 minutes.</p>
        {challenge.questions.map((question, index) => <fieldset className={styles.question} key={question.id} disabled={busy}>
          <legend>{index + 1} of 3 · Page {question.page}, rhythm {question.rhythm}</legend>
          <div className={styles.list}>{question.options.map((option, optionIndex) => <label className={styles.row} key={option.id}>
            <input type="radio" name={`question-${question.id}`} value={option.id} checked={answers[question.id] === option.id}
              onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))} aria-label={`Page ${question.page}, rhythm ${question.rhythm}: option ${optionIndex + 1}`} />
            <span className={styles.number}>{String.fromCharCode(65 + optionIndex)}</span>
            <div style={{ flex: "1 1 240px", minWidth: 0 }}><RhythmPreview score={option.score} /></div>
          </label>)}</div>
        </fieldset>)}
        <div className={styles.row}><button className={styles.primary} disabled={busy || Object.keys(answers).length !== 3} onClick={submit}>{busy ? "Checking…" : "Verify my book"}</button>
          <button disabled={busy} onClick={() => { setChallenge(null); setAnswers({}); }}>Cancel check</button></div>
      </section>}
      <section style={{ marginTop: 36 }}>
        <h2>Saved practice</h2>
        <p className={styles.muted}>Reopen your saved rhythms here. Open them in the score to play and create dynamic variations.</p>
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
