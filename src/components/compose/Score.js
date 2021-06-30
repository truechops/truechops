import { useCallback, useEffect, useState } from "react";
import { drawScore, initialize } from "../../lib/vexflow";
import { useSelector, useDispatch } from "react-redux";
import { scoreActions } from "../../store/score";
import addComposeEventListeners from "./event-listeners";

export default function Score(props) {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const dispatch = useDispatch();
  const selectNote = scoreActions.selectNote;
  const selectedNoteIndex = useSelector(
    (state) => state.score.present.selectedNoteIndex
  );
  const repeat = useSelector((state) => state.score.present.repeat);
  const score = useSelector((state) => state.score.present.score);

  const updateDimensions = useCallback(() => {
    setWindowWidth(window.innerWidth);
  }, []);

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
  }, [
    windowWidth,
    score,
    noteSelectedCallback,
    selectedNoteIndex,
    repeat,
    dispatch,
    props.selectedTab,
    props.tabPanelHidden,
  ]);

  return (
    <div className="vexflow-wrapper">
      <div id="vexflow" key={Math.random().toString()} />
    </div>
  );
}
