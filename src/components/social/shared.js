import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useDispatch, useSelector } from "react-redux";
import { appActions } from "../../store/app";
import { socialRequest } from "./api";
import styles from "./social.module.css";

export function useAccount() {
  const user = useSelector((state) => state.realm.currentUser);
  const loaded = useSelector((state) => state.realm.sessionLoaded);
  return { user, loaded };
}
export function useResource(path, accountKey = "", { keepPreviousData = false } = {}) {
  const [revision,setRevision] = useState(0);
  const key = `${path}|${accountKey}|${revision}`;
  const [result,setResult] = useState({});
  useEffect(() => {
    if (!path) return;
    const abort = new AbortController();
    socialRequest(path,{ signal: abort.signal }).then((data) => {
      if (!abort.signal.aborted) setResult({ key, accountKey, data });
    }).catch((error) => { if (!abort.signal.aborted) setResult({ key, accountKey, error: error.message }); });
    return () => abort.abort();
  },[path,key]);
  return {
    data: result.key === key || (path && keepPreviousData && result.accountKey === accountKey) ? result.data : null,
    pending: Boolean(path && result.key !== key),
    error: result.key === key ? result.error : "",
    refresh: () => setRevision((n) => n+1),
    update: (change) => setResult((current) => current.key === key && current.data ? { ...current, data: change(current.data) } : current),
  };
}
export function Shell({ title, children, active = "discover", navigation = true }) {
  const dispatch = useDispatch();
  useEffect(() => { dispatch(appActions.setPageLoaded()); },[dispatch]);
  return <main className={styles.page}>
    <Head><title>{title} | TrueChops</title><meta name="description" content="Find your next rhythm. Explore the TrueChops community, meet drummers, and build your practice collection." /></Head>
    {navigation && <nav className={styles.subnav} aria-label="Community"><Link href="/discover" className={styles.wordmark}>Community</Link>
      <div><Link href="/discover" aria-current={active === "discover" ? "page" : undefined}>Discover</Link>
        <Link href="/profile" aria-current={active === "profile" ? "page" : undefined}>My profile &amp; rhythms</Link></div>
    </nav>}{children}
  </main>;
}
export function SignIn({ returnTo = "/profile", children = "Sign in with Google" }) {
  return <a className={styles.primary} href={`/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`}>{children}</a>;
}
export function Avatar({ profile, large = false }) {
  const name = profile?.displayName || "Drummer";
  const initials = name.trim().split(/\s+/).slice(0,2).map((n) => n[0]).join("").toUpperCase();
  return <span aria-hidden="true" className={`${styles.avatar} ${large ? styles.avatarLarge : ""}`}>{initials}</span>;
}
export function Status({ error, loading, retry }) {
  if (error) return <div className={styles.error} role="alert">{error} {retry && <button onClick={retry}>Try again</button>}</div>;
  return loading ? <div className={styles.loading} role="status"><span />Loading rhythms and people...</div> : null;
}
export function Empty({ title, children }) {
  return <div className={styles.empty}><span className={styles.emptyMark} aria-hidden="true">4 / 4</span><h2>{title}</h2><p>{children}</p></div>;
}
export function Pagination({ page, hasMore, onChange }) {
  if (page <= 1 && !hasMore) return null;
  return <nav className={styles.pagination} aria-label="Result pages"><button disabled={page <= 1} onClick={() => onChange(page-1)}>Previous</button><span>Page {page}</span><button disabled={!hasMore} onClick={() => onChange(page+1)}>Next</button></nav>;
}
