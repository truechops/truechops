import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { FiSearch, FiArrowUpRight } from "react-icons/fi";
import { INSTRUMENTS, DIFFICULTIES } from "../../lib/social/config";
import RhythmCard, { PersonCard } from "./RhythmCard";
import RhythmDialog from "./RhythmDialog";
import { Shell, Status, Empty, Pagination, useAccount, useResource } from "./shared";
import styles from "./social.module.css";

const scalar = (value) => typeof value === "string" ? value : "";
export default function Discover() {
  const router = useRouter(), { user, loaded } = useAccount();
  const q = scalar(router.query.q), type = router.query.type === "users" ? "users" : "rhythms";
  const instrument = scalar(router.query.instrument), difficulty = scalar(router.query.difficulty);
  const page = Number(router.query.page) || 1;
  const [input,setInput] = useState(q), [editing,setEditing] = useState(null);
  useEffect(() => { setInput(q); },[q]);
  useEffect(() => { setEditing(null); },[user?.id]);
  const params = new URLSearchParams({ q, type, instrument, difficulty, page: String(page) });
  const { data,error,refresh } = useResource(router.isReady && loaded ? `search?${params}` : null,user?.id);
  function navigate(changes) {
    const query = { q, type, instrument, difficulty, page: 1, ...changes };
    Object.keys(query).forEach((key) => { if (!query[key] || key === "page" && query[key] === 1) delete query[key]; });
    router.push({ pathname: "/discover", query },undefined,{ shallow: true, scroll: false });
  }
  return <Shell title="Discover rhythms">
    <header className={styles.hero}><div><p className={styles.eyebrow}>THE PRACTICE ROOM</p><h1>Good rhythms<br /><em>travel.</em></h1><p>Find a new idea. Meet the drummer behind it.<br />Make it part of your practice.</p></div>
      <div className={styles.heroAside}><div className={styles.pulseArt} aria-hidden="true">{[8,5,7,4].map((n,i) => <div key={n}><small>{["R","L","R","L"][i]}</small>{Array.from({ length: n },(_,j) => <i key={j} style={{ opacity: (i+j)%3 ? 1 : .25 }} />)}</div>)}</div>
        <Link href="/" className={styles.primary}>Create a rhythm <FiArrowUpRight aria-hidden="true" /></Link><span>Something worth sharing starts with a beat.</span></div>
    </header>
    <section className={styles.searchSection} aria-label="Find rhythms and people">
      <form className={styles.searchForm} onSubmit={(event) => { event.preventDefault(); navigate({ q: input.trim() }); }}><FiSearch aria-hidden="true" />
        <label className={styles.srOnly} htmlFor="community-search">Search rhythms or people</label><input id="community-search" value={input} maxLength={100} onChange={(event) => setInput(event.target.value)} placeholder={type === "users" ? "Search names, @handles, or instruments" : "Search rhythms, styles, or tags"} type="search" />
        <button type="submit">Search</button></form>
      <div className={styles.filterRow}><div className={styles.tabs} aria-label="Search category"><button aria-pressed={type === "rhythms"} onClick={() => navigate({ type: "rhythms" })}>Rhythms</button><button aria-pressed={type === "users"} onClick={() => navigate({ type: "users", difficulty: "" })}>People</button></div>
        <div className={styles.filters}><label><span className={styles.srOnly}>Instrument</span><select aria-label="Instrument" value={instrument} onChange={(e) => navigate({ instrument: e.target.value })}><option value="">All instruments</option>{INSTRUMENTS.map((value) => <option key={value}>{value}</option>)}</select></label>
          {type === "rhythms" && <label><span className={styles.srOnly}>Difficulty</span><select aria-label="Difficulty" value={difficulty} onChange={(e) => navigate({ difficulty: e.target.value })}><option value="">All levels</option>{DIFFICULTIES.map((value) => <option key={value}>{value}</option>)}</select></label>}</div>
      </div>
    </section>
    <div className={styles.resultsHeading}><h2>{q ? `Results for “${q}”` : type === "users" ? "Meet the community" : "Fresh ideas for your next session"}</h2><span>{q ? "Most relevant first" : "Recently added"}</span></div>
    <Status error={error} loading={!data && !error} retry={refresh} />
    {data && <><div className={styles.grid}>{data.items.map((item) => type === "users" ? <PersonCard key={item.id} profile={item} /> : <RhythmCard key={`${user?.id}-${item.id}`} rhythm={item} onEdit={setEditing} />)}</div>
      {!data.items.length && <Empty title={q || instrument || difficulty ? "A little space in this search." : type === "users" ? "Make yourself known." : "The first beat is yours."}>{q || instrument || difficulty ? "Try another phrase or clear your filters to explore more." : type === "users" ? <>Create your <Link href="/profile">public profile</Link> and help this community grow.</> : <>Save a rhythm in the composer, then publish it from <Link href="/profile">your profile</Link>.</>}</Empty>}
      <Pagination page={page} hasMore={data.hasMore} onChange={(next) => navigate({ page: next })} /></>}
    {editing && <RhythmDialog rhythm={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
  </Shell>;
}
