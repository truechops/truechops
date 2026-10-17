import { useState } from "react";
import { FiExternalLink, FiPlay } from "react-icons/fi";
import styles from "./youtube.module.css";

// Mount the iframe only after intent to play. The parent unmounts this component
// when its rhythm leaves the active slide, which also stops playback.
export default function YouTubeVideo({ video, name }) {
  const [playing, setPlaying] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  return <div className={styles.player}>
    {playing ? <iframe src={`${video.embedUrl}&autoplay=1`} title={`Video demonstration: ${name} (YouTube)`}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin" /> :
      <button className={styles.poster} onClick={() => setPlaying(true)} aria-label={`Play YouTube video: ${name}`}>
        {!thumbnailFailed && <img src={video.thumbnailUrl} alt="" loading="lazy" onError={() => setThumbnailFailed(true)} />}
        <span className={styles.play}><FiPlay aria-hidden="true" /></span><span className={styles.caption}>Play video</span>
      </button>}
    <a className={styles.external} href={video.url} target="_blank" rel="noopener noreferrer">Watch on YouTube <FiExternalLink aria-hidden="true" /></a>
  </div>;
}
