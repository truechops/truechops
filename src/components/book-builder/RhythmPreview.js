import { useEffect, useId, useRef, useState } from "react";
import { drawScore, initialize } from "../../lib/vexflow";

export default function RhythmPreview({ score, minWidth = 480, fit = false, compact = false, maxHeight }) {
  const id = `practice-score-${useId().replace(/:/g, "")}`;
  const root = useRef(null);
  const [width, setWidth] = useState(680);
  const [error, setError] = useState(false);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(minWidth, Math.floor(entry.contentRect.width) - 50)));
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [minWidth]);
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
      if (fit) {
        const svg = container.querySelector("svg");
        if (compact) {
          const bounds = svg.getBBox(), padding = 10;
          svg.setAttribute("viewBox",`${bounds.x-padding} ${bounds.y-padding} ${bounds.width+padding*2} ${bounds.height+padding*2}`);
          svg.setAttribute("width",bounds.width+padding*2);
          svg.setAttribute("height",bounds.height+padding*2);
        } else svg.setAttribute("viewBox",`0 0 ${svg.getAttribute("width")} ${svg.getAttribute("height")}`);
        svg.style.width = "100%";
        svg.style.height = "auto";
        if (maxHeight) svg.style.maxHeight = maxHeight;
        svg.style.display = "block";
      }
      setError(false);
    } catch { setError(true); }
    return () => { container.innerHTML = ""; };
  }, [score, width, id, fit, compact, maxHeight]);
  return <div ref={root} style={{ overflowX: fit ? "visible" : "auto", width: "100%", minWidth: 0 }}>
    <div id={id} aria-hidden="true" style={{ pointerEvents: "none" }} />
    {error && <span>Unable to display this rhythm.</span>}
  </div>;
}
