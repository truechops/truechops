import { Button, Icon } from "@material-ui/core";
import Chip from "@material-ui/core/Chip";
import { useState } from 'react';
import Image from '../../ui/Image';

import { makeStyles } from "@material-ui/core/styles";
import { useSelector, useDispatch } from 'react-redux';
import { scoreActions } from '../../../store/score';
import useMeasureFns from './measure-hook';

const durationLookup = {
  "whole" : 64,
  "half" : 32,
  "quarter" : 16,
  "eighth" : 8,
  "sixteenth" : 4,
  "thirtysecond" : 2
}

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
    wholeNoteImageIcon: {
      position: "relative",
      ...theme.compose.buttons.wholeNote   
    },
    noteButton: {
      ...theme.compose.buttons.note
    },
  }));

export default function useComposeButtons(modifyNoteHandler) {
    const kickSelected = useSelector(state => state.score.kickSelected);
    const snareSelected = useSelector(state => state.score.snareSelected);
    const hatSelected = useSelector(state => state.score.hiHatSelected);
    const tom1Selected = useSelector(state => state.score.tom1Selected);
    const tom2Selected = useSelector(state => state.score.tom2Selected);
    const tom3Selected = useSelector(state => state.score.tom3Selected);
    const tom4Selected = useSelector(state => state.score.tom4Selected);
    const rideSelected = useSelector(state => state.score.rideSelected);
    const hatFootSelected = useSelector(state => state.score.hiHatFootSelected);
    const dotSelected = useSelector(state => state.score.dotSelected);
    const dispatch = useDispatch();
    const { addMeasure, deleteMeasure } = useMeasureFns();

    const classes = useTabStyles();
      const ComposeButton = (src, className, onClick) => (
        <Button onClick={onClick} key={Math.random().toString()} variant="outlined" className={classes.noteButton}>
          <Icon>
            <Image src={src} className={className} />
          </Icon>
        </Button>
      );
    
      const getInstrumentRow = (config) => (
        <Chip
          onClick={config.onClick}
          className={classes.chip}
          label={config.label}
          clickable
          key={Math.random().toString()}
          variant={config.variant}
          color="primary"
        />
      );
    
      const noteButtonsRow1 = [
        "whole",
        "half",
        "quarter",
        "eighth",
        "sixteenth",
        "thirtysecond"
      ].map((noteFileName) => 
        ComposeButton(`/icons/notes/${noteFileName}.svg`, 
                      "whole" === noteFileName ? classes.wholeNoteImageIcon : classes.imageIcon,
                      modifyNoteHandler.bind(null, durationLookup[noteFileName])))
    
      const noteButtonsRow2Mobile = [
        "wholeRest",
        "halfRest",
        "quarterRest",
        "eighthRest",
        "sixteenthRest",
        "thirtysecondRest"
      ].map(noteFileName => ComposeButton(`/icons/notes/${noteFileName}.svg`, 
                    ["wholeRest", "halfRest"].includes(noteFileName) ? classes.wholeNoteImageIcon : classes.imageIcon,
                    modifyNoteHandler.bind(null, durationLookup[noteFileName.replace('Rest', '')])))
    
        const tupletButtons = ["3:2","3:2"].map(tupletText => <Button key={Math.random().toString()} variant="outlined" className={classes.noteButton}>
                                                            {tupletText}
                                                          </Button>)
    
    const noteButtonsRow2Desktop = [
        "thirtysecondRest",
        "sixteenthRest",
        "eighthRest",
        "quarterRest",
        "halfRest",
        "wholeRest",
      ].map(noteFileName => ComposeButton(`/icons/notes/${noteFileName}.svg`, 
                    ["wholeRest", "halfRest"].includes(noteFileName) ? classes.wholeNoteImageIcon : classes.imageIcon,
                    modifyNoteHandler.bind(null, durationLookup[noteFileName.replace('Rest', '')])))
    
      const dotChip = (
        <Chip
          onClick={() => dispatch(scoreActions.toggleDotSelected())}
          className={classes.chip}
          label="."
          clickable
          variant={dotSelected ? "default" : "outlined"}
          color="primary"
          key={Math.random().toString()}
        />
      );
    
      const instrumentsRow1 = [
        {
          onClick: () => dispatch(scoreActions.toggleKickSelected()),
          label: "K",
          variant: kickSelected ? "default" : "outlined",
        },
        {
          onClick: () => dispatch(scoreActions.toggleSnareSelected()),
          label: "S",
          variant: snareSelected ? "default" : "outlined",
        },
        {
          onClick: () => dispatch(scoreActions.toggleHiHatSelected()),
          label: "HH",
          variant: hatSelected ? "default" : "outlined",
        },
        {
          onClick: () => dispatch(scoreActions.toggleRideSelected()),
          label: "R",
          variant: rideSelected ? "default" : "outlined",
        },
        {
          onClick: () => dispatch(scoreActions.toggleHiHatFootSelected()),
          label: "HF",
          variant: hatFootSelected ? "default" : "outlined",
        },
      ].map(getInstrumentRow);
    
      const instrumentsRow2 = [
        {
          onClick: () => dispatch(scoreActions.toggleTom1Selected()),
          label: "T1",
          variant: tom1Selected ? "default" : "outlined",
        },
        {
          onClick: () => dispatch(scoreActions.toggleTom2Selected()),
          label: "T2",
          variant: tom2Selected ? "default" : "outlined",
        },
        {
          onClick: () => dispatch(scoreActions.toggleTom3Selected()),
          label: "T3",
          variant: tom3Selected ? "default" : "outlined",
        },
        {
          onClick: () => dispatch(scoreActions.toggleTom4Selected()),
          label: "T4",
          variant: tom4Selected ? "default" : "outlined",
        },
      ]
        .map(getInstrumentRow)
        .concat(dotChip);
    
      const ornamentButtons = [
        "leftSticking",
        "rightSticking",
        "accent",
        "flam",
        "diddle",
        "cheese",
      ].map((ornament) => (
        ComposeButton(`/icons/ornaments/${ornament}.svg`, classes.imageIcon)
      ));
    
      const measureButtons = [
        { icon: "plusLeft", callback: addMeasure.bind(null, false) },
        { icon: "plusRight", callback: addMeasure.bind(null, true) },
        { icon: "deleteMeasure", callback: deleteMeasure },
        { icon: "leftRepeat", callback: () => alert('left repeat') },
        { icon: "rightRepeat", callback: () => alert('right repeat') },
        { icon: "repeatMeasure", callback: () => alert('repeat measure') },
      ].map((props) => (
        ComposeButton(`/icons/measure/${props.icon}.svg`, classes.imageIcon, props.callback)
      ));

      return {
          measureButtons,
          ornamentButtons,
          instrumentsRow1, 
          instrumentsRow2,
          noteButtonsRow1, 
          noteButtonsRow2Mobile,
          noteButtonsRow2Desktop,
          tupletButtons
      }
}

