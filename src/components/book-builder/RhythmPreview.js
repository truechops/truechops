import { useEffect, useId, useRef, useState } from "react";
import { drawScore, initialize } from "../../lib/vexflow";

export default function RhythmPreview({ score }) {
  const id = `practice-score-${useId().replace(/:/g, "")}`;
  const root = useRef(null);
  const [width, setWidth] = useState(680);
  const [error, setError] = useState(false);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(480, Math.floor(entry.contentRect.width) - 50)));
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const container = document.getElementById(id);
    if (!container || !score) return;
    container.innerHTML = "";
    try {
      const { renderer, context } = initialize(id);
      drawScore(renderer, context, score, null, () => {}, {
        width, scale: 1, hResize: 1, vResize: 1, justifyLastRow: true,
        measureNoteStartPadding: 4, measureNoteEndPadding: 8, minimumNoteSpacing: 22,
      }, {});
      setError(false);
    } catch { setError(true); }
    return () => { container.innerHTML = ""; };
  }, [score, width, id]);
  return <div ref={root} style={{ overflowX: "auto", width: "100%", minWidth: 0 }}>
    <div id={id} aria-hidden="true" style={{ pointerEvents: "none" }} />
    {error && <span>Unable to display this rhythm.</span>}
  </div>;
}
