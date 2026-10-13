import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useDispatch, useSelector } from "react-redux";
import { appActions } from "../../store/app";
import { createContinuousPageScore } from "./book-data";
import { modifyPracticeScore } from "../../lib/book-practice-score";
import RhythmPreview from "./RhythmPreview";
import PracticePlayer from "./PracticePlayer";
import { practiceRequest } from "./practice-api";
import { scoreActions } from "../../store/score";
import styles from "./practice.module.css";

export default function BookPractice() {
  const router = useRouter();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.realm.currentUser);
  const sessionLoaded = useSelector((state) => state.realm.sessionLoaded);
  const token = typeof router.query.token === "string" ? router.query.token : "";
  const savedId = typeof router.query.set === "string" ? router.query.set : "";
  const [page, setPage] = useState(null);
  const [lines, setLines] = useState([]);
  const originals = useRef(new Map());
  const [selected, setSelected] = useState([]);
  const [tempo, setTempo] = useState(80);
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(null);
  const routeKey = `${token}:${savedId}:${user?.id || ""}`;
  const activeRoute = useRef(routeKey);
  activeRoute.current = routeKey;
  const signIn = `/api/auth/google?returnTo=${encodeURIComponent(router.asPath)}`;

  useEffect(() => { dispatch(appActions.setPageLoaded()); }, [dispatch]);
  useEffect(() => {
    if (!router.isReady || !sessionLoaded) return;
    const abort = new AbortController();
    setLoading(true); setError(""); setNotice(""); setSaved(null); setBusy("");
    setPage(null); setLines([]); setSelected([]);
    async function load() {
      if (savedId && !user) return;
      if (!savedId && !token) return;
      const payload = await practiceRequest(savedId ? `book-practice/sets?id=${encodeURIComponent(savedId)}` :
        `book-pages/${encodeURIComponent(token)}`, "GET", null, abort.signal);
      if (abort.signal.aborted) return;
      const source = payload.set || payload.page;
      const rows = source.lines.filter((line) => line.score).map((line, index) => ({ ...line,
        id: `source-${index}`, label: savedId ? `Rhythm ${index + 1}` : `${line.lineNumber}` }));
      originals.current = new Map(rows.map((line) => [line.id, line.score]));
      setPage(payload); setLines(rows); setSelected(rows.map((line) => line.id));
      setTempo(source.tempo || rows[0]?.tempo || 80);
      setName(payload.set?.name || `${payload.bookTitle || "Book"} - Page ${payload.pageRef.page}`);
    }
    load().catch((loadError) => { if (!abort.signal.aborted) setError(loadError.message); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [router.isReady, sessionLoaded, token, savedId, user]);

  const selectedLines = useMemo(() => selected.map((id) => lines.find((line) => line.id === id)).filter(Boolean), [selected, lines]);
  const score = useMemo(() => createContinuousPageScore(selectedLines), [selectedLines]);
  function toggle(id) { setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); }
  function modify(operation) {
    setLines((current) => current.map((line) => selected.includes(line.id) ? { ...line,
      score: operation === "restore" ? originals.current.get(line.id) : modifyPracticeScore(line.score, operation) } : line));
    setSaved(null);
  }
  function shuffleOrder() {
    const next = [...selected];
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    setSelected(next);
  }
  function openInScore() {
    if (!score) return;
    dispatch(scoreActions.updateScore({ score, name, tempo, mutations: [] }));
    router.push("/");
  }
  async function save() {
    const startedOn = routeKey;
    setBusy("save"); setError(""); setSaved(null);
    try {
      const result = await practiceRequest("book-practice/sets", "POST", { name, tempo, lines: selectedLines });
      if (activeRoute.current === startedOn) { setSaved(result); setNotice("Saved to your book account."); }
    } catch (saveError) { if (activeRoute.current === startedOn) setError(saveError.message); }
    finally { if (activeRoute.current === startedOn) setBusy(""); }
  }


  return <main className={styles.page}>
    <header className={styles.header}>
      <div className={`${styles.row} ${styles.spread}`}><span className={styles.eyebrow}>TrueChops · Book practice</span><Link href="/account/books">My books &amp; saved practice</Link></div>
      {page?.bookTitle && <p className={styles.muted}>{page.bookTitle}</p>}
      <h1>{page?.set?.name || (page?.pageRef ? `Page ${page.pageRef.page}` : "Your practice page")}</h1>
      {page?.page && <p className={styles.muted}>{page.page.sectionTitle} · {page.page.title}</p>}
      <p>Listen, make a few changes, and practice at your pace.</p>
    </header>
    {loading && <p role="status">Loading rhythms…</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status" className={styles.success}>{notice}</p>}
    {!loading && savedId && !user && <p><a href={signIn}>Sign in</a> to open your saved rhythms.</p>}
    {!loading && !savedId && !token && <p>Scan a QR code in your book to open its practice page.</p>}
    {page && <>
      <section id="panel-rhythms" aria-label="Book page exercises">
        <div className={styles.panel}>
          <h2>Make this your practice</h2>
          <p>Select exercises below, then open them in the score to play and make dynamic variations. Save privately or publish your version to the community.</p>
          <button className={styles.primary} disabled={!score || Boolean(busy)} onClick={openInScore}>Open in score</button>
        </div>
        <div className={styles.panel}>
          <PracticePlayer score={score} tempo={tempo} setTempo={setTempo} />
          <p className={styles.muted}>Changes apply to selected rhythms. The book’s originals are always available with Restore.</p>
          <div className={styles.row}>
            {[["alternate", "Alternate R/L"], ["swap", "Swap hands"], ["accents", "Remove accents"], ["clear", "Clear ornaments"], ["restore", "Restore"]]
              .map(([operation, label]) => <button key={operation} disabled={!selected.length || Boolean(busy)} onClick={() => modify(operation)}>{label}</button>)}
          </div>
        </div>
        <div className={`${styles.row} ${styles.spread}`}>
          <strong>{selected.length} of {lines.length} rhythms selected</strong>
          <div className={styles.row}>
            <button onClick={() => setSelected(lines.map((line) => line.id))}>Select all</button>
            <button disabled={!selected.length} onClick={() => setSelected([])}>Clear selection</button>
            <button disabled={selected.length < 2} onClick={shuffleOrder}>Shuffle play order</button>
            <button disabled={!selected.length || Boolean(busy)} onClick={() => { setLines((current) => current.filter((line) => !selected.includes(line.id))); setSelected([]); }}>Remove selected</button>
          </div>
        </div>
        <p className={styles.muted}>Tap rhythms to choose them. The small number on the right shows their play order.</p>
        <div className={styles.list}>{lines.map((line) => <button key={line.id} className={styles.rhythm} onClick={() => toggle(line.id)}
          aria-label={`Rhythm ${line.label}${selected.includes(line.id) ? `, play position ${selected.indexOf(line.id) + 1}` : ""}`} aria-pressed={selected.includes(line.id)}>
          <span className={styles.number}>{line.label}</span><RhythmPreview score={line.score} />
          {selected.includes(line.id) && <span className={styles.badge}>{selected.indexOf(line.id) + 1}</span>}
        </button>)}</div>
        <div className={styles.panel}>
          <h2>Keep this practice set</h2>
          <p>Save the selected rhythms and tempo to return to them from your account.</p>
          {user ? <div className={styles.row}><label className={styles.field}>Name <input value={name} maxLength={100} onChange={(event) => setName(event.target.value)} /></label>
            <button className={styles.primary} disabled={!selected.length || !name.trim() || Boolean(busy)} onClick={save}>{busy === "save" ? "Saving…" : "Save selected rhythms"}</button>
            {saved && <Link href={`/book?set=${saved.id}`}>Open saved set</Link>}
          </div> : <p><a href={signIn}>Sign in to save rhythms</a></p>}
        </div>
      </section>

    </>}
  </main>;
}
