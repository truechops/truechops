import { useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";
import Chip from "@material-ui/core/Chip";
import { Button, ButtonGroup, Hidden, Icon } from "@material-ui/core";

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box p={2}>
          <Typography>{children}</Typography>
        </Box>
      )}
    </div>
  );
}

const useTabStyles = makeStyles((theme) => ({
  root: {
    justifyContent: "center",
  },
  chips: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  chip: {
    margin: "0 5px",
  },
  scroller: {
    flexGrow: "0",
  },
  imageIcon: {
    display: "flex",
    height: "inherit",
    width: "inherit",
  },
  wholeNoteImageIcon: {
    position: "relative",
    bottom: 10,
    height: 13,
    width: 13,
  },
  noteButton: {
    borderRadius: "5em",
    minWidth: 35,
    padding: "3px 11px",
    marginLeft: theme.spacing(1),
  },
}));

function a11yProps(index) {
  return {
    id: `simple-tab-${index}`,
    "aria-controls": `simple-tabpanel-${index}`,
  };
}

export default function SimpleTabs() {
  const [value, setValue] = useState(0);
  const classes = useTabStyles();

  const [kickSelected, setKickSelected] = useState(false);
  const [snareSelected, setSnareSelected] = useState(false);
  const [hatSelected, setHatSelected] = useState(false);
  const [tom1Selected, setTom1Selected] = useState(false);
  const [tom2Selected, setTom2Selected] = useState(false);
  const [tom3Selected, setTom3Selected] = useState(false);
  const [tom4Selected, setTom4Selected] = useState(false);
  const [rideSelected, setRideSelected] = useState(false);
  const [hatFootSelected, setHatFootSelected] = useState(false);
  const [dotSelected, setDotSelected] = useState(false);

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  const FlexCenterWrapper = ({ children }) => {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: "0.5rem",
        }}
      >
        {children}
      </div>
    );
  };

  const ComposeButton = (src, className) => (
    <Button variant="outlined" className={classes.noteButton}>
      <Icon>
        <img src={src} className={className} />
      </Icon>
    </Button>
  );

  const getInstrumentRow = (config) => (
    <Chip
      onClick={config.onClick}
      className={classes.chip}
      label={config.label}
      clickable
      variant={config.variant}
      color="primary"
    />
  );

  const noteButtonsRow1 = [
    "whole",
    "half",
    "quarter",
    "eighth",
    "sixteenth",
    "thirtysecond",
    "thirtysecondRest",
  ].map((noteFileName) => 
    ComposeButton(`/icons/notes/${noteFileName}.svg`, 
                  "whole" === noteFileName ? classes.wholeNoteImageIcon : classes.imageIcon))

  const noteButtonsRow2Mobile = [
    "wholeRest",
    "halfRest",
    "quarterRest",
    "eighthRest",
    "sixteenthRest"
  ].map(noteFileName => ComposeButton(`/icons/notes/${noteFileName}.svg`, 
                ["wholeRest", "halfRest"].includes(noteFileName) ? classes.wholeNoteImageIcon : classes.imageIcon))

    const tupletButtons = ["3:2","3:2"].map(tupletText => <Button variant="outlined" className={classes.noteButton}>
                                                        {tupletText}
                                                      </Button>)

