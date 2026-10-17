import { Menu, MenuItem } from "@mui/material";
import { timeSigs } from '../../../consts/score';

export default function TimeSigMenu(props) {
  const options = Object.keys(timeSigs);

  return (
    <Menu
      id="time-sig-menu"
      open={props.isOpen}
      anchorEl={props.anchorEl}
      onClose={props.onClose}
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "left",
      }}
      transformOrigin={{
        vertical: "top",
        horizontal: "left",
      }}
      PaperProps={{ className: props.className }}
      MenuListProps={{ "aria-label": "Time signature" }}
    >
        {options.map((timeSig) => (
          <MenuItem onClick={props.onChange.bind(null, timeSig)} key={timeSig} value={timeSig}>
            {timeSig}
          </MenuItem>
        ))}
    </Menu>
  );
}
