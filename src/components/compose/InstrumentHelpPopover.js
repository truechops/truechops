import { useState } from "react";
import Popover from "@material-ui/core/Popover";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import { BiHelpCircle } from 'react-icons/bi';

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

  const handlePopoverOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handlePopoverClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  return (
    <div>
      <div style={{marginRight: theme.compose.buttons.tooltip.marginRight}}
        aria-owns={open ? "mouse-over-popover" : undefined}
        aria-haspopup="true"
        onMouseEnter={handlePopoverOpen}
        onMouseLeave={handlePopoverClose}
      >
        <BiHelpCircle size={20}/>
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
        K = Kick
        <br />
        S = Snare
        <br />
        HH = HiHat
        <br />
        R = Ride
        <br />
        HF = Hi Hat Foot
        <br />
        T1 = Tom 1 (High Tom)
        <br />
        T2 = Tom 2 (Middle Tom)
        <br />
        T3 = Tom 3 (Low Tom)
        <br />
        T4 = Tom 4 (Floor Tom)
      </Popover>
    </div>
  );
}
