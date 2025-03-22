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
        vertical: "top",
        horizontal: "right",
      }}
      transformOrigin={{
        vertical: "top",
        horizontal: "right",
      }}
    >
        {options.map((timeSig) => (
          <MenuItem onClick={props.onChange.bind(null, timeSig)} key={Math.random().toString()} value={timeSig}>
            {timeSig}
          </MenuItem>
        ))}
    </Menu>
  );
}
