import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Dialog from "@mui/material/Dialog";
import { FiX } from "react-icons/fi";
import RhythmSlide from "./RhythmSlide";
import { socialRequest } from "./api";
import { useAccount } from "./shared";
import styles from "./immersive.module.css";

export function useRhythmModal(onChanged) {
  const router = useRouter(), opened = useRef(false);
  const id = typeof router.query.rhythm === "string" ? router.query.rhythm : "";
  useEffect(() => { if (!id) opened.current = false; }, [id]);
  function open(event, rhythm) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); opened.current = true;
    router.push({ pathname: router.pathname, query: { ...router.query, rhythm: rhythm.id } }, undefined, { shallow: true, scroll: false });
  }
  function close() {
    if (opened.current) { router.back(); return; }
    const query = { ...router.query }; delete query.rhythm;
    router.replace({ pathname: router.pathname, query }, undefined, { shallow: true, scroll: false });
  }
  return { open, element: <Dialog open={Boolean(id)} onClose={close} fullScreen PaperProps={{ className: styles.modal }} aria-label="Rhythm viewer">
    {id && <RhythmPost key={id} id={id} onClose={close} onChanged={onChanged} />}
  </Dialog> };
}

export default function RhythmPost({ id, onClose, onChanged, standalone = false }) {
  const { user, loaded } = useAccount();
  const [items, setItems] = useState([id]), [active, setActive] = useState(0);
  const [source, setSource] = useState(null), [page, setPage] = useState(1), [hasMore, setHasMore] = useState(true);
  const [pending, setPending] = useState(false), [error, setError] = useState(""), [retry, setRetry] = useState(0);
  const feed = useRef(null);
  const canRecommend = source?.visibility === "public";
  useEffect(() => {
    function escape(event) {
      if (event.key !== "Escape" || document.getElementById("rhythm-dialog-title")) return;
      event.preventDefault(); event.stopPropagation();
      const restore = feed.current?.querySelector('[data-active="true"] button[aria-label="Restore variations"]');
      if (restore) { restore.click(); return; }
      const closePanel = feed.current?.querySelector('[data-active="true"] button[aria-label="Close side panel"]');
      if (closePanel) closePanel.click(); else onClose();
    }
    document.addEventListener("keydown", escape, true);
    return () => document.removeEventListener("keydown", escape, true);
  }, [onClose]);
  useEffect(() => {
    if (!canRecommend || !loaded) return;
    const abort = new AbortController();
    setPending(true); setError("");
    socialRequest(`rhythms/${encodeURIComponent(id)}/similar?page=${page}`, { signal: abort.signal }).then((result) => {
      if (abort.signal.aborted) return;
      setItems((previous) => [...new Set([...previous, ...result.items.map((item) => item.id)])]);
      setHasMore(result.hasMore); setPending(false);
    }).catch((failure) => { if (!abort.signal.aborted) { setError(failure.message); setPending(false); } });
    return () => abort.abort();
  }, [canRecommend, id, page, loaded, user?.id, retry]);
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.intersectionRatio >= .6) setActive(Number(entry.target.dataset.slideIndex));
    }, { root: feed.current, threshold: .6 });
    feed.current?.querySelectorAll("[data-slide-index]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [items.length]);
  useEffect(() => {
    if (active > 0 && active >= items.length - 2 && hasMore && !pending && !error) setPage((value) => value + 1);
  }, [active, items.length, hasMore, pending, error]);
  function next() { feed.current?.querySelector(`[data-slide-index="${active + 1}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }
  return <div className={`${styles.viewer} ${standalone ? styles.standalone : ""}`}>
    <button className={styles.close} onClick={onClose} aria-label="Close rhythm"><FiX /></button>
    <div className={styles.feed} ref={feed} aria-label="Rhythms and similar rhythms" tabIndex={0}>
      {items.map((rhythmId, index) => <section className={styles.frame} data-slide-index={index} data-active={active === index} inert={active === index ? undefined : ""} key={rhythmId} aria-label={index ? "Similar rhythm" : "Selected rhythm"}>
        {Math.abs(active - index) <= 1 && <RhythmSlide id={rhythmId} active={active === index} onLoaded={index === 0 ? setSource : undefined} onChanged={onChanged} onClose={onClose} />}
        <div className={styles.next}>
          {index < items.length - 1 ? <button onClick={next}>Scroll for a similar rhythm <span aria-hidden="true">↓</span></button> : pending ? <span role="status">Finding similar rhythms…</span> : error ? <button onClick={() => setRetry((value) => value + 1)}>Couldn&apos;t load similar rhythms. Try again</button> : source?.visibility === "public" && !hasMore ? <span>You&apos;re all caught up.</span> : null}
        </div>
      </section>)}
    </div>
  </div>;
}
