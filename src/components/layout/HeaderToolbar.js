import { useSelector } from "react-redux";
import { useTheme } from "@mui/styles";
import CircularProgress from "@mui/material/CircularProgress";

export default function HeaderToolbar() {
  const loaded = useSelector((state) => state.app.loaded);
  const theme = useTheme();
  return !loaded ? <CircularProgress style={theme.spinner} /> : null;
}
