import { useCallback, useEffect, useRef, useState } from "react";
import { practiceRequest } from "./practice-api";

// An account can be verified on another device while this page stays open.
export default function useBookAccess(userId, token = "") {
  const [access, setAccess] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const refreshRef = useRef(() => Promise.resolve(null));

  useEffect(() => {
    setAccess(null); setError(""); setRefreshing(false);
    if (!userId) return;
    let request;
    async function refresh() {
      request?.abort();
      const current = new AbortController();
      request = current;
      setRefreshing(true);
      try {
        const result = await practiceRequest(`book-practice/access${token ? `?token=${encodeURIComponent(token)}` : ""}`, "GET", null, current.signal);
        if (!current.signal.aborted) { setAccess(result); setError(""); return result; }
      } catch (failure) {
        if (!current.signal.aborted) setError(failure.message);
      } finally {
        if (!current.signal.aborted) setRefreshing(false);
      }
      return null;
    }
    function onReturn() { if (document.visibilityState !== "hidden") refresh(); }
    refreshRef.current = refresh;
    refresh();
    window.addEventListener("focus", onReturn);
    window.addEventListener("pageshow", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      request?.abort();
      refreshRef.current = () => Promise.resolve(null);
      window.removeEventListener("focus", onReturn);
      window.removeEventListener("pageshow", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [userId, token]);

  const refresh = useCallback(() => refreshRef.current(), []);
  return { access, error, refreshing, refresh };
}
