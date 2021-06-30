import ReactGA from "react-ga";

import { ACCENT, FLAM, DIDDLE, CHEESE, LEFT_STICKING, RIGHT_STICKING } from '../../../store/score';

import ThirtysecondNoteIcon from "../../../../icons/notes/thirtysecond.svg";
import SixteenthNoteIcon from "../../../../icons/notes/sixteenth.svg";
import EighthNoteIcon from "../../../../icons/notes/eighth.svg";
import QuarterNoteIcon from "../../../../icons/notes/quarter.svg";
import HalfNoteIcon from "../../../../icons/notes/half.svg";
import WholeNoteIcon from "../../../../icons/notes/whole.svg";

import ThirtysecondNoteRestIcon from "../../../../icons/notes/thirtysecondRest.svg";
import SixteenthNoteRestIcon from "../../../../icons/notes/sixteenthRest.svg";
import EighthNoteRestIcon from "../../../../icons/notes/eighthRest.svg";
import QuarterNoteRestIcon from "../../../../icons/notes/quarterRest.svg";
import HalfNoteRestIcon from "../../../../icons/notes/halfRest.svg";
import WholeNoteRestIcon from "../../../../icons/notes/wholeRest.svg";

import RepeatEndIcon from "../../../../icons/measure/repeatEnd.svg";
import RepeatStartIcon from "../../../../icons/measure/repeatStart.svg";
import AddLeftIcon from "../../../../icons/measure/addLeft.svg";
import AddRightIcon from "../../../../icons/measure/addRight.svg";
import DeleteMeasureIcon from "../../../../icons/measure/deleteMeasure.svg";

import AccentIcon from "../../../../icons/ornaments/accent.svg";
import CheeseIcon from "../../../../icons/ornaments/cheese.svg";
import DiddleIcon from "../../../../icons/ornaments/diddle.svg";
import FlamIcon from "../../../../icons/ornaments/flam.svg";
import LeftStickingIcon from "../../../../icons/ornaments/leftSticking.svg";
import RightStickingIcon from "../../../../icons/ornaments/rightSticking.svg";

import Button from "../../ui/Button";

import SvgButton from "../../ui/SvgButton";

import { makeStyles } from "@material-ui/core/styles";
import { useDispatch } from "react-redux";
import { scoreActions } from "../../../store/score";
import { noteNameToDuration } from "../../../../data/score-config";

const useTabStyles = makeStyles((theme) => ({
  chips: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  chip: {
    ...theme.compose.buttons.chip,
  },
  imageIcon: {
    display: "flex",
    height: "inherit",
    width: "inherit",
  },
  imageSelected: {
    filter: "invert(1)",
  },
  wholeNoteImageIcon: {
    position: "relative",
    ...theme.compose.buttons.wholeNote,
  },
  noteButton: {
    //...theme.compose.buttons.note,
  },
  noteButtonSelected: {
    backgroundColor: "black",
  },
}));

