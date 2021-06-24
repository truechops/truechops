import Button from './Button';
import SvgIcon from '@material-ui/core/SvgIcon';
import { useTheme } from "@material-ui/core/styles";

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