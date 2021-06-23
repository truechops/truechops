import { useCallback, useEffect, useState, useRef } from "react";
import { drawScore, initialize } from "../../lib/vexflow";
import { setupPlayback, setup as setupToneJs } from "../../lib/tone";
import { useSelector, useDispatch } from "react-redux";
import { scoreActions } from "../../store/score";
import _ from 'lodash';

export default function Score(props) {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const dispatch = useDispatch();
  const { selectNote } = scoreActions;
  const selectedNote = useSelector((state) => state.score.selectedNote);
  const [setSampler, setSetSampler] = useState();
  const [tenorsSampler, setTenorsSampler] = useState();
  const { score } = props;
  const [isLoading, setIsLoading] = useState(true);

  const prevToneJsNotesRef = useRef();

  const updateDimensions = () => {
    setWindowWidth(window.innerWidth);
  };

  window.addEventListener("resize", updateDimensions);

  const noteSelectedCallback = useCallback(
    (note) => {
      dispatch(
        selectNote({
          measureIndex: note.measureIndex,
          partIndex: note.partIndex,
          voiceIndex: note.voiceIndex,
          noteIndex: note.noteIndex,
        })
      );
    },
    [dispatch, selectNote]
  );

  useEffect(() => {
    const { renderer, context } = initialize();
    const { toneJsNotes, loopTimeDuration } = drawScore(
      renderer,
      context,
      score,
      selectedNote,
      noteSelectedCallback,
      windowWidth
    );
    
    if(!prevToneJsNotesRef.current || !_.isEqual(toneJsNotes, prevToneJsNotesRef.current))
    {
      console.log('tonejs upate');
        dispatch(scoreActions.updateToneJs({ notes: toneJsNotes, loopTimeDuration }));
    } else {
      console.log(JSON.stringify(toneJsNotes));
    }

      prevToneJsNotesRef.current = toneJsNotes;
  }, [windowWidth, score, noteSelectedCallback, selectedNote, dispatch, props.selectedTab]);

  return (
    <div className="vexflow-wrapper">
      <div id="vexflow" key={Math.random().toString()} />
    </div>
  );
}
