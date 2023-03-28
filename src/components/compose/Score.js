import { useCallback, useEffect, useState } from "react";
import { drawScore, initialize } from "../../lib/vexflow";
import { useSelector, useDispatch } from "react-redux";
import { scoreActions, selectNote } from "../../store/score";
import { appActions } from "../../store/app";
import Dialog from '../ui/Dialog';
import repeatHook from './buttons/mutate/common/repeat-hook';
import { browserName } from 'react-device-detect';

import { useRouter } from "next/router";

export default function Score(props) {
  const router = useRouter();
  const {doDynamic} = router.query;
  console.log(`doDynamic: ${doDynamic}`);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const dispatch = useDispatch();
  const selectedNoteIndex = useSelector(
    (state) => state.score.present.selectedNoteIndex
  );
  const repeat = useSelector((state) => state.score.present.repeat);
  const isDynamic = useSelector((state) => state.score.present.dynamic);
  console.log(`score: ${JSON.stringify(props.score)}`);
  const name = useSelector(state => state.score.present.name);
  const [promptedForRepeat, setPromptedForRepeat] = useState(false);
  const [repeatDialogOpen, setRepeatDialogOpen] = useState(false);
  const { formControl: repeatFormControl, numRepeats } = repeatHook();
  
  const [dontUseSafariDialogShown, setDontUseSafariDialogShown] = useState(false);
  const scrollAmount = useSelector(state => state.score.present.scrollAmount);

  const updateDimensions = useCallback(() => {
    setWindowWidth(window.innerWidth);
  }, []);

  useEffect(() => {
    if(browserName.indexOf('Safari') >= 0) {
      setDontUseSafariDialogShown(true);
    }
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
    const { renderer, context } = initialize(props.id, 1);
      drawScore(
        renderer,
        context,
        props.score,
        selectedNoteIndex,
        noteSelectedCallback,
        windowWidth,
        repeat,
        1
      );

    dispatch(appActions.setPageLoaded());
    const scoreElementRoot = document.getElementById('score-root');
     scoreElementRoot.scrollTop = scrollAmount.top;
     scoreElementRoot.scrollLeft = scrollAmount.left;

      if(!promptedForRepeat && isDynamic) {
        setRepeatDialogOpen(true);
        setPromptedForRepeat(true);
      }
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
    dontUseSafariDialogShown,
    numRepeats
  ]);

  const numRepeatsElement = <><div>This is a dynamic rhythm. How many times should it repeat?</div><br></br>
  <div style={{textAlign: 'center'}}>
    {repeatFormControl}
    </div></>

  return (
    <>
    {/* This wrapper and the key ensure that content isn't duplicated when the screen resizes*/}
    <div className="vexflow-wrapper">
      <h2 style={{textAlign: 'center', margin: 0}}>{name}</h2>
      <div className={props.vexflowClass} id="vexflow" key={Math.random().toString()} />
    </div>

    <Dialog
    isOpen={repeatDialogOpen && !dontUseSafariDialogShown && doDynamic}
    message={numRepeatsElement}
    onOk={() => {
      setRepeatDialogOpen(false)
      dispatch(scoreActions.mutateNotes(numRepeats))
    }}/>

    <Dialog
    isOpen={dontUseSafariDialogShown}
    message={"TrueChops does not work well with Safari. Please use another browser."}
    onOk={() => {
      setDontUseSafariDialogShown(false)
    }}/>
  </>
  );
}