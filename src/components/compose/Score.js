import { useCallback, useEffect, useState } from "react";
import { drawScore, initialize } from "../../lib/vexflow";
import { useSelector, useDispatch, connect } from "react-redux";
import { scoreActions } from "../../store/score";
import { noteNameToDuration } from '../../../data/score-config';

export function Score(props) {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const dispatch = useDispatch();
  const selectNote = scoreActions.selectNote;
  const selectedNoteIndex = useSelector((state) => state.score.present.selectedNoteIndex);
  const repeat = useSelector((state) => state.score.present.repeat);
  const score = useSelector(state => state.score.present.score);
  const voices = props.voices;

  const { startStop, toggleLeftSticking, toggleRightSticking,
         toggleDiddle, toggleCheese, toggleFlam, toggleAccent, modifyNote,
        selectNextNote, selectPreviousNote } = props;

  const updateDimensions = () => {
    setWindowWidth(window.innerWidth);
  };

  const handleKeyEvents = useCallback((event) => {
    console.log('key event!');
    if(event.keyCode === 32) { //spacebar
      startStop()
    } else if(event.keyCode === 76) { //'l' for left sticking
      toggleLeftSticking();
    } else if(event.keyCode === 82) { //'r' for right sticking
      toggleRightSticking()
    } else if (event.keyCode === 68) { //'d' for diddle
      toggleDiddle();
    } else if (event.keyCode === 67) { //'c' for cheese
      toggleCheese();
    } else if (event.keyCode === 70) { //'f' for flam
      toggleFlam();
    } else if (event.keyCode === 65) { //'a' for accent
      toggleAccent();
    } else if (event.keyCode === 49) { //'1' for quarter note
       modifyNote(voices, noteNameToDuration['quarter'], false)
    } else if (event.keyCode === 50) { //'2' for eighth note
      modifyNote(voices, noteNameToDuration['eighth'], false)
    } else if (event.keyCode === 51) { //'3' for sixteenth note
      modifyNote(voices, noteNameToDuration['sixteenth'], false)
    } else if (event.keyCode === 52) { //'4' for sixteenth note
      modifyNote(voices, noteNameToDuration['thirtysecond'], false)
    } else if (event.keyCode === 53) { //'5' for quarter rest
      modifyNote(voices, noteNameToDuration['quarter'], true)
    } else if (event.keyCode === 54) { //'6' for eighth rest
      modifyNote(voices, noteNameToDuration['eighth'], true)
    } else if (event.keyCode === 55) { //'7' for sixteenth rest
      modifyNote(voices, noteNameToDuration['sixteenth'], true)
    } else if (event.keyCode === 56) { //'8' for thirtysecond rest
      modifyNote(voices, noteNameToDuration['thirtysecond'], true)
    } else if (event.keyCode === 57) { //'9' for whole note
      modifyNote(voices, noteNameToDuration['whole'], false)
    } else if (event.keyCode === 48) { //'0 for half note
      modifyNote(voices, noteNameToDuration['half'], false)
    } else if (event.keyCode === 189) { //'-' for whole note
      modifyNote(voices, noteNameToDuration['whole'], true)
    } else if (event.keyCode === 187) { //'=' for whole note
      modifyNote(voices, noteNameToDuration['half'], true)
    } else if (event.keyCode === 37) { //'left arrow key' to select previous note
      selectPreviousNote();
    } else if (event.keyCode === 39) { //'right arrow key' to select next note
      selectNextNote();
    }
  }, [voices, modifyNote, startStop, toggleLeftSticking, toggleRightSticking, toggleDiddle, 
     toggleCheese, toggleFlam, toggleAccent, selectNextNote, selectPreviousNote]);

  useEffect(() => {
    console.log('add event listener');
    window.addEventListener('keydown', handleKeyEvents)
  }, [handleKeyEvents])

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
    drawScore(
      renderer,
      context,
      score,
      selectedNoteIndex,
      noteSelectedCallback,
      windowWidth,
      repeat
    );
  }, [windowWidth, score, noteSelectedCallback, selectedNoteIndex, repeat, dispatch, props.selectedTab, props.tabPanelHidden]);

  return (
    <div className="vexflow-wrapper">
      <div onKeyDown={handleKeyEvents} id="vexflow" key={Math.random().toString()} />
    </div>
  );
}

const mapStateToProps = (state) => {
  return {
    voices: state.score.present.voices.set,
  }
}

const mapDispatchToProps = (dispatch) => {
  return {
    startStop: () => dispatch(scoreActions.startStop()),
    toggleLeftSticking: () => dispatch(scoreActions.toggleLeftSticking()),
    toggleRightSticking: () => dispatch(scoreActions.toggleRightSticking()),
    toggleDiddle: () => dispatch(scoreActions.toggleDiddle()),
    toggleCheese: () => dispatch(scoreActions.toggleCheese()),
    toggleFlam: () => dispatch(scoreActions.toggleFlam()),
    toggleAccent: () => dispatch(scoreActions.toggleAccent()),
    modifyNote: (voices, value, isRest) => dispatch(scoreActions.modifyNote({voices, value, isRest})),
    selectNextNote: () => dispatch(scoreActions.selectNextNote()),
    selectPreviousNote: () => dispatch(scoreActions.selectPreviousNote()),
  }
}

const ConnectedScore = connect(
  mapStateToProps,
  mapDispatchToProps
)(Score)

export default ConnectedScore;