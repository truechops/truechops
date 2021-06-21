import { createMuiTheme } from "@material-ui/core/styles";

const primary = "#1c0000";
const secondary = "#960909";
const spacing = 8;

export default createMuiTheme({
  spacing,
  palette: {
    primary: {
      main: `${primary}`,
    },
    secondary: {
      main: `${secondary}`,
    },
  },
  mixins: {
    toolbar: {
      minHeight: 55,
    },
  },
  typography: {
    tab: {
      fontFamily: "Raleway",
      textTransform: "none",
      fontWeight: 700,
      fontSize: "1rem",
    },
  },
  overrides: {
    MuiTab: {
      root: {
        minHeight: 48,
      },
    },
    MuiChip: {
      root: {
        minHeight: 32,
      },
    },
  },
  compose: {
    topToolbar: {
      iconSize: 20
    },
    buttons: {
      row: {
        marginBottom: spacing,
      },
      container: {
        padding: 2, //Theme spacing multiplier. Right now used with <Box p={padding}></Box>
      },
      tooltip: {
        marginRight: 10,
      },
      note: {
        marginRight: "0 5px",
        minWidth: 34,
        borderRadius: "50rem",
        padding: "3px 11px",
        marginLeft: spacing
      },
      wholeNote: {
        bottom: 10,
        height: 13,
        width: 13
      },
      chip: {
        margin: "0 5px",
      },
    },
    wholeNote: {},
    score: {
      tabsHiddenTopPadding: spacing * 2,
    },
  },
});
