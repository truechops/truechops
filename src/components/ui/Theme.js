import { createTheme } from "@mui/material/styles";

const primary = "#1c0000";
const secondary = "#960909";
const spacing = 8;

export default createTheme({
  spacing,
  palette: {
    primary: {
      main: `${primary}`,
    },
    secondary: {
      main: `${secondary}`,
    },
    text: { secondary: "ffffff" },
    action: {
      disabled: "lightgray",
    },
  },
  mixins: {
    toolbar: {
      minHeight: 55,
    },
  },
  breakpoints:{
    values: {
      xs: 0,
      //'sm' has been changed from 600 to make buttons fit right
      sm: 750,
      md: 900,
      lg: 1200,
      xl: 1536,
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
  components: {
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 48,
        },
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          minHeight: 32,
        },
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          margin: "0 5px",
          minWidth: 34,
          borderRadius: "50rem",
          padding: "3px 11px",
          marginLeft: spacing,
        },
        outlined: {
          padding: "5x 11px",
        },
        label: {
          color: 'black'
        },
      }
    },
  },
  buttons: {
    topToolbar: {
      iconSize: 20,
    },
  },
  sidebar: {
    width: 256,
  },
  spinner: {
    position: "fixed",
    top: "25%",
    left: "50%",
    marginLeft: -20
  },
  compose: {
    sidebar: {
      icons: {
        size: 18,
      },
    },
  },
});
