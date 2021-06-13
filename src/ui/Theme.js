import { createMuiTheme } from "@material-ui/core/styles";

const primary = "#1c0000";
const secondary = "#960909";

export default createMuiTheme({
  palette: {
    primary: {
      main: `${primary}`,
    },
    secondary: {
      main: `${secondary}`,
    },
  },
  typography: {
    tab: {
      fontFamily: "Raleway",
      textTransform: "none",
      fontWeight: 700,
      fontSize: "1rem",
    }
  },
});