export default function useComposeButtons(
  modifyNoteHandler,
  isPlaying,
  voices,
  dotSelected,
  repeat,
  selectedNote
) {
  const kickSelected = voices.kickSelected;
  const snareSelected = voices.snareSelected;
  const hatSelected = voices.hiHatSelected;
  const tom1Selected = voices.tom1Selected;
  const tom2Selected = voices.tom2Selected;
  const tom3Selected = voices.tom3Selected;
  const tom4Selected = voices.tom4Selected;
  const rideSelected = voices.rideSelected;
  const hatFootSelected = voices.hiHatFootSelected;
  let selectedMeasureIndex = null;

  let accentSelected = false;
  let diddleSelected = false;
  let flamSelected = false;
  let cheeseSelected = false;
  let leftStickingSelected = false;
  let rightStickingSelected = false;

  //If there is a selected note
  if (selectedNote) {
    accentSelected = selectedNote.ornaments
      ? selectedNote.ornaments.includes(ACCENT)
      : false;
    diddleSelected = selectedNote.ornaments
      ? selectedNote.ornaments.includes(DIDDLE)
      : false;
    flamSelected = selectedNote.ornaments
      ? selectedNote.ornaments.includes(FLAM)
      : false;
    cheeseSelected = selectedNote.ornaments
      ? selectedNote.ornaments.includes(CHEESE)
      : false;
    leftStickingSelected = selectedNote.ornaments
      ? selectedNote.ornaments.includes(LEFT_STICKING)
      : false;
    rightStickingSelected = selectedNote.ornaments
      ? selectedNote.ornaments.includes(RIGHT_STICKING)
      : false;
    selectedMeasureIndex = selectedNote.measureIndex;
  }

  const repeatStart = repeat.start;
  const repeatEnd = repeat.end;

  const dispatch = useDispatch();

  const classes = useTabStyles();
  const noteButtonsRow1 = [
    {
      onClick: modifyNoteHandler.bind(null, noteNameToDuration["whole"], false),
      viewBox: "-12 -12 40 32",
      component: WholeNoteIcon,
    },
    {
      onClick: modifyNoteHandler.bind(null, noteNameToDuration["half"], false),
      viewBox: "0 0 15.28 42.64",
      component: HalfNoteIcon,
    },
    {
      onClick: modifyNoteHandler.bind(
        null,
        noteNameToDuration["quarter"],
        false
      ),
      viewBox: "0 0 15.28 42.64",
      component: QuarterNoteIcon,
    },
    {
      onClick: modifyNoteHandler.bind(
        null,
        noteNameToDuration["eighth"],
        false
      ),
      viewBox: "0 0 29 43",
      component: EighthNoteIcon,
    },
    {
      onClick: modifyNoteHandler.bind(
        null,
        noteNameToDuration["sixteenth"],
        false
      ),
      viewBox: "0 0 28.43 50",
      component: SixteenthNoteIcon,
    },
    {
      onClick: modifyNoteHandler.bind(
        null,
        noteNameToDuration["thirtysecond"],
        false
      ),
      viewBox: "0 0 28.43 50",
      component: ThirtysecondNoteIcon,
    },
  ].map((props) => (
    <SvgButton
      key={Math.random().toString()}
      onClick={props.onClick}
      viewBox={props.viewBox}
      component={props.component}
    />
  ));

  const noteButtonsRow2Mobile = [
    {
      onClick: modifyNoteHandler.bind(null, noteNameToDuration["whole"], true),
      viewBox: "-14 -12 80 40",
      component: WholeNoteRestIcon,
    },
    {
      onClick: modifyNoteHandler.bind(null, noteNameToDuration["half"], true),
      viewBox: "-14 -12 80 40",
      component: HalfNoteRestIcon,
    },
    {
      onClick: modifyNoteHandler.bind(
        null,
        noteNameToDuration["quarter"],
        true
      ),
      viewBox: "0 0 16.05 43.81",
      component: QuarterNoteRestIcon,
    },
    {
      onClick: modifyNoteHandler.bind(null, noteNameToDuration["eighth"], true),
      viewBox: "0 0 20.04 34",
      component: EighthNoteRestIcon,
    },
    {
      onClick: modifyNoteHandler.bind(
        null,
        noteNameToDuration["sixteenth"],
        true
      ),
      viewBox: "0 0 26.27 50",
      component: SixteenthNoteRestIcon,
    },
    {
      onClick: modifyNoteHandler.bind(
        null,
        noteNameToDuration["thirtysecond"],
        true
      ),
      viewBox: "0 0 25.82 50",
      component: ThirtysecondNoteRestIcon,
    },
  ].map((props) => (
    <SvgButton
      key={Math.random().toString()}
      onClick={props.onClick}
      viewBox={props.viewBox}
      component={props.component}
    />
  ));

  const tupletButtons = ["3:2", "3:2"].map((tupletText) => (
    <Button
      key={Math.random().toString()}
      variant="outlined"
      className={classes.noteButton}
    >
      {tupletText}
    </Button>
  ));

  /*const noteButtonsRow2Desktop = [
    "thirtysecondRest",
    "sixteenthRest",
    "eighthRest",
    "quarterRest",
    "halfRest",
    "wholeRest",
  ].map((noteFileName) =>
    ComposeButton(
      `/icons/notes/${noteFileName}.svg`,
      ["wholeRest", "halfRest"].includes(noteFileName)
        ? classes.wholeNoteImageIcon
        : classes.imageIcon,
      modifyNoteHandler.bind(
        null,
        noteNameToDuration[noteFileName.replace("Rest", "")]
      )
    )
  );*/

  const noteButtonsRow2Desktop = noteButtonsRow2Mobile.slice().reverse();

  const instrumentsRow1 = [
    {
      onClick: () => {
        ReactGA.event({
          category: "voices",
          action: "toggle kick",
        });
        dispatch(scoreActions.toggleKickSelected());
      },
      text: "K",
      selected: kickSelected,
    },
    {
      onClick: () => {
        ReactGA.event({
          category: "voices",
          action: "toggle snare",
        });
        dispatch(scoreActions.toggleSnareSelected());
      },
      text: "S",
      selected: snareSelected,
    },
    {
      onClick: () => {
        ReactGA.event({
          category: "voices",
          action: "toggle hihat",
        });
        dispatch(scoreActions.toggleHiHatSelected());
      },
      text: "HH",
      selected: hatSelected,
    },
    {
      onClick: () => {
        ReactGA.event({
          category: "voices",
          action: "toggle ride",
        });
        dispatch(scoreActions.toggleRideSelected());
      },
      text: "R",
      selected: rideSelected,
    },
    {
      onClick: () => {
        ReactGA.event({
          category: "voices",
          action: "toggle hihat foot",
        });
        dispatch(scoreActions.toggleHiHatFootSelected());
      },
      text: "HF",
      selected: hatFootSelected,
    },
  ].map((props) => (
    <Button
      key={Math.random().toString()}
      onClick={props.onClick}
      selected={props.selected}
    >
      {props.text}
    </Button>
  ));

  const instrumentsRow2 = [
    {
      onClick: () => {
        ReactGA.event({
          category: "voices",
          action: "toggle tom1",
        });
        dispatch(scoreActions.toggleTom1Selected());
      },
      text: "T1",
      selected: tom1Selected,
    },
    {
      onClick: () => {
        ReactGA.event({
          category: "voices",
          action: "toggle tom2",
        });
        dispatch(scoreActions.toggleTom2Selected());
      },
      text: "T2",
      selected: tom2Selected,
    },
    {
      onClick: () => {
        ReactGA.event({
          category: "voices",
          action: "toggle tom3",
        });
        dispatch(scoreActions.toggleTom3Selected());
      },
      text: "T3",
      selected: tom3Selected,
    },
    {
      onClick: () => {
        ReactGA.event({
          category: "voices",
          action: "toggle tom4",
        });
        dispatch(scoreActions.toggleTom4Selected());
      },
      text: "T4",
      selected: tom4Selected,
    },
    {
      onClick: () => dispatch(scoreActions.toggleDotSelected()),
      text: ".",
      selected: dotSelected,
    },
  ].map((props) => (
    <Button
      key={Math.random().toString()}
      onClick={props.onClick}
      selected={props.selected}
    >
      {props.text}
    </Button>
  ));

  const ornamentButtons = [
    {
      component: LeftStickingIcon,
      onClick: () => {
        ReactGA.event({
          category: "ornament",
          action: "toggle left sticking",
        });
        dispatch(scoreActions.toggleLeftSticking());
      },
      viewBox: "0 0 39.33 50",
      selected: leftStickingSelected,
    },
    {
      component: RightStickingIcon,
      onClick: () => {
        ReactGA.event({
          category: "ornament",
          action: "toggle right sticking",
        });
        dispatch(scoreActions.toggleRightSticking());
      },
      viewBox: "0 0 39.33 49.55",
      selected: rightStickingSelected,
    },
    {
      component: AccentIcon,
      onClick: () => {
        ReactGA.event({
          category: "ornament",
          action: "toggle accent",
        });
        dispatch(scoreActions.toggleAccent());
      },
      viewBox: "0 0 42.39 50",
      selected: accentSelected,
    },
    {
      component: FlamIcon,
      onClick: () => {
        ReactGA.event({
          category: "ornament",
          action: "toggle flam",
        });
        dispatch(scoreActions.toggleFlam());
      },
      viewBox: "0 0 47.58 50",
      selected: flamSelected,
    },
    {
      component: DiddleIcon,
      onClick: () => {
        ReactGA.event({
          category: "ornament",
          action: "toggle diddle",
        });
        dispatch(scoreActions.toggleDiddle());
      },
      viewBox: "0 0 55.55 50",
      selected: diddleSelected,
    },
    {
      component: CheeseIcon,
      onClick: () => {
        ReactGA.event({
          category: "ornament",
          action: "toggle cheese",
        });
        dispatch(scoreActions.toggleCheese());
      },
      viewBox: "0 0 66.8 50",
      selected: cheeseSelected,
    },
  ].map((props) => (
    <SvgButton
      key={Math.random().toString()}
      onClick={props.onClick}
      selected={props.selected}
      viewBox={props.viewBox}
      component={props.component}
    />
  ));

  const measureButtons = [
    {
      component: AddLeftIcon,
      onClick: () => dispatch(scoreActions.addMeasure(false)),
      viewBox: "0 0 18 14",
      disabled: isPlaying,
    },
    {
      component: AddRightIcon,
      onClick: () => dispatch(scoreActions.addMeasure(true)),
      viewBox: "0 0 18 14",
      disabled: isPlaying,
    },
    {
      component: DeleteMeasureIcon,
      onClick: () => dispatch(scoreActions.deleteMeasure()),
      viewBox: "0 0 68.2 52.01",
      disabled: isPlaying,
    },
    {
      component: RepeatStartIcon,
      onClick: () => dispatch(scoreActions.setRepeatStart()),
      selected:
        selectedMeasureIndex != null &&
        repeatStart != null &&
        selectedMeasureIndex === repeatStart,
      viewBox: "0 0 68.2 52.01",
      disabled: isPlaying,
    },
    {
      component: RepeatEndIcon,
      onClick: () => dispatch(scoreActions.setRepeatEnd()),
      selected:
        selectedMeasureIndex != null &&
        repeatEnd != null &&
        selectedMeasureIndex === repeatEnd,
      viewBox: "0 0 68.2 52.01",
      disabled: isPlaying,
    },
  ].map((props) => (
    <SvgButton
      key={Math.random().toString()}
      onClick={props.onClick}
      selected={props.selected}
      viewBox={props.viewBox}
      component={props.component}
      disabled={props.disabled}
    />
  ));

  return {
    measureButtons,
    ornamentButtons,
    instrumentsRow1,
    instrumentsRow2,
    noteButtonsRow1,
    noteButtonsRow2Mobile,
    noteButtonsRow2Desktop,
    tupletButtons,
  };
}
