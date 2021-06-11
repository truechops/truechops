import { createMuiTheme } from "@material-ui/core/styles";

const dtBlue = "#0c043d";
const dtRed = "##960909";

export default createMuiTheme({
  palette: {
    common: {
      blue: `${dtBlue}`,
      red: `${dtRed}`,
    },
    primary: {
      main: `${dtBlue}`,
    },
    secondary: {
      main: `${dtRed}`,
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
