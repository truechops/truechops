import { useState, useEffect } from "react";
import { Popover, ClickAwayListener } from "@material-ui/core";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import { BiHelpCircle } from 'react-icons/bi';
import useInstruments from '../hooks/instruments-hook';

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
        aria-owns={open ? "mouse-over-popover" : undefined}
        aria-haspopup="true"
        onMouseEnter={handlePopoverOpen}
        onClick={handlePopoverOpen}
        onMouseLeave={handlePopoverClose}
      >
        <BiHelpCircle size={25}/>
      </div>
      
      <Popover
        id="mouse-over-popover"
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
       </div>
       </ClickAwayListener>
      </Popover>
      </>
      
  );
}
