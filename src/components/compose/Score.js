import { useCallback, useEffect, useState } from "react";
import { drawScore, initialize } from "../../lib/vexflow";
import { useSelector, useDispatch } from "react-redux";
import { scoreActions, selectNote } from "../../store/score";
import { appActions } from "../../store/app";
import Dialog from '../ui/Dialog';
import repeatHook from './buttons/mutate/common/repeat-hook';
import { browserName } from 'react-device-detect';
import MeasureToolbar from './MeasureToolbar';
import measureStyles from './measure-toolbar.module.css';

import _ from "lodash";

let currentScore = null
export default function Score(props) {
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1024
  );
  const dispatch = useDispatch();
  const selectedNoteIndex = useSelector(
    (state) => state.score.present.selectedNoteIndex
  );

  const repeat = useSelector((state) => state.score.present.repeat);
  const measureSelection = useSelector((state) => state.score.present.measureSelection);
  const scoreRootId = props.scoreRootId || "score-root"
  const isDynamic = useSelector((state) => state.score.present.dynamic);
  const name = useSelector(state => state.score.present.name);
  const [promptedForRepeat, setPromptedForRepeat] = useState(false);
  const [repeatDialogOpen, setRepeatDialogOpen] = useState(false);
  const [measureToolsOpen, setMeasureToolsOpen] = useState(false);
  const { formControl: repeatFormControl, numRepeats } = repeatHook();
  
  const dontUseSafariShown = useSelector(state => state.app.dontUseSafariShown);
  const scrollAmount = useSelector(state => state.score.present.scrollAmount);

  const updateDimensions = useCallback(() => {
    setWindowWidth(window.innerWidth);
  }, []);

  useEffect(() => {
    window.addEventListener("resize", updateDimensions);

    return () => {
      window.removeEventListener("resize", updateDimensions);
    };
  }, [updateDimensions]);

  useEffect(() => {
    if(browserName.indexOf('Safari') >= 0 && dontUseSafariShown == "init") {
      //dispatch(appActions.setDontUseSafariShown("true"));
    }
  }, [dispatch, dontUseSafariShown]);

  const noteSelectedCallback = useCallback(
    (note) => {
      setMeasureToolsOpen(false);
      const scoreRootElement = document.getElementById(scoreRootId);
      dispatch(
        selectNote({
          measureIndex: note.measureIndex,
          partIndex: note.partIndex,
          voiceIndex: note.voiceIndex,
          noteIndex: note.noteIndex,
        }, {
          top: scoreRootElement ? scoreRootElement.scrollTop : 0,
          left: scoreRootElement ? scoreRootElement.scrollLeft : 0
        })
      );
    },
    [dispatch, scoreRootId]
  );
  const measureSelectedCallback = useCallback((index, keyboard = false) => {
    setMeasureToolsOpen(false);
    const root = document.getElementById(scoreRootId);
    dispatch(scoreActions.setScrollAmount({ top:root?.scrollTop || 0, left:root?.scrollLeft || 0 }));
    dispatch(scoreActions.selectMeasure(index));
    if (keyboard) requestAnimationFrame(() => root?.querySelector(`[data-measure-index="${index}"]`)?.focus());
  }, [dispatch, scoreRootId]);
  const openMeasureTools = useCallback((index, keyboard = false) => {
    measureSelectedCallback(index);
    setMeasureToolsOpen(true);
    if (keyboard) requestAnimationFrame(() => requestAnimationFrame(() => document.querySelector("[data-measure-toolbar] button")?.focus()));
  }, [measureSelectedCallback]);

  useEffect(() => {
    if(_.isEqual(currentScore, props.score)) {
      // console.log('equal')
      // return;
      //JARED_TODO: I shouldn't have to render the score two times. Do something about that.
    }

      const scoreSvgConfig = {
        width: props.width || windowWidth,
        scale: 0.75,
        hResize: 0.75,
        vResize: 0.75,
        ...(props.svgConfig || {}),
        ...(props.measureTools ? { measureEditing: { selected: selectedNoteIndex?.measureIndex, onSelect: measureSelectedCallback, onOpen: openMeasureTools } } : {}),
      };

      const scoreElement = document.getElementById(props.id || "vexflow");
      scoreElement.replaceChildren();
      const { renderer, context } = initialize(props.id || "vexflow");
        drawScore(
          renderer,
          context,
          props.score,
          measureSelection && props.measureTools ? null : selectedNoteIndex,
          noteSelectedCallback,
          scoreSvgConfig,
          repeat
        );

      dispatch(appActions.setPageLoaded());
        const scoreElementRoot = document.getElementById(scoreRootId);
        if (scoreElementRoot) {
          scoreElementRoot.scrollTop = scrollAmount.top;
          scoreElementRoot.scrollLeft = scrollAmount.left;
        }
        if(!promptedForRepeat && isDynamic) {
          setRepeatDialogOpen(true);
          setPromptedForRepeat(true);
        }
        currentScore = props.score
  }, [
    windowWidth,
    props.score,
    noteSelectedCallback,
    selectedNoteIndex,
    repeat,
    dispatch,
    props.selectedTab,
    props.tabPanelHidden,
    scrollAmount,
    promptedForRepeat,
    isDynamic,
    dontUseSafariShown,
    numRepeats,
    props.id,
    props.svgConfig,
    props.width,
    props.measureTools,
    measureSelection,
    measureSelectedCallback,
    openMeasureTools,
    scoreRootId
  ]);

  const numRepeatsElement = <><div>This is a dynamic rhythm. How many times should it repeat?</div><br></br>
  <div style={{textAlign: 'center'}}>
    {repeatFormControl}
    </div></>

  return (
    <>
    <div className={`${props.vexflowWrapperClass || ""} ${props.measureTools ? measureStyles.editor : ""}`}>
      {props.showTitle !== false && <h2 style={{textAlign: 'center', margin: 0}}>{name}</h2>}
      <div className={props.vexflowClass} id={props.id || "vexflow"} />
    </div>
    {props.measureTools && <MeasureToolbar scoreId={props.id || "vexflow"} score={props.score} selectedIndex={selectedNoteIndex?.measureIndex} open={measureToolsOpen} onClose={() => setMeasureToolsOpen(false)} />}

    <Dialog
    isOpen={repeatDialogOpen && (dontUseSafariShown == "init" || dontUseSafariShown == "false")}
    message={numRepeatsElement}
    onOk={() => {
      setRepeatDialogOpen(false)
      dispatch(scoreActions.mutateNotes(numRepeats))
    }}/>

    <Dialog
    isOpen={dontUseSafariShown == "true"}
    message={"TrueChops does not work well with Safari. Please use another browser."}
    onOk={() => {
      dispatch(appActions.setDontUseSafariShown("false"));
    }}/>
  </>
  );
}
