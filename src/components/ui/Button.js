import Button from "@material-ui/core/Button";
import { useTheme } from "@material-ui/core/styles";

export default function SvgButton({ onClick, selected, children, disabled }) {
  const theme = useTheme();

  return (
    <Button
      onClick={onClick}
      key={Math.random().toString()}
      variant="outlined"
      disableRipple
      disabled={disabled}
      style={{
        ...theme.buttons.root,
        ...(selected ? theme.buttons.selected : {})
      }}
    >
      {children}
    </Button>
  );
}