const noteButtonsRow2Desktop = [
    "sixteenthRest",
    "eighthRest",
    "quarterRest",
    "halfRest",
    "wholeRest",
  ].map(noteFileName => ComposeButton(`/icons/notes/${noteFileName}.svg`, 
                ["wholeRest", "halfRest"].includes(noteFileName) ? classes.wholeNoteImageIcon : classes.imageIcon))

  const dotChip = (
    <Chip
      onClick={() => setDotSelected((selected) => !selected)}
      className={classes.chip}
      label="."
      clickable
      variant={dotSelected ? "default" : "outlined"}
      color="primary"
    />
  );

  const instrumentsRow1 = [
    {
      onClick: () => setKickSelected((selected) => !selected),
      label: "Kick",
      variant: kickSelected ? "default" : "outlined",
    },
    {
      onClick: () => setSnareSelected((selected) => !selected),
      label: "Snare",
      variant: snareSelected ? "default" : "outlined",
    },
    {
      onClick: () => setHatSelected((selected) => !selected),
      label: "HiHat",
      variant: hatSelected ? "default" : "outlined",
    },
    {
      onClick: () => setRideSelected((selected) => !selected),
      label: "Ride",
      variant: rideSelected ? "default" : "outlined",
    },
    {
      onClick: () => setHatFootSelected((selected) => !selected),
      label: "Hat Foot",
      variant: hatFootSelected ? "default" : "outlined",
    },
  ].map(getInstrumentRow);

  const instrumentsRow2 = [
    {
      onClick: () => setTom1Selected((selected) => !selected),
      label: "Tom1",
      variant: tom1Selected ? "default" : "outlined",
    },
    {
      onClick: () => setTom2Selected((selected) => !selected),
      label: "Tom2",
      variant: tom2Selected ? "default" : "outlined",
    },
    {
      onClick: () => setTom3Selected((selected) => !selected),
      label: "Tom3",
      variant: tom3Selected ? "default" : "outlined",
    },
    {
      onClick: () => setTom4Selected((selected) => !selected),
      label: "Tom4",
      variant: tom4Selected ? "default" : "outlined",
    },
  ]
    .map(getInstrumentRow)
    .concat(dotChip);

  const ornamentButtons = [
    "leftSticking",
    "rightSticking",
    "accent",
    "flam",
    "diddle",
    "cheese",
  ].map((ornament) => (
    ComposeButton(`/icons/ornaments/${ornament}.svg`, classes.imageIcon)
  ));

  const measureButtons = [
    "addMeasure",
    "deleteMeasure",
    "leftRepeat",
    "rightRepeat",
    "repeatMeasure"
  ].map((ornament) => (
    ComposeButton(`/icons/measure/${ornament}.svg`, classes.imageIcon)
  ));

  return (
    <main>
      <Tabs
        value={value}
        onChange={handleChange}
        aria-label="simple tabs example"
        classes={{ root: classes.root, scroller: classes.scroller }}
        variant={"scrollable"}
        scrollButtons={"auto"}
      >
        <Tab label="Measure" {...a11yProps(0)} />
        <Tab label="Notes" {...a11yProps(1)} />
        <Tab label="Ornaments" {...a11yProps(2)} />
        <Tab label="Mods" {...a11yProps(3)} />
      </Tabs>
      <div style={{ margin: "auto" }}>
        <TabPanel value={value} index={0}>
        <FlexCenterWrapper>{measureButtons}</FlexCenterWrapper>
        </TabPanel>
        <TabPanel value={value} index={1}>
          <Hidden smUp>
            <FlexCenterWrapper>{instrumentsRow1}</FlexCenterWrapper>
            <FlexCenterWrapper>{instrumentsRow2}</FlexCenterWrapper>
          </Hidden>
          <Hidden xsDown>
            <FlexCenterWrapper>
              {instrumentsRow1}
              {instrumentsRow2}
            </FlexCenterWrapper>
          </Hidden>
          <Hidden smUp>
            <FlexCenterWrapper>{noteButtonsRow1}</FlexCenterWrapper>
            <FlexCenterWrapper>{noteButtonsRow2Mobile}{tupletButtons}</FlexCenterWrapper>
          </Hidden>
          <Hidden xsDown>
            <FlexCenterWrapper>
              {noteButtonsRow1}
              {noteButtonsRow2Desktop}
              {tupletButtons}
            </FlexCenterWrapper>
          </Hidden>
        </TabPanel>
        <TabPanel value={value} index={2}>
          <FlexCenterWrapper>{ornamentButtons}</FlexCenterWrapper>
        </TabPanel>
        <TabPanel value={value} index={3}>
          Mods
        </TabPanel>
      </div>
    </main>
  );
}
