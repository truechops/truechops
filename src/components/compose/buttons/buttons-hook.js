import ReactGA from "react-ga";
import { useState, useCallback } from "react";

import {
  ACCENT,
  FLAM,
  DIDDLE,
  CHEESE,
  LEFT_STICKING,
  BUZZ,
  RIGHT_STICKING,
} from "../../../store/score";

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
import AddMeasureLeftIcon from "../../../../icons/measure/addMeasureLeft.svg";
import AddMeasureRightIcon from "../../../../icons/measure/addMeasureRight.svg";
import DeleteMeasureIcon from "../../../../icons/measure/deleteMeasure.svg";

import AccentIcon from "../../../../icons/ornaments/accent.svg";
import BuzzIcon from "../../../../icons/ornaments/buzz.svg";
import CheeseIcon from "../../../../icons/ornaments/cheese.svg";
import DiddleIcon from "../../../../icons/ornaments/diddle.svg";
import FlamIcon from "../../../../icons/ornaments/flam.svg";
import LeftStickingIcon from "../../../../icons/ornaments/leftSticking.svg";
import RightStickingIcon from "../../../../icons/ornaments/rightSticking.svg";

import Button from "../../ui/Button";

import SvgButton from "../../ui/SvgButton";

import { makeStyles } from "@mui/styles";
import { useDispatch, useSelector } from "react-redux";
import { scoreActions } from "../../../store/score";

import useInstruments from "./instruments-hook";
import TimeSigMenu from "../menus/TimeSigMenu";

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
  dotSelected,
  tupletSelected,
  repeat,
  selectedNote
) {
  const { voiceButtons } = useInstruments();
  const dispatch = useDispatch();
  const { num : timeSigNum, type: timeSigType } = useSelector(state => state.score.present.timeSig);
  const measureSelected = useSelector(state => "selectedNoteIndex" in state.score.present && state.score.present.selectedNoteIndex);

  const [timeSigPickerAnchorEl, setTimeSigPickerAnchorEl] = useState();
  const timeSigPickerOpen = Boolean(timeSigPickerAnchorEl);

  const handleTimeSigClick = () => {
    setTimeSigPickerAnchorEl(document.getElementById("composeButtonsTabPanel"));
  };

  const handleTimeSigPickerClose = () => {
    setTimeSigPickerAnchorEl(null);
  };

  const handleTimeSigChange = (newValue) => {
    const newValueSplit = newValue.split('/');
    dispatch(scoreActions.updateTimeSig({num: newValueSplit[0], type: newValueSplit[1]}));
    setTimeSigPickerAnchorEl(null);
  };

  let selectedMeasureIndex = null;

  let accentSelected = false;
  let buzzSelected = false
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
    buzzSelected = selectedNote.ornaments
      ? selectedNote.ornaments.includes(BUZZ)
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

  const classes = useTabStyles();
  const noteButtonsRow1 = [
    {
      onClick: modifyNoteHandler.bind(null, "whole", false),
      viewBox: "-12 -12 40 32",
      component: WholeNoteIcon,
    },
    {
      onClick: modifyNoteHandler.bind(null, "half", false),
      viewBox: "0 0 15.28 42.64",
      component: HalfNoteIcon,
    },
    {
      onClick: modifyNoteHandler.bind(null, "quarter", false),
      viewBox: "0 0 15.28 42.64",
      component: QuarterNoteIcon,
    },
    {
      onClick: modifyNoteHandler.bind(null, "eighth", false),
      viewBox: "0 0 29 43",
      component: EighthNoteIcon,
    },
    {
      onClick: modifyNoteHandler.bind(null, "sixteenth", false),
      viewBox: "0 0 28.43 50",
      component: SixteenthNoteIcon,
    },
    {
      onClick: modifyNoteHandler.bind(null, "thirtysecond", false),
      viewBox: "0 0 28.43 50",
      component: ThirtysecondNoteIcon,
      disabled: dotSelected
    },
  ].map((props) => (
    <SvgButton
      key={Math.random().toString()}
      onClick={props.onClick}
      viewBox={props.viewBox}
      component={props.component}
      disabled={props.disabled}
    />
  ));

  const noteButtonsRow2Mobile = [
    {
      onClick: modifyNoteHandler.bind(null, "whole", true),
      viewBox: "-14 -12 80 40",
      component: WholeNoteRestIcon,
    },
    {
      onClick: modifyNoteHandler.bind(null, "half", true),
      viewBox: "-14 -12 80 40",
      component: HalfNoteRestIcon,
    },
    {
      onClick: modifyNoteHandler.bind(null, "quarter", true),
      viewBox: "0 0 16.05 43.81",
      component: QuarterNoteRestIcon,
    },
    {
      onClick: modifyNoteHandler.bind(null, "eighth", true),
      viewBox: "0 0 20.04 34",
      component: EighthNoteRestIcon,
    },
    {
      onClick: modifyNoteHandler.bind(null, "sixteenth", true),
      viewBox: "0 0 26.27 50",
      component: SixteenthNoteRestIcon,
    },
    {
      onClick: modifyNoteHandler.bind(null, "thirtysecond", true),
      viewBox: "0 0 25.82 50",
      component: ThirtysecondNoteRestIcon,
      disabled: dotSelected
    },
  ].map((props) => (
    <SvgButton
      key={Math.random().toString()}
      onClick={props.onClick}
      viewBox={props.viewBox}
      component={props.component}
      disabled={props.disabled}
    />
  ));

  const dotButton = (
    <Button
      key={Math.random().toString()}
      variant="outlined"
      className={classes.noteButton}
      selected={dotSelected}
      onClick={() => dispatch(scoreActions.toggleDotSelected())}
    >
      .
    </Button>
  );
  const noteButtonsRow2Desktop = noteButtonsRow2Mobile.slice().reverse();

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
      component: BuzzIcon,
      onClick: () => {
        ReactGA.event({
          category: "ornament",
          action: "toggle buzz",
        });
        dispatch(scoreActions.toggleBuzz());
      },
      viewBox: "0 0 75 68",
      selected: buzzSelected,
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

  let measureButtons = [
    {
      component: AddMeasureLeftIcon,
      onClick: () => dispatch(scoreActions.addMeasure(false)),
      viewBox: "0 0 77 52",
      disabled: isPlaying,
    },
    {
      component: AddMeasureRightIcon,
      onClick: () => dispatch(scoreActions.addMeasure(true)),
      viewBox: "0 0 88 52",
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

  measureButtons.push(
    <>
      <Button
        disabled={!measureSelected}
        key={Math.random().toString()}
        variant="outlined"
        className={classes.noteButton}
        onClick={handleTimeSigClick}
      >
        {`${timeSigNum}/${timeSigType}`}
      </Button>
      <TimeSigMenu
        isOpen={timeSigPickerOpen}
        anchorEl={timeSigPickerAnchorEl}
        onClose={handleTimeSigPickerClose}
        onChange={handleTimeSigChange}
      />
    </>
  );

  return {
    measureButtons,
    ornamentButtons,
    voiceButtons,
    noteButtonsRow1,
    noteButtonsRow2Mobile,
    noteButtonsRow2Desktop,
    dotButton,
  };
}
