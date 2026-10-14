import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { FiSearch, FiX } from "react-icons/fi";
import { INSTRUMENTS } from "../../lib/social/config";
import RhythmCard, { PersonCard } from "./RhythmCard";
import { useRhythmModal } from "./RhythmPost";
import { Shell, Status, Empty, Pagination, useAccount, useResource } from "./shared";
import styles from "./social.module.css";

const scalar = (value) => typeof value === "string" ? value : "";
const categories = [["all", "All"], ["rhythms", "Rhythms"], ["users", "People"]];

export default function Discover() {
  const router = useRouter(), { user, loaded } = useAccount();
  const q = scalar(router.query.q);
  const type = ["rhythms", "users"].includes(router.query.type) ? router.query.type : "all";
  const instrument = scalar(router.query.instrument);
  const page = Number(router.query.page) || 1;
  const [input,setInput] = useState(q), [composing,setComposing] = useState(false);
  const searchInput = useRef(null), timer = useRef(null);
  const ready = router.isReady && loaded;

  useEffect(() => { setInput(q); },[q]);

  const navigate = useCallback((changes, replace = false) => {
    clearTimeout(timer.current);
    const query = { q, type, instrument, page: 1, ...changes };
    Object.keys(query).forEach((key) => {
      if (!query[key] || key === "type" && query[key] === "all" || key === "page" && query[key] === 1) delete query[key];
    });
    return router[replace ? "replace" : "push"]({ pathname: "/discover", query },undefined,{ shallow: true, scroll: false });
  },[router, q, type, instrument]);

  useEffect(() => {
    if (!router.isReady || composing || input.trim() === q) return;
    timer.current = setTimeout(() => navigate({ q: input.trim() },true),300);
    return () => clearTimeout(timer.current);
  },[input, q, composing, router.isReady, navigate]);

  // Fetch both categories together. Switching tabs reuses the current results.
  const rhythmParams = new URLSearchParams({ q, type: "rhythms", instrument, page: String(type === "rhythms" ? page : 1) });
  const peopleParams = new URLSearchParams({ q, type: "users", instrument, page: String(type === "users" ? page : 1) });
  const rhythms = useResource(ready ? `search?${rhythmParams}` : null,user?.id,{ keepPreviousData: true });
  const people = useResource(ready ? `search?${peopleParams}` : null,user?.id,{ keepPreviousData: true });
  const modal = useRhythmModal(rhythms.refresh);
  const typing = input.trim() !== q;
  const showPeople = type !== "rhythms";
  const showRhythms = type !== "users";
  const pending = typing || showPeople && people.pending || showRhythms && rhythms.pending;
  const changeCategory = (next) => navigate({ type: next, q: input.trim() });

  function clearSearch() {
    setInput("");
    navigate({ q: "" },true);
    searchInput.current?.focus();
  }

  return <Shell title="Search rhythms and people" className={styles.discoverPage}>
    <h1 className={styles.srOnly}>{q ? `Search results for ${q}` : "Search rhythms and people"}</h1>
    <header className={styles.searchHeader}>
      <form role="search" className={styles.searchForm} onSubmit={(event) => { event.preventDefault(); navigate({ q: input.trim() },true); }}>
        <FiSearch aria-hidden="true" />
        <label className={styles.srOnly} htmlFor="community-search">Search rhythms and people</label>
        <input ref={searchInput} id="community-search" value={input} maxLength={100} onChange={(event) => setInput(event.target.value)}
          onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)}
          onKeyDown={(event) => { if (event.key === "Escape" && !event.nativeEvent.isComposing) { event.preventDefault(); clearSearch(); } }}
          placeholder="Search rhythms, creators, or tags..." type="search" autoComplete="off" autoCapitalize="none" spellCheck="false" />
        {input && <button type="button" onClick={clearSearch} className={styles.clearSearch} aria-label="Clear search"><FiX aria-hidden="true" /></button>}
      </form>
      <div className={styles.categoryTabs} role="tablist" aria-label="Search results">
        {categories.map(([value,label],index) => <button key={value} id={`tab-${value}`} role="tab" aria-selected={type === value}
          aria-controls="search-results" tabIndex={type === value ? 0 : -1} onClick={() => changeCategory(value)}
          onKeyDown={(event) => {
            const next = event.key === "ArrowRight" ? (index+1)%3 : event.key === "ArrowLeft" ? (index+2)%3 : event.key === "Home" ? 0 : event.key === "End" ? 2 : -1;
            if (next < 0) return;
            event.preventDefault(); changeCategory(categories[next][0]); document.getElementById(`tab-${categories[next][0]}`)?.focus();
          }}>{label}</button>)}
      </div>
    </header>

    <div className={styles.exploreFilters}>
      <div className={styles.instrumentTabs} role="group" aria-label="Instrument filters">
        {[["","All instruments"],...INSTRUMENTS.map((value) => [value,value === "drumset" ? "Drum Set" : value.charAt(0).toUpperCase()+value.slice(1)])].map(([value,label]) =>
          <button key={value} aria-pressed={instrument === value} onClick={() => navigate({ instrument:value, q:input.trim() })}>{label}</button>)}
      </div>
    </div>

    <div id="search-results" className={`${styles.exploreResults} ${pending ? styles.resultsPending : ""}`} role="tabpanel"
      aria-labelledby={`tab-${type}`} aria-busy={pending}>
      <span className={styles.srOnly} role="status">{pending ? "Searching" : `Showing ${type === "users" ? "people" : type === "all" ? "rhythms and people" : "rhythms"}${q ? ` for ${q}` : ""}`}</span>
        {showPeople && <section aria-label="People" className={styles.peopleSection}>
          <div className={styles.sectionHeading}><h2>People</h2>{type === "all" && people.data?.items.length > 0 && <button onClick={() => changeCategory("users")} aria-label="See all people">See all</button>}</div>
          <Status error={people.error} loading={!people.data && !people.error} retry={people.refresh} />
          {people.data && <>
            <div className={`${styles.peopleGrid} ${type === "all" ? styles.peoplePreviewGrid : ""}`}>{people.data.items.slice(0,type === "all" ? 3 : undefined).map((person) => <PersonCard key={person.id} profile={person} compact />)}</div>
            {!people.data.items.length && <p className={styles.noPeople}>{q ? "No people found. Try a name or @handle." : "Public profiles will appear here."}</p>}
            {type === "users" && <Pagination page={page} hasMore={people.data.hasMore} onChange={(next) => navigate({ page: next })} />}
          </>}
        </section>}
        {showRhythms && <section aria-label="Rhythms">
          <div className={styles.sectionHeading}><h2>Rhythms</h2>{type === "all" && rhythms.data?.items.length > 0 && <button onClick={() => changeCategory("rhythms")} aria-label="See all rhythms">See all</button>}</div>
          <Status error={rhythms.error} loading={!rhythms.data && !rhythms.error} retry={rhythms.refresh} />
          {rhythms.data && <>
            <div className={styles.exploreGrid}>{rhythms.data.items.map((rhythm) => <RhythmCard key={`${user?.id}-${rhythm.id}`} rhythm={rhythm} onOpen={modal.open} />)}</div>
            {!rhythms.data.items.length && <Empty title={q || instrument ? "No rhythms found" : "No rhythms yet"}>
              {q || instrument ? "Try a different search or reset your filters." : <>Create a rhythm and publish it from <Link href="/profile">your profile</Link>.</>}
            </Empty>}
            {type === "rhythms" && <Pagination page={page} hasMore={rhythms.data.hasMore} onChange={(next) => navigate({ page: next })} />}
          </>}
        </section>}
    </div>
    {modal.element}
  </Shell>;
}
