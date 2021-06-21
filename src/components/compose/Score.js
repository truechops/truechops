import { useEffect, useState } from "react";
import { drawScore } from '../../lib/vexflow';
import { setupPlayback } from '../../lib/tone';
import sampleScore from './sample-score';

export default function Score() {
  const updateDimensions = () => {
    setWindowWidth(window.innerWidth);
  };
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  window.addEventListener("resize", updateDimensions);

  useEffect(() => {
    const { toneJsNotes, loopTimeDuration } = drawScore(sampleScore,  windowWidth);
    setupPlayback(toneJsNotes, loopTimeDuration);
  }, [windowWidth]);

  return (
    <>
      <div className="vexflow-wrapper">
        <div id="vexflow" key={Math.random().toString()} />
      </div>
    </>
  );
}
