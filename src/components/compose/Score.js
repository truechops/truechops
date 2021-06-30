import { useCallback, useEffect, useState, useRef } from "react";
import { drawScore, initialize } from "../../lib/vexflow";
import { useSelector, useDispatch } from "react-redux";
import { scoreActions } from "../../store/score";
import useComposeEventListeners from "./event-listeners";
import panzoom from "panzoom";

export default function Score(props) {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const dispatch = useDispatch();
  const selectNote = scoreActions.selectNote;
  const selectedNoteIndex = useSelector(
    (state) => state.score.present.selectedNoteIndex
  );
  const repeat = useSelector((state) => state.score.present.repeat);
  const score = useSelector((state) => state.score.present.score);

  useEffect(() => {
    // grab the DOM SVG element that you want to be draggable/zoomable:
    var element = document.getElementById("vexflow");

    var instance = panzoom(element);
    instance.on("panstart", function (e) {
      console.log("panstart", e);
      // Note: e === instance.
    });

    instance.on("pan", function (e) {
      console.log("pan", e);
    });

    instance.on("panend", function (e) {
      console.log("panned", e);
    });

    instance.on("zoom", function (e) {
      console.log("zoom", e);
    });

    instance.on("zoomend", function (e) {
      console.log("zoomed", e);
    });

    instance.on("transform", function (e) {
      // This event will be called along with events above.
      console.log("transform", e);
    });
  }, []);

  const updateDimensions = useCallback(() => {
    setWindowWidth(window.innerWidth);
  }, []);

  const { setup } = useComposeEventListeners();

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
      <div id="vexflow" key={Math.random().toString()} />
    </div>
  );
}
