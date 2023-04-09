import { useCallback, useEffect, useState } from "react";
import { drawScore, initialize } from "../../lib/vexflow";
import { useSelector, useDispatch } from "react-redux";
import { scoreActions, selectNote } from "../../store/score";
import { appActions } from "../../store/app";
import Dialog from '../ui/Dialog';
import repeatHook from './buttons/mutate/common/repeat-hook';
import { browserName } from 'react-device-detect';

import { useRouter } from "next/router";
import _ from "lodash";

let currentScore = null
export default function Score(props) {
  const router = useRouter();

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const dispatch = useDispatch();
  const selectedNoteIndex = useSelector(
    (state) => state.score.present.selectedNoteIndex
  );

  const repeat = useSelector((state) => state.score.present.repeat);
  const isDynamic = useSelector((state) => state.score.present.dynamic);
  const name = useSelector(state => state.score.present.name);
  const [promptedForRepeat, setPromptedForRepeat] = useState(false);
  const [repeatDialogOpen, setRepeatDialogOpen] = useState(false);
  const { formControl: repeatFormControl, numRepeats } = repeatHook();
  
  const dontUseSafariShown = useSelector(state => state.app.dontUseSafariShown);
  const scrollAmount = useSelector(state => state.score.present.scrollAmount);

  const updateDimensions = useCallback(() => {
    setWindowWidth(window.innerWidth);
  }, []);

  useEffect(() => {
    if(browserName.indexOf('Safari') >= 0 && dontUseSafariShown == "init") {
      dispatch(appActions.setDontUseSafariShown("true"));
    }
  }, [dontUseSafariShown]);

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
    if(_.isEqual(currentScore, props.score)) {
      // console.log('equal')
      // return;
      //I shouldn't have to render the score two times. Do something about that.
    }

      const { renderer, context } = initialize(props.id);
        drawScore(
          renderer,
          context,
          props.score,
          selectedNoteIndex,
          noteSelectedCallback,
          { width: windowWidth, scale: 1 },
          repeat
        );

      dispatch(appActions.setPageLoaded());
        const scoreElementRoot = document.getElementById('score-root');
      scoreElementRoot.scrollTop = scrollAmount.top;
      scoreElementRoot.scrollLeft = scrollAmount.left;
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
    numRepeats
  ]);

  const numRepeatsElement = <><div>This is a dynamic rhythm. How many times should it repeat?</div><br></br>
  <div style={{textAlign: 'center'}}>
    {repeatFormControl}
    </div></>

  return (
    <>
    {/* This wrapper and the key ensure that content isn't duplicated when the screen resizes*/}
    <div className={props.vexflowWrapperClass}>
      <h2 style={{textAlign: 'center', margin: 0}}>{name}</h2>
      <div className={props.vexflowClass} id="vexflow" key={Math.random().toString()} />
    </div>

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