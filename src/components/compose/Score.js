import { useCallback, useEffect, useState } from "react";
import { drawScore, initialize } from "../../lib/vexflow";
import { useSelector, useDispatch } from "react-redux";
import { scoreActions, selectNote } from "../../store/score";
import addComposeEventListeners from "./event-listeners";

export default function Score(props) {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const dispatch = useDispatch();
  const selectedNoteIndex = useSelector(
    (state) => state.score.present.selectedNoteIndex
  );
  const repeat = useSelector((state) => state.score.present.repeat);
  const score = useSelector((state) => state.score.present.score);
  const name = useSelector(state => state.score.present.name);

  const scrollAmount = useSelector(state => state.score.present.scrollAmount);

  const updateDimensions = useCallback(() => {
    setWindowWidth(window.innerWidth);
  }, []);

  window.addEventListener("resize", updateDimensions);

  const noteSelectedCallback = useCallback(
    (note) => {
      const scoreRootElement = document.getElementById('score-root');
      dispatch(
        selectNote({
          measureIndex: note.measureIndex,
          partIndex: note.partIndex,
          voiceIndex: note.voiceIndex,
          noteIndex: note.noteIndex,
        }, {
          top: scoreRootElement.scrollTop,
          left: scoreRootElement.scrollLeft
        })
      );
    },
    [dispatch]
  );

  useEffect(() => {
    addComposeEventListeners(dispatch);
  }, [dispatch]);

  useEffect(() => {
    const { renderer, context } = initialize();
    drawScore(
      renderer,
      context,
      score,
      selectedNoteIndex,
      noteSelectedCallback,
      windowWidth,
      repeat
    );

    const scoreElementRoot = document.getElementById('score-root');
     scoreElementRoot.scrollTop = scrollAmount.top;
     scoreElementRoot.scrollLeft = scrollAmount.left;
  }, [
    windowWidth,
    score,
    noteSelectedCallback,
    selectedNoteIndex,
    repeat,
    dispatch,
    props.selectedTab,
    props.tabPanelHidden,
    scrollAmount
  ]);

  return (
    <div className="vexflow-wrapper">
      <h2 style={{textAlign: 'center', margin: 0}}>{name}</h2>
      <div id="vexflow" key={Math.random().toString()} />
    </div>
  );
}
