import { Button, Icon } from "@material-ui/core";
import Chip from "@material-ui/core/Chip";
import { useState } from 'react';
import Image from '../ui/Image';

import { makeStyles } from "@material-ui/core/styles";

const durationLookup = {
  "whole" : 1,
  "half" : 2,
  "quarter" : 4,
  "eighth" : 8,
  "sixteenth" : 16,
  "thirtysecond" : 32
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
    const [kickSelected, setKickSelected] = useState(false);
    const [snareSelected, setSnareSelected] = useState(false);
    const [hatSelected, setHatSelected] = useState(false);
    const [tom1Selected, setTom1Selected] = useState(false);
    const [tom2Selected, setTom2Selected] = useState(false);
    const [tom3Selected, setTom3Selected] = useState(false);
    const [tom4Selected, setTom4Selected] = useState(false);
    const [rideSelected, setRideSelected] = useState(false);
    const [hatFootSelected, setHatFootSelected] = useState(false);
    const [dotSelected, setDotSelected] = useState(false);

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
          onClick={() => setDotSelected((selected) => !selected)}
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
          onClick: () => setKickSelected((selected) => !selected),
          label: "K",
          variant: kickSelected ? "default" : "outlined",
        },
        {
          onClick: () => setSnareSelected((selected) => !selected),
          label: "S",
          variant: snareSelected ? "default" : "outlined",
        },
        {
          onClick: () => setHatSelected((selected) => !selected),
          label: "HH",
          variant: hatSelected ? "default" : "outlined",
        },
        {
          onClick: () => setRideSelected((selected) => !selected),
          label: "R",
          variant: rideSelected ? "default" : "outlined",
        },
        {
          onClick: () => setHatFootSelected((selected) => !selected),
          label: "HF",
          variant: hatFootSelected ? "default" : "outlined",
        },
      ].map(getInstrumentRow);
    
      const instrumentsRow2 = [
        {
          onClick: () => setTom1Selected((selected) => !selected),
          label: "T1",
          variant: tom1Selected ? "default" : "outlined",
        },
        {
          onClick: () => setTom2Selected((selected) => !selected),
          label: "T2",
          variant: tom2Selected ? "default" : "outlined",
        },
        {
          onClick: () => setTom3Selected((selected) => !selected),
          label: "T3",
          variant: tom3Selected ? "default" : "outlined",
        },
        {
          onClick: () => setTom4Selected((selected) => !selected),
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
        "addMeasure",
        "deleteMeasure",
        "leftRepeat",
        "rightRepeat",
        "repeatMeasure"
      ].map((ornament) => (
        ComposeButton(`/icons/measure/${ornament}.svg`, classes.imageIcon)
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

