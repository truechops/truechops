import { useDispatch, useSelector } from "react-redux";
import { scoreActions } from "../../store/score";

import { noteNameToDuration } from '../../../data/score-config';
import { ActionCreators } from "redux-undo";
import { useCallback } from "react";

export default function useComposeEventListeners() {
  const dispatch = useDispatch();
  const voices = useSelector(state => state.score.present.voices.set);

  const handleKeyEvents = useCallback((event) => {
    function modifyNote(voices, value, isRest) {
      dispatch(scoreActions.modifyNote({ voices, value, isRest }))
    }

    if (event.keyCode === 32) {
      //spacebar
      dispatch(scoreActions.startStop());
    } else if (event.keyCode === 76) {
      //'l' for left sticking
      dispatch(scoreActions.toggleLeftSticking());
    } else if (event.keyCode === 82) {
      //'r' for right sticking
      dispatch(scoreActions.toggleRightSticking());
    } else if (event.keyCode === 68) {
      //'d' for diddle
      dispatch(scoreActions.toggleDiddle());
    } else if (event.keyCode === 67) {
      //'c' for cheese
      dispatch(scoreActions.toggleCheese());
    } else if (event.keyCode === 70) {
      //'f' for flam
      dispatch(scoreActions.toggleFlam());
    } else if (event.keyCode === 65) {
      //'a' for accent
      dispatch(scoreActions.toggleAccent());
    } else if (event.keyCode === 49) {
      //'1' for quarter note
      modifyNote(voices, noteNameToDuration["quarter"], false);
    } else if (event.keyCode === 50) {
      //'2' for eighth note
      modifyNote(voices, noteNameToDuration["eighth"], false);
    } else if (event.keyCode === 51) {
      //'3' for sixteenth note
      modifyNote(voices, noteNameToDuration["sixteenth"], false);
    } else if (event.keyCode === 52) {
      //'4' for sixteenth note
      modifyNote(voices, noteNameToDuration["thirtysecond"], false);
    } else if (event.keyCode === 53) {
      //'5' for quarter rest
      modifyNote(voices, noteNameToDuration["quarter"], true);
    } else if (event.keyCode === 54) {
      //'6' for eighth rest
      modifyNote(voices, noteNameToDuration["eighth"], true);
    } else if (event.keyCode === 55) {
      //'7' for sixteenth rest
      modifyNote(voices, noteNameToDuration["sixteenth"], true);
    } else if (event.keyCode === 56) {
      //'8' for thirtysecond rest
      modifyNote(voices, noteNameToDuration["thirtysecond"], true);
    } else if (event.keyCode === 57) {
      //'9' for whole note
      modifyNote(voices, noteNameToDuration["whole"], false);
    } else if (event.keyCode === 48) {
      //'0 for half note
      modifyNote(voices, noteNameToDuration["half"], false);
    } else if (event.keyCode === 189) {
      //'-' for whole note
      modifyNote(voices, noteNameToDuration["whole"], true);
    } else if (event.keyCode === 187) {
      //'=' for whole note
      modifyNote(voices, noteNameToDuration["half"], true);
    } else if (event.keyCode === 37) {
      //'left arrow key' to select previous note
      dispatch(scoreActions.selectPreviousNote());
    } else if (event.keyCode === 39) {
      //'right arrow key' to select next note
      dispatch(scoreActions.selectNextNote());
    } else if (event.keyCode == 90 && event.ctrlKey) {
      //control + z
      dispatch(ActionCreators.undo());
    } else if (event.keyCode == 89 && event.ctrlKey) {
      //control + y
      dispatch(ActionCreators.redo());
    }
  }, [dispatch, voices]);

  return {
    setup: useCallback(() => window.addEventListener("keydown", handleKeyEvents), [handleKeyEvents])
  }
}