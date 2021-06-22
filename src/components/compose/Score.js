import { useCallback, useEffect, useState } from "react";
import { drawScore } from '../../lib/vexflow';
import { setupPlayback } from '../../lib/tone';
import { useSelector, useDispatch } from 'react-redux';
import { scoreActions } from '../../store/score';

export default function Score() {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const score = useSelector(state => state.score.score);
  const dispatch = useDispatch();
  const { selectNote } = scoreActions;
  const selectedNote = useSelector((state) => state.score.selectedNote);

  const updateDimensions = () => {
    setWindowWidth(window.innerWidth);
  };

  window.addEventListener("resize", updateDimensions);

  const noteSelectedCallback = useCallback((note) => {
    dispatch(selectNote({
      measureIndex: note.measureIndex,
      partIndex: note.partIndex,
      voiceIndex: note.voiceIndex,
      noteIndex: note.noteIndex
    }));
  }, [dispatch, selectNote]);

  useEffect(() => {
    const { toneJsNotes, loopTimeDuration } = drawScore(score, selectedNote, noteSelectedCallback, windowWidth);
    setupPlayback(toneJsNotes, loopTimeDuration);
  }, [windowWidth, score, noteSelectedCallback, selectedNote]);

  return (
    <>
      <div className="vexflow-wrapper">
        <div id="vexflow" key={Math.random().toString()} />
      </div>
    </>
  );
}
