import { scoreActions } from "../../store/score";

import { noteNameToDuration } from "../../../consts/score";
import { ActionCreators } from "redux-undo";
import ReactGA from "react-ga";

/**
 * 
 * @param {*} dispatch 
 * @param {*} eventHandler ensures that events can be can be conditionally executed, such
 * as when a modal is open and then user is typing in the name of the rhythm to save.
 */
export default function addComposeEventListeners(dispatch, eventHandler) {
  function handleKeyEvents(event) {
    function modifyNote(value, isRest) {
      dispatch(scoreActions.modifyNote({ value, isRest }));
    }

    if (event.keyCode === 32) {
      //spacebar
      ReactGA.event({
        category: "shortcuts",
        action: "start/stop score",
      });
      eventHandler(() => dispatch(scoreActions.startStop()));
    } else if (event.keyCode === 76) {
      ReactGA.event({
        category: "shortcuts",
        action: "toggle left sticking",
      });

      //'l' for left sticking
      eventHandler(() => dispatch(scoreActions.toggleLeftSticking()));
    } else if (event.keyCode === 82) {
      ReactGA.event({
        category: "shortcuts",
        action: "toggle right sticking",
      });

      //'r' for right sticking
      eventHandler(() => dispatch(scoreActions.toggleRightSticking()));
    } else if (event.keyCode === 68) {
      ReactGA.event({
        category: "shortcuts",
        action: "toggle diddle",
      });

      //'d' for diddle
      eventHandler(() => dispatch(scoreActions.toggleDiddle()));
    } else if (event.keyCode === 67) {
      ReactGA.event({
        category: "shortcuts",
        action: "toggle cheese",
      });

      //'c' for cheese
      eventHandler(() => dispatch(scoreActions.toggleCheese()));
    } else if (event.keyCode === 70) {
      ReactGA.event({
        category: "shortcuts",
        action: "toggle flam",
      });

      //'f' for flam
      eventHandler(() => dispatch(scoreActions.toggleFlam()));
    } else if (event.keyCode === 65) {
      ReactGA.event({
        category: "shortcuts",
        action: "toggle accent",
      });

      //'a' for accent
      eventHandler(() => dispatch(scoreActions.toggleAccent()));
    } else if (event.keyCode === 49) {
      ReactGA.event({
        category: "shortcuts",
        action: "quarter",
      });

      //'1' for quarter note
      eventHandler(() => modifyNote(noteNameToDuration["quarter"], false));
    } else if (event.keyCode === 50) {
      ReactGA.event({
        category: "shortcuts",
        action: "eighth",
      });

      //'2' for eighth note
      eventHandler(() => modifyNote(noteNameToDuration["eighth"], false));
    } else if (event.keyCode === 51) {
      ReactGA.event({
        category: "shortcuts",
        action: "sixteenth",
      });

      //'3' for sixteenth note
      eventHandler(() => modifyNote(noteNameToDuration["sixteenth"], false));
    } else if (event.keyCode === 52) {
      ReactGA.event({
        category: "shortcuts",
        action: "thirtysecond",
      });

      //'4' for sixteenth note
      eventHandler(() => modifyNote(noteNameToDuration["thirtysecond"], false));
    } else if (event.keyCode === 53) {
      ReactGA.event({
        category: "shortcuts",
        action: "quarter rest",
      });

      //'5' for quarter rest
      eventHandler(() => modifyNote(noteNameToDuration["quarter"], true));
    } else if (event.keyCode === 54) {
      ReactGA.event({
        category: "shortcuts",
        action: "eighth rest",
      });

      //'6' for eighth rest
      eventHandler(() => modifyNote(noteNameToDuration["eighth"], true));
    } else if (event.keyCode === 55) {
      ReactGA.event({
        category: "shortcuts",
        action: "sixteenth rest",
      });

      //'7' for sixteenth rest
      eventHandler(() => modifyNote(noteNameToDuration["sixteenth"], true));
    } else if (event.keyCode === 56) {
      ReactGA.event({
        category: "shortcuts",
        action: "thirtysecond rest",
      });

      //'8' for thirtysecond rest
      eventHandler(() => modifyNote(noteNameToDuration["thirtysecond"], true));
    } else if (event.keyCode === 57) {
      ReactGA.event({
        category: "shortcuts",
        action: "whole",
      });

      //'9' for whole note
      eventHandler(() => modifyNote(noteNameToDuration["whole"], false));
    } else if (event.keyCode === 48) {
      ReactGA.event({
        category: "shortcuts",
        action: "half",
      });

      //'0 for half note
      eventHandler(() => modifyNote(noteNameToDuration["half"], false));
    } else if (event.keyCode === 189) {
      ReactGA.event({
        category: "shortcuts",
        action: "whole rest",
      });

      //'-' for whole note rest
      eventHandler(() => modifyNote(noteNameToDuration["whole"], true));
    } else if (event.keyCode === 187) {
      ReactGA.event({
        category: "shortcuts",
        action: "half rest",
      });

      //'=' for whalf note rest
      eventHandler(() => modifyNote(noteNameToDuration["half"], true));
    } else if (event.keyCode === 37) {
      ReactGA.event({
        category: "shortcuts",
        action: "select prev note",
      });

      //'left arrow key' to select previous note
      eventHandler(() => dispatch(scoreActions.selectPreviousNote()));
    } else if (event.keyCode === 39) {
      ReactGA.event({
        category: "shortcuts",
        action: "select next note",
      });

      //'right arrow key' to select next note
      eventHandler(() => dispatch(scoreActions.selectNextNote()));
    } else if (event.keyCode == 90 && event.ctrlKey) {
      ReactGA.event({
        category: "shortcuts",
        action: "undo",
      });

      //control + z
      eventHandler(() => dispatch(ActionCreators.undo()));
    } else if (event.keyCode == 89 && event.ctrlKey) {
      ReactGA.event({
        category: "shortcuts",
        action: "redo",
      });

      //control + y
      eventHandler(() => dispatch(ActionCreators.redo()));
    }
  }
  window.addEventListener("keydown", handleKeyEvents);
}