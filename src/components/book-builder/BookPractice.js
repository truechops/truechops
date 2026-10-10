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
  const [tab, setTab] = useState("rhythms");
  const [tempo, setTempo] = useState(80);
  const [count, setCount] = useState(8);
  const [generated, setGenerated] = useState([]);
  const [access, setAccess] = useState(null);
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accessError, setAccessError] = useState("");
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
    setPage(null); setLines([]); setSelected([]); setGenerated([]); setTab("rhythms");
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
      setName(payload.set?.name || `${payload.bookTitle || "Book"} ? Page ${payload.pageRef.page}`);
    }
    load().catch((loadError) => { if (!abort.signal.aborted) setError(loadError.message); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [router.isReady, sessionLoaded, token, savedId, user]);

  useEffect(() => {
    setAccess(null); setAccessError("");
    if (!user || !token || savedId) return;
    const abort = new AbortController();
    practiceRequest(`book-practice/access?token=${encodeURIComponent(token)}`, "GET", null, abort.signal)
      .then((result) => { if (!abort.signal.aborted) setAccess(result); })
      .catch((accessFailure) => { if (!abort.signal.aborted) setAccessError(accessFailure.message); });
    return () => abort.abort();
  }, [user, token, savedId]);

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
  async function generate() {
    const startedOn = routeKey;
    setBusy("generate"); setError(""); setNotice("");
    try {
      const result = await practiceRequest("book-practice/generate", "POST", { token, count });
      if (activeRoute.current !== startedOn) return;
      setGenerated(result.lines);
      setNotice(result.notice || `Created ${result.lines.length} rhythms. Add them all to your practice page below.`);
    } catch (generationError) { if (activeRoute.current === startedOn) setError(generationError.message); }
    finally { if (activeRoute.current === startedOn) setBusy(""); }
  }
  function addGenerated() {
    if (lines.length + generated.length > 64) { setError("A practice page holds up to 64 rhythms. Remove some before adding more."); return; }
    const added = generated.map((line, index) => ({ ...line, id: `generated-${Date.now()}-${index}`, label: `New ${index + 1}` }));
    added.forEach((line) => originals.current.set(line.id, line.score));
    setLines((current) => [...current, ...added]); setSelected((current) => [...current, ...added.map((line) => line.id)]);
    setGenerated([]); setTab("rhythms"); setSaved(null); setNotice(`Added ${added.length} rhythms to this practice page.`);
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
  const verifyUrl = `/account/books?book=${encodeURIComponent(page?.pageRef?.book || "")}&returnTo=${encodeURIComponent(router.asPath)}`;

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
      {!savedId && <div role="tablist" aria-label="Book page practice" className={styles.tabs}>
        {[["rhythms", "Page rhythms"], ["generate", "More like this"]].map(([id, title]) => <button key={id} role="tab" id={`tab-${id}`}
          aria-controls={`panel-${id}`} aria-selected={tab === id} tabIndex={tab === id ? 0 : -1}
          onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            event.preventDefault(); const next = event.key === "Home" ? "rhythms" : event.key === "End" ? "generate" : tab === "rhythms" ? "generate" : "rhythms";
            setTab(next); document.getElementById(`tab-${next}`)?.focus();
          } }} onClick={() => setTab(id)}>{title}</button>)}
      </div>}
      {savedId && <p className={styles.panel}>These are your saved rhythms. To generate more of the same type, scan the page’s QR code in your book again.</p>}
      {tab === "rhythms" && <section role={savedId ? undefined : "tabpanel"} id="panel-rhythms" aria-labelledby={savedId ? undefined : "tab-rhythms"}>
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
      </section>}
      {tab === "generate" && !savedId && <section role="tabpanel" id="panel-generate" aria-labelledby="tab-generate">
        <div className={styles.panel}>
          <h2>A fresh set, the same focus</h2>
          <p>New rhythms follow this page’s subdivisions, density, and ornament rules. Choose how many, then add them to your practice page.</p>
          {!user ? <p><a href={signIn}>Sign in</a> and verify your book to generate more rhythms.</p> :
            accessError ? <p role="alert" className={styles.error}>{accessError}</p> :
            !access ? <p role="status">Checking book access…</p> :
            !access.verified ? <p><Link href={verifyUrl}>Verify this book in your account</Link> by matching three rhythms from the printed pages.</p> :
            !access.scanActive ? <p>Scan this page’s QR code in your book again to start a new practice session.</p> : <>
              <p><span className={styles.badge}>Book verified</span></p>
              <div className={styles.row}><label className={styles.field}>Number of rhythms <input aria-label="Number of rhythms" type="number" min="1" max="32" value={count}
                onChange={(event) => setCount(event.target.value === "" ? "" : Number(event.target.value))} /></label>
                <button className={styles.primary} disabled={Boolean(busy) || !Number.isInteger(count) || count < 1 || count > 32} onClick={generate}>{busy === "generate" ? "Creating rhythms…" : "Generate rhythms"}</button></div>
              <p className={styles.muted}>1–32 rhythms at a time. Save any you want to keep. For another visit, scan the book again.</p>
            </>}
        </div>
        {generated.length > 0 && <>
          <button className={styles.primary} disabled={Boolean(busy)} onClick={addGenerated}>Add all {generated.length} rhythms to practice</button>
          <div className={styles.list}>{generated.map((line, index) => <div key={index} className={styles.panel}>
            <strong>New rhythm {index + 1}</strong><RhythmPreview score={line.score} />
          </div>)}</div>
        </>}
      </section>}
    </>}
  </main>;
}
