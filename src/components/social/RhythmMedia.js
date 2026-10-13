import { useEffect, useState } from "react";
import { useAccount, useResource } from "./shared";
import { socialRequest } from "./api";
import styles from "./social.module.css";

export function useMediaStatus(rhythm, onReady) {
  const pending = (rhythm?.media || []).filter((item) => ["uploading","processing"].includes(item.status)).map((item) => item.id).join(",");
  useEffect(() => {
    if (!pending) return;
    const abort = new AbortController();
    const timer = setInterval(async () => {
      if (document.hidden) return;
      const results = await Promise.allSettled(pending.split(",").map((id) => socialRequest(`rhythms/${rhythm.id}/media/${id}`,{signal:abort.signal})));
      if (!abort.signal.aborted && results.some((result) => result.status === "fulfilled" && ["ready","failed"].includes(result.value.media.status))) onReady();
    },15000);
    return () => { abort.abort(); clearInterval(timer); };
  },[rhythm?.id,pending,onReady]);
}

export default function RhythmMedia({ rhythmId, media }) {
  const { user } = useAccount();
  const resource = useResource(`rhythms/${rhythmId}/media/${media.id}/playback`,user?.id);
  const [expired,setExpired] = useState(false);
  useEffect(() => {
    setExpired(false);
    if (!resource.data) return;
    const timer = setTimeout(() => setExpired(true),Math.max(0,new Date(resource.data.expiresAt).getTime()-Date.now()));
    return () => clearTimeout(timer);
  },[resource.data]);
  return <div className={`${styles.recordingPlayer} ${media.kind === "audio" ? styles.audioPlayer : ""}`}>
    {resource.error ? <div role="alert"><p>{resource.error}</p><button onClick={resource.refresh}>Try playback again</button></div> :
      !resource.data ? <p role="status">Loading {media.kind}...</p> : <>
        <iframe src={resource.data.embedUrl} title={`${media.kind === "audio" ? "Audio recording" : "Video demonstration"}: ${media.name}`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        {expired && <button onClick={resource.refresh}>Reload player</button>}
      </>}
  </div>;
}
