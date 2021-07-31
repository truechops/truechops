import { useState, useEffect } from "react";
import { Popover, ClickAwayListener } from "@material-ui/core";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import { BiHelpCircle } from 'react-icons/bi';
import useInstruments from '../buttons/instruments-hook';

const useStyles = makeStyles((theme) => ({
  popover: {
    pointerEvents: "none"
  },
  paper: {
    padding: theme.spacing(1)
  }
}));

export default function MouseOverPopover() {
  const classes = useStyles();
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);
  const { tooltipText } = useInstruments();

  const handlePopoverOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handlePopoverClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  return (
    
      <>
      <div style={{marginRight: theme.compose.buttons.tooltip.marginRight}}
        aria-owns={open ? "instrument-help-popover" : undefined}
        aria-haspopup="true"
        onMouseEnter={handlePopoverOpen}
        onClick={handlePopoverOpen}
        onMouseLeave={handlePopoverClose}
      >
        <BiHelpCircle size={25}/>
      </div>
      
      <Popover
        id="instrument-help-popover"
        className={classes.popover}
        classes={{
          paper: classes.paper
        }}
        open={open}
        anchorEl={anchorEl}
        onClose={handlePopoverClose}
        disableRestoreFocus
      >
        <ClickAwayListener onClickAway={() => {
      setAnchorEl(null)
      }}>
        <div id ="instrumentTooltipText">
       {tooltipText}
       <br />
       <br />
       -----KEYBOARD SHORTCUTS-----
       <br />
       left/right arrow - note navigation
       <br />
       a - accent
       <br />
       f - flam
       <br />
       d - diddle
       <br />
       c - cheese
       <br />
       R/L - stickings
       <br />
       space - play score
       <br />
       0-9, -, + notes
       <br />
       ctrl+z, ctrl+y - undo/redo
       </div>
       


       </ClickAwayListener>
      </Popover>
      </>
      
  );
}
