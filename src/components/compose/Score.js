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
  const repeat = useSelector((state) => state.score.repeat);

  const { score } = props;

  const prevToneJsRef = useRef();

  const updateDimensions = () => {
    setWindowWidth(window.innerWidth);
  };

  window.addEventListener("resize", updateDimensions);

  const noteSelectedCallback = useCallback(
    (note) => {
      console.log('note selected callback!');
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
    const { toneJs, loopTimeDuration } = drawScore(
      renderer,
      context,
      score,
      selectedNote,
      noteSelectedCallback,
      windowWidth,
      repeat
    );
    
    if(!prevToneJsRef.current || !_.isEqual(toneJs, prevToneJsRef.current))
    {
        dispatch(scoreActions.updateToneJs(toneJs));
    } 
      prevToneJsRef.current = toneJs;
  }, [windowWidth, score, noteSelectedCallback, selectedNote, repeat, dispatch, props.selectedTab, props.tabPanelHidden]);

  return (
    <div className="vexflow-wrapper">
      <div id="vexflow" key={Math.random().toString()} />
    </div>
  );
}
