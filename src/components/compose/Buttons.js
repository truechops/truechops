import { makeStyles, useTheme } from "@material-ui/core/styles";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import Box from "@material-ui/core/Box";
import { Hidden } from "@material-ui/core";
import useButtonsHook from "./buttons/buttons-hook";
import InstrumentHelpPopover from "./popovers/InstrumentHelpPopover";
import { scoreActions, getSelectedNote, modifyNote } from "../../store/score";
import { connect, useDispatch, useSelector } from "react-redux";
import Button from "../ui/Button";
import { useState, useCallback } from "react";
import TupletPickerPopover from "./popovers/TupletPickerPopover";
import { Select, FormHelperText, FormControl } from "@material-ui/core";
import MutateButtons from './buttons/mutate/MutateButtons';

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

const ComposeButton = (props) => (
  <Button
    variant="outlined"
    className={props.className}
    selected={props.selected}
    onClick={props.onClick}
  >
    {props.text}
  </Button>
);

export function Buttons(props) {
  const { selectedTab, onTabSelected } = props;
  const classes = useTabStyles();
  const modifyNote = props.modifyNote;
  const isPlaying = props.isPlaying;
  const voices = props.voices;
  const dotSelected = props.dotSelected;
  const tupletSelected = props.tupletSelected;
  const repeat = props.repeat;
  const selectedNote = props.selectedNote;
  const dispatch = useDispatch();

  const tupletActualDuration = useSelector(
    (state) => state.score.present.tuplet.actual
  );
  const tupletNormalDuration = useSelector(
    (state) => state.score.present.tuplet.normal
  );

  const [tupletPickerAnchorEl, setTupletPickerAnchorEl] = useState();
  const tupletPickerOpen = Boolean(tupletPickerAnchorEl);

  function modifyNoteHandler(type, isRest) {
    modifyNote(voices, type, isRest);
  }

  const handleTupletPickerClick = () => {
    setTupletPickerAnchorEl(document.getElementById("compose-notes-tab-panel"));
  };

  const handleTupletPickerClose = () => {
    setTupletPickerAnchorEl(null);
  };

  const {
    measureButtons,
    ornamentButtons,
    voiceButtons,
    dotButton,
    noteButtonsRow1,
    noteButtonsRow2Mobile,
    noteButtonsRow2Desktop,
  } = useButtonsHook(
    modifyNoteHandler,
    isPlaying,
    dotSelected,
    tupletSelected,
    repeat,
    selectedNote
  );
  const ButtonsRow = useCallback(
    ({ children }) => {
      return <div className={classes.buttonsRow}>{children}</div>;
    },
    [classes.buttonsRow]
  );

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
        <Tab
          key={"compose-button-tabs-measure"}
          label="Measure"
          {...a11yProps(0)}
        />
        <Tab
          key={"compose-button-tabs-notes"}
          label="Notes"
          {...a11yProps(1)}
        />
        <Tab
          key={"compose-button-tabs-ornaments"}
          label="Ornaments"
          {...a11yProps(2)}
        />
        <Tab
          key={"compose-button-tabs-mods"}
          label="Mutate"
          {...a11yProps(3)}
        />
      </Tabs>
      <div id="composeButtonsTabPanel" style={{ margin: "auto" }}>
        <TabPanel value={selectedTab} index={0}>
          <ButtonsRow>{measureButtons}</ButtonsRow>
        </TabPanel>
        <TabPanel id="compose-notes-tab-panel" value={selectedTab} index={1}>
          <Hidden smUp>
            {voiceButtons.map((rowButtons, rowIndex) => {
              let content = [];
              if (rowIndex === 0) {
                content.push(<InstrumentHelpPopover />);
              }

              content.push(rowButtons);

              if (rowIndex === voiceButtons.length - 1) {
                content.push(dotButton);
                content.push(
                  <ComposeButton
                    text={`${tupletActualDuration}:${tupletNormalDuration}`}
                    onClick={handleTupletPickerClick}
                  />
                );
                content.push(
                  <ComposeButton
                    text={`${tupletActualDuration}:${tupletNormalDuration}`}
                    selected={tupletSelected}
                    onClick={() =>
                      dispatch(scoreActions.toggleTupletSelected())
                    }
                  />
                );
              }

              return (
                <ButtonsRow key={Math.random().toString()}>
                  {content}
                </ButtonsRow>
              );
            })}
          </Hidden>
          <Hidden xsDown>
            <ButtonsRow>
              <InstrumentHelpPopover />
              {voiceButtons.flat()}
              {dotButton}
              <ComposeButton
                text={`${tupletActualDuration}:${tupletNormalDuration}`}
                onClick={handleTupletPickerClick}
              />
              <ComposeButton
                text={`${tupletActualDuration}:${tupletNormalDuration}`}
                selected={tupletSelected}
                onClick={() => dispatch(scoreActions.toggleTupletSelected())}
              />
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
          <TupletPickerPopover
            tupletPickerOpen={tupletPickerOpen}
            tupletPickerAnchorEl={tupletPickerAnchorEl}
            handleTupletPickerClose={handleTupletPickerClose}
          />
        </TabPanel>
        <TabPanel value={selectedTab} index={2}>
          <ButtonsRow>{ornamentButtons}</ButtonsRow>
        </TabPanel>
        <TabPanel style={{margin: 'auto'}} value={selectedTab} index={3}>
          <MutateButtons />
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
    tupletSelected: state.score.present.tuplet.selected,
    selectedNote: getSelectedNote(state.score.present),
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    modifyNote: (voices, type, isRest) => {
      console.log("modifyNote dispatthToProps: " + type);
      const scoreRootElement = document.getElementById("score-root");

      dispatch(
        modifyNote(
          { voices, type, isRest },
          {
            top: scoreRootElement.scrollTop,
            left: scoreRootElement.scrollLeft,
          }
        )
      );
    },
  };
};

const ConnectedButtons = connect(mapStateToProps, mapDispatchToProps)(Buttons);

export default ConnectedButtons;
