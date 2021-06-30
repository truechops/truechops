import { useCallback, useEffect, useState, useRef } from "react";
import { drawScore, initialize } from "../../lib/vexflow";
import { useSelector, useDispatch } from "react-redux";
import { scoreActions } from "../../store/score";
import useComposeEventListeners from "./event-listeners";
import Panzoom from "@panzoom/panzoom";

export default function Score(props) {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const dispatch = useDispatch();
  const selectNote = scoreActions.selectNote;
  const selectedNoteIndex = useSelector(
    (state) => state.score.present.selectedNoteIndex
  );
  const repeat = useSelector((state) => state.score.present.repeat);
  const score = useSelector((state) => state.score.present.score);

  const vexFlowRef = useRef();

  const panzoomRef = useRef();
  let panzoom = panzoomRef.current
  useEffect(() => {
    panzoom = panzoomRef.current = Panzoom(vexFlowRef.current)
  }, [])

  const updateDimensions = useCallback(() => {
    setWindowWidth(window.innerWidth);
  }, []);

  const { setup } = useComposeEventListeners();

  window.addEventListener("resize", updateDimensions);

  useEffect(() => {
    const elem = document.getElementById("vexflow");
    console.log('element: ' + elem);
    const panzoom = Panzoom(elem);
    // panzoom.pan(10, 10);
    // panzoom.zoom(2, { animate: true });
  
    // Panning and pinch zooming are bound automatically (unless disablePan is true).
    // There are several available methods for zooming
    // that can be bound on button clicks or mousewheel.
    //button.addEventListener("click", panzoom.zoomIn);
    //elem.parentElement.addEventListener("wheel", panzoom.zoomWithWheel);
  }, [])
  

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
    setup();
  }, [setup]);

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
      <div id="vexflow" key={Math.random().toString()} ref={vexFlowRef}/>
    </div>
  );
}
