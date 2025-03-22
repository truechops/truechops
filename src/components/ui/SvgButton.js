import Button from './Button';
import SvgIcon from '@mui/material/SvgIcon';
import { useTheme } from "@mui/styles";

export default function SvgButton({onClick, selected, viewBox, component, disabled}) {
    const theme = useTheme();

    return <Button
      onClick={onClick}
      selected={selected}
      disabled={disabled}
    >
      <SvgIcon viewBox={viewBox} 
               htmlColor={selected ? theme.buttons.svg.htmlColor.selected : theme.buttons.svg.htmlColor.notSelected}
               component={component} />
    </Button>
}