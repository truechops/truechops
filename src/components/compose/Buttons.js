import { makeStyles, useTheme } from "@material-ui/core/styles";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import Box from "@material-ui/core/Box";
import { Hidden } from "@material-ui/core";
import useButtonsHook from "./hooks/buttons-hook";
import InstrumentHelpPopover from "./InstrumentHelpPopover";
import { scoreActions, getSelectedNote } from "../../store/score";
import { connect } from "react-redux";

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
        <Box p={theme.compose.buttons.container.padding}>{children}</Box>
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

export function Buttons(props) {
  const { selectedTab, onTabSelected } = props;
  const classes = useTabStyles();
  const modifyNote = props.modifyNote;
  const isPlaying = props.isPlaying;
  const voices = props.voices;
  const dotSelected = props.dotSelected;
  const repeat = props.repeat;
  const selectedNote = props.selectedNote;

  function modifyNoteHandler(value, isRest) {
    modifyNote(voices, value, isRest);
  }

  const {
    measureButtons,
    ornamentButtons,
    voiceButtons,
    dotButton,
    noteButtonsRow1,
    noteButtonsRow2Mobile,
    noteButtonsRow2Desktop,
    tupletButtons,
  } = useButtonsHook(
    modifyNoteHandler,
    isPlaying,
    dotSelected,
    repeat,
    selectedNote
  );
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
            {voiceButtons.map((rowButtons, rowIndex) => {
              let content = [];
              if (rowIndex === 0) {
                console.log('rowIndex === 0');
                content.push(<InstrumentHelpPopover />);
              }

              content.push(rowButtons);

              if (rowIndex === voiceButtons.length - 1) {
                content.push(dotButton)
                content.push(tupletButtons);
                console.log('last row index');
              }

              return <ButtonsRow key={Math.random().toString()}>{content}</ButtonsRow>;
            })}
          </Hidden>
          <Hidden xsDown>
            <ButtonsRow>
              <InstrumentHelpPopover />
              {voiceButtons.flat()}
              {dotButton}
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

const mapStateToProps = (state) => {
  return {
    isPlaying: state.score.present.isPlaying,
    repeat: state.score.present.repeat,
    score: state.score.present.score,
    dotSelected: state.score.present.dotSelected,
    selectedNote: getSelectedNote(state.score.present),
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    modifyNote: (voices, value, isRest) =>
      dispatch(scoreActions.modifyNote({ voices, value, isRest })),
  };
};

const ConnectedButtons = connect(mapStateToProps, mapDispatchToProps)(Buttons);

export default ConnectedButtons;
