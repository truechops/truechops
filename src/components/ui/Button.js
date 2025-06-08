import Button from "@mui/material/Button";
import { useTheme } from "@mui/styles";

export default function TCButton({ onClick, id, selected, children, disabled }) {
  const theme = useTheme();
  const className = selected ? 'selected' : ''

  return (
    <Button
      onClick={onClick}
      id={id}
      variant="outlined"
      disableRipple
      disabled={disabled}
      className={className}
      style={{
        ...theme.buttons.root,
        ...(selected ? theme.buttons.selected : {})
      }}
    >
      {children}
    </Button>
  );
}
