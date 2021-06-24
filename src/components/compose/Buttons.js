import { makeStyles, useTheme } from "@material-ui/core/styles";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";
import { Hidden } from "@material-ui/core";
import useButtonsHook from "./hooks/buttons-hook";
import InstrumentHelpPopover from "./InstrumentHelpPopover";
import { scoreActions } from "../../store/score";
import { useDispatch } from "react-redux";
import EighthNoteIcon from "../../../icons/notes/eighth.svg";
import SvgIcon from "@material-ui/core/SvgIcon";

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  const theme = useTheme();

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box p={theme.compose.buttons.container.padding}>
          <Typography>{children}</Typography>
        </Box>
      )}
    </div>
  );
}

const useTabStyles = makeStyles((theme) => ({
  tabs: {
    justifyContent: "center",
  },
  scroller: {
    flexGrow: "0",
  },
  buttonsRow: {
    marginBottom: theme.compose.buttons.row.marginBottom,
    display: "flex",
    justifyContent: "center",
  },
}));

function a11yProps(index) {
  return {
    id: `simple-tab-${index}`,
    "aria-controls": `simple-tabpanel-${index}`,
  };
}

export default function Buttons(props) {
  const { selectedTab, onTabSelected } = props;
  const classes = useTabStyles();
  const dispatch = useDispatch();
  const { modifyNote } = scoreActions;

  function modifyNoteHandler(value, isRest) {
    dispatch(
      modifyNote({value, isRest})
    );
  }

  const {
    measureButtons,
    ornamentButtons,
    instrumentsRow1,
    instrumentsRow2,
    noteButtonsRow1,
    noteButtonsRow2Mobile,
    noteButtonsRow2Desktop,
    tupletButtons,
  } = useButtonsHook(modifyNoteHandler);

  const ButtonsRow = ({ children }) => {
    return <div className={classes.buttonsRow}>{children}</div>;
  };

  return (
    <>
      <Tabs
        value={selectedTab}
        onChange={onTabSelected}
        aria-label="simple tabs example"
        classes={{ root: classes.tabs, scroller: classes.scroller }}
        variant={"scrollable"}
        scrollButtons={"auto"}
      >
        <Tab key={Math.random().toString()} label="Measure" {...a11yProps(0)} />
        <Tab key={Math.random().toString()} label="Notes" {...a11yProps(1)} />
        <Tab
          key={Math.random().toString()}
          label="Ornaments"
          {...a11yProps(2)}
        />
        <Tab key={Math.random().toString()} label="Mods" {...a11yProps(3)} />
      </Tabs>
      <div id="composeButtonsTabPanel" style={{ margin: "auto" }}>
        <TabPanel value={selectedTab} index={0}>
          <ButtonsRow>{measureButtons}</ButtonsRow>
        </TabPanel>
        <TabPanel value={selectedTab} index={1}>
          <Hidden smUp>
            <ButtonsRow>
              <InstrumentHelpPopover />
              {instrumentsRow1}
            </ButtonsRow>
            <ButtonsRow>
              {instrumentsRow2}
              {tupletButtons}
            </ButtonsRow>
          </Hidden>
          <Hidden xsDown>
            <ButtonsRow>
              <InstrumentHelpPopover />
              {instrumentsRow1}
              {instrumentsRow2}
              {tupletButtons}
            </ButtonsRow>
          </Hidden>
          <Hidden smUp>
            <ButtonsRow>{noteButtonsRow1}</ButtonsRow>
            <ButtonsRow>{noteButtonsRow2Mobile}</ButtonsRow>
          </Hidden>
          <Hidden xsDown>
            <ButtonsRow>
              {noteButtonsRow1}
              {noteButtonsRow2Desktop}
            </ButtonsRow>
          </Hidden>
        </TabPanel>
        <TabPanel value={selectedTab} index={2}>
          <ButtonsRow>{ornamentButtons}</ButtonsRow>
        </TabPanel>
        <TabPanel value={selectedTab} index={3}>
          Mods
        </TabPanel>
      </div>
    </>
  );
}
