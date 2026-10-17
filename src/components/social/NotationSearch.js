import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSelector } from "react-redux";
import { FiArrowLeft, FiRefreshCw } from "react-icons/fi";
import RhythmPreview from "../book-builder/RhythmPreview";
import RhythmCard from "./RhythmCard";
import { useRhythmModal } from "./RhythmPost";
import { Shell, Status, Empty, Pagination, useAccount } from "./shared";
import { socialRequest } from "./api";
import { INSTRUMENTS } from "../../lib/social/config";
import styles from "./social.module.css";

export default function NotationSearch() {
  const router = useRouter(), { user, loaded } = useAccount();
  const composition = useSelector((state) => state.score.present);
  const [source, setSource] = useState(null), [ready, setReady] = useState(false), [revision, setRevision] = useState(0), [result, setResult] = useState({});
  const page = Number(router.query.page) || 1, includeMarkings = router.query.markings === "1";
  const instrument = typeof router.query.instrument === "string" ? router.query.instrument : "";
  const key = JSON.stringify([source, page, includeMarkings, instrument, user?.id, revision]);
  useEffect(() => {
    try { const stored = JSON.parse(sessionStorage.getItem("truechops:notation-search")); if (stored?.score?.measures?.length) setSource(stored); } catch { /* A fresh tab can use the current score below. */ }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!source || !loaded) return;
    const abort = new AbortController();
    socialRequest("search/notation", { method: "POST", body: { score: source.score, page, includeMarkings, instrument }, signal: abort.signal })
      .then((data) => { if (!abort.signal.aborted) setResult({ key, data }); })
      .catch((failure) => { if (!abort.signal.aborted) setResult({ key, error: failure.message }); });
    return () => abort.abort();
  }, [key, source, loaded, page, includeMarkings, instrument]);
  const data = result.key === key ? result.data : null, error = result.key === key ? result.error : "";
  const modal = useRhythmModal(() => setRevision((value) => value + 1));
  function navigate(changes) { return router.push({ pathname: "/discover", query: { notation: "1", type: "rhythms", instrument, markings: includeMarkings ? "1" : "0", page: 1, ...changes } }, undefined, { shallow: true, scroll: false }); }
  function useCurrentScore() {
    const next = { score: composition.score, label: composition.name || "Your score" };
    try { sessionStorage.setItem("truechops:notation-search", JSON.stringify(next)); } catch { /* Search also works when tab storage is unavailable. */ }
    setSource(next); navigate({ page: 1 });
  }
  return <Shell title="Find matching rhythms" className={styles.discoverPage}>
    <div className={styles.notationSearchHeading}><Link href="/discover"><FiArrowLeft /> All search</Link><Link href="/">Back to Score</Link></div>
    <section className={styles.notationSearch} aria-label="Notation to match">
      <div><h1>Find matching rhythms</h1><button onClick={useCurrentScore}><FiRefreshCw /> Use current score</button></div>
      {source ? <><p>{source.label} · Matches note lengths, rests, meter, and tuplets, including within longer rhythms.</p>
        <div role="img" aria-label="Search notation"><RhythmPreview score={source.score} minWidth={260} fit compact maxHeight="180px" /></div>
        <label><input type="checkbox" checked={includeMarkings} onChange={(event) => navigate({ markings: event.target.checked ? "1" : "0" })} /> Also match stickings and ornaments</label>
      </> : ready ? <p>Select a measure in Score and choose Find matching rhythms, or use your current score.</p> : <p>Loading notation…</p>}
    </section>
    <div className={styles.instrumentTabs} role="group" aria-label="Instrument filters">
      {[["", "All instruments"], ...INSTRUMENTS.map((value) => [value, value === "drumset" ? "Drum Set" : value.charAt(0).toUpperCase() + value.slice(1)])].map(([value, label]) => <button key={value} aria-pressed={instrument === value} onClick={() => navigate({ instrument: value })}>{label}</button>)}
    </div>
    {source && <section aria-label="Matching rhythms"><div className={styles.sectionHeading}><h2>Matching rhythms</h2></div>
      <Status loading={!data && !error} error={error} retry={() => setRevision((value) => value + 1)} />
      {data && <><div className={styles.exploreGrid}>{data.items.map((rhythm) => <RhythmCard key={rhythm.id} rhythm={rhythm} onOpen={modal.open} />)}</div>
        {!data.items.length && <Empty title="No matching notation yet">Try another measure{includeMarkings ? " or turn off matching stickings and ornaments" : " or choose all instruments"}.</Empty>}
        <Pagination page={page} hasMore={data.hasMore} onChange={(value) => navigate({ page: value })} />
      </>}
    </section>}
    {modal.element}
  </Shell>;
}
