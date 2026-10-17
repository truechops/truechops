import { useContext, useEffect, useRef, useState } from "react";
import { ActionCreators } from "redux-undo";
import IconButton from "@mui/material/IconButton";
import { update as updateToneJs, setSamplers } from "../../lib/tone";
import { useTheme, makeStyles } from "@mui/styles";
import ToneContext from "../../store/tone-context";
import { connect, useSelector, useDispatch } from "react-redux";
import { getToneJs, scoreActions } from "../../store/score";
import Dialog from "../ui/Dialog";
import TextField from "@mui/material/TextField";
import ReactGA from "react-ga";

import { copyToClipboard } from "../../helpers/browser";

import _ from "lodash";
import { score } from '../../consts/score';

import { FiCopy, FiSearch, FiRotateCcw, FiRotateCw, FiHelpCircle, FiPlay, FiSquare, FiPlus, FiLink, FiSave } from "react-icons/fi";
import { useRouter } from "next/router";
import { openNotationSearch } from "../../services/notation-search";
import { GiMetronome } from "react-icons/gi";
import RhythmDialog from "../social/RhythmDialog";
import Link from "next/link";
import useLinkMutations from "../../graphql/link/useLinkMutations";
import MetronomePopover from "./popovers/MetronomePopover";
import HelpPopover from "./popovers/InstrumentHelpPopover";
import addComposeEventListeners from "./event-listeners";
import styles from "./score-workspace.module.css";
import {
  FormControlLabel,
  Switch,
} from "@mui/material";
import Drawer from "@mui/material/Drawer";
import dynamic from "next/dynamic";

const DynamicComposeSidebar = dynamic(() => import("./Sidebar"));

export function TopToolbar(props) {
  const router = useRouter(), [searchError, setSearchError] = useState("");
  const {
    setSampler,
    snareSampler,
    tenorsSampler,
    bassSampler,
    cymbalsSampler,
  } = useContext(ToneContext);
  const theme = useTheme();
  const iconSize = theme.buttons.topToolbar.iconSize;
  const isPlaying = props.isPlaying;
  const toneJs = props.toneJs;
  const repeat = props.repeat;
  const startStop = props.startStop;
  const tempo = useSelector((state) => state.score.present.tempo);
  const [helpAnchorEl, setHelpAnchorEl] = useState(null);
  const prevRepeatRef = useRef();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const { getRhythmLink } = useLinkMutations();

  const dispatch = useDispatch();

  const currentUser = useSelector((state) => state.realm.currentUser);
  const scoreData = useSelector((state) => state.score.present);

  const [logInToSaveRhythmModalOpen, setLogInToSaveRhythmModalOpen] =
    useState(false);
  const [logInToAddLinkModalOpen, setLogInToAddLinkModalOpen] = useState(false);
  const [saveRhythmModalOpen, setSaveRhythmModalOpen] = useState(false);
  const [addLinkModalOpen, setAddLinkModalOpen] = useState(false);
  const [rhythmToSaveName, setRhythmToSaveName] = useState("");
  const rhythmToSaveEmpty = rhythmToSaveName.length === 0;
  const [rhythmLink, setRhythmLink] = useState("");

  const [metronomeAnchorEl, setMetronomeAnchorEl] = useState(null);
  const [errorAddingLink, setErrorAddingLink] = useState(false);

  const numParts = useSelector(state => Object.keys(state.score.present.score.parts)
                              .filter(part => state.score.present.score.parts[part] != null).length);

  score.modalShown =
    addLinkModalOpen || saveRhythmModalOpen || 
    logInToSaveRhythmModalOpen || logInToAddLinkModalOpen;

  const [saveMutations, setSaveMutations] = useState(false);

  const useStyles = makeStyles((theme) => ({
    appBar: {
      transition: theme.transitions.create(["margin", "width"], {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
      }),
    },
    drawerHeader: {
      display: "flex",
      alignItems: "center",
      padding: theme.spacing(0, 1),
      height: theme.mixins.toolbar.minHeight,
    },
    sidebar: {
      ...theme.sidebar,
    },
    pages: {
      display: "flex",
      justifyContent: "center",
    },
  }));

  const classes = useStyles();

  useEffect(() => addComposeEventListeners(dispatch), [dispatch]);

  function rhythmLinkDialogContents(link) {
    return (
      <>
        <span id="rhythmLink">{rhythmLink}</span>
        <IconButton
          style={{ marginLeft: 8 }}
          color="inherit"
          aria-label="copy-to-clipboard"
          onClick={() => copyToClipboard(link)}
        >
          <FiCopy size={iconSize} />
        </IconButton>
      </>
    );
  }

  const handleMetronomePopoverOpen = (event) => {
    setMetronomeAnchorEl(event.currentTarget);
  };

  const handleMetronomePopoverClose = () => {
    setMetronomeAnchorEl(null);
  };

  function onSave() {
    if (!currentUser) {
      setLogInToSaveRhythmModalOpen(true);
    } else {
      setSaveRhythmModalOpen(true);
    }
  }

  //Show the add link modal if the user is logged in. Else, prompt them to log in via modal.
  function onAddLink() {
    if (!currentUser) {
      setLogInToAddLinkModalOpen(true);
    } else {
      setAddLinkModalOpen(true);
    }
  }

  async function addLink() {
    const link = await getRhythmLink(rhythmToSaveName, numParts === 1 ? saveMutations : false);
    console.log('link added: ' + link)
    if (!link) {
      setErrorAddingLink(true);
      ReactGA.event({
        category: "exception",
        action: "generate rhythm link",
      });
    } else {
      setRhythmLink(`https://truechops.com/r/${link}`);
    }

    setAddLinkModalOpen(false);
    setRhythmToSaveName("");
  }

  //Key listeners: space = start/stop

  //Set the tonejs samplers, which come from ToneContext
  useEffect(() => {
    setSamplers(
      setSampler,
      snareSampler,
      tenorsSampler,
      bassSampler,
      cymbalsSampler
    );
  }, [setSampler, snareSampler, tenorsSampler, bassSampler, cymbalsSampler]);

  useEffect(() => {
    let doUpdateToneJs = false;

    //Initial load, update tone js.
    if (!prevRepeatRef.current) {
      doUpdateToneJs = true;
    } else if (!_.isEqual(repeat, prevRepeatRef.current)) {
      //If repeat information changed, only change tone js if switching from repeat to not-repeat or vice-versa.
      if ("start" in repeat && "end" in repeat) {
        if (repeat.start >= 0 && repeat.end >= 0) {
          doUpdateToneJs = true;
        }
      } else if (
        "start" in prevRepeatRef.current &&
        "end" in prevRepeatRef.current
      ) {
        doUpdateToneJs = true;
      }
    } else {
      doUpdateToneJs = true;
    }

    if (doUpdateToneJs) {
      updateToneJs(toneJs, repeat, startStop);
    }

    prevRepeatRef.current = repeat;
  }, [toneJs, repeat, startStop]);

  const rhythmNameTextField = (
    <form>
      <TextField
        id="rhythm-name"
        label="rhythm name"
        style={{ margin: 8 }}
        fullWidth
        margin="normal"
        onChange={(e) => setRhythmToSaveName(e.target.value)}
        value={rhythmToSaveName}
      />
      {numParts === 1 && 
      <FormControlLabel
        labelPlacement="start"
        style={{marginLeft: 8}}
        control={
          <Switch
            checked={saveMutations}
            onChange={(event) => setSaveMutations(event.target.checked)}
            name="saveMutations"
          />
        }
        label="Save Mutations?"
      />}
    </form>
  );

  const errorDialogs = [
    {
      onOk: () => setLogInToSaveRhythmModalOpen(false),
      message: "Log in to save your rhythm!",
      isOpen: logInToSaveRhythmModalOpen,
    },
    {
      onOk: () => setLogInToAddLinkModalOpen(false),
      message: "Log in to add a link!",
      isOpen: logInToAddLinkModalOpen,
    },
    {
      onOk: () => setErrorAddingLink(false),
      message: "Unable to generate link. Please try again later.",
      isOpen: errorAddingLink,
    },
  ].map((props) => (
    <Dialog
      key={Math.random().toString()}
      onOk={props.onOk}
      message={props.message}
      isOpen={props.isOpen}
    />
  ));

  return (
    <>
      <div className={styles.actions}>
        <button type="button" className={`${styles.action} ${styles.iconAction}`} aria-label="undo" title="Undo (Ctrl+Z)" onClick={props.undo}><FiRotateCcw aria-hidden="true" /></button>
        <button type="button" className={`${styles.action} ${styles.iconAction}`} aria-label="redo" title="Redo (Ctrl+Y)" onClick={props.redo}><FiRotateCw aria-hidden="true" /></button>
        <button type="button" className={`${styles.action} ${styles.iconAction}`} aria-label="Help and shortcuts" title="Help and shortcuts" aria-haspopup="dialog" onClick={(event) => setHelpAnchorEl(event.currentTarget)}><FiHelpCircle aria-hidden="true" /></button>
        <span className={styles.actionDivider} />
        <button type="button" className={styles.action} aria-label={`Tempo ${tempo} BPM`} aria-haspopup="dialog" onClick={handleMetronomePopoverOpen}><GiMetronome aria-hidden="true" />{tempo} BPM</button>
        <button type="button" className={`${styles.action} ${styles.play}`} onClick={startStop}>{!isPlaying ? <FiPlay aria-hidden="true" /> : <FiSquare aria-hidden="true" />}{!isPlaying ? "Play" : "Stop"}</button>
        <button type="button" className={styles.action} aria-label="Parts" title="Parts" onClick={() => setSheetOpen(true)}><FiPlus aria-hidden="true" /><span className={styles.actionLabel}>Parts</span></button>
        <button type="button" className={styles.action} aria-label="Find rhythms matching this score" title="Find rhythms matching this score" onClick={async () => { try { await openNotationSearch(router, scoreData.score, scoreData.name || "Your score"); } catch { setSearchError("Couldn't open notation search. Please try again."); } }}><FiSearch aria-hidden="true" /><span className={styles.actionLabel}>Find</span></button>
        <button type="button" className={styles.action} aria-label="Share" title="Share a link" onClick={onAddLink}><FiLink aria-hidden="true" /><span className={styles.actionLabel}>Share</span></button>
        <button type="button" className={styles.action} aria-label="save" title="Save" onClick={onSave}><FiSave aria-hidden="true" /><span className={styles.actionLabel}>Save</span></button>
      </div>
      {saveRhythmModalOpen && <RhythmDialog
        composition={{ ...scoreData, mutations: numParts === 1 ? scoreData.mutations : [] }}
        onClose={() => setSaveRhythmModalOpen(false)}
        onSaved={() => { setSaveRhythmModalOpen(false); setSavedNotice(true); }}
      />}
      {searchError && <p role="alert" className={styles.status}>{searchError}</p>}
      {savedNotice && <p role="status" className={styles.status}>Saved to your profile. <Link href="/profile">View your rhythms</Link> <button onClick={() => setSavedNotice(false)} aria-label="Dismiss saved message">Dismiss</button></p>}
      <HelpPopover anchorEl={helpAnchorEl} onClose={() => setHelpAnchorEl(null)} />

      <Dialog
        isOpen={addLinkModalOpen}
        message={rhythmNameTextField}
        onOk={addLink}
        onCancel={() => setAddLinkModalOpen(false)}
        okDisabled={rhythmToSaveEmpty}
      />

      {errorDialogs}

      <Dialog
        onOk={() => setRhythmLink("")}
        message={rhythmLinkDialogContents(rhythmLink)}
        isOpen={rhythmLink.length > 0}
      />

      {metronomeAnchorEl && <MetronomePopover
        anchorEl={metronomeAnchorEl}
        handlePopoverClose={handleMetronomePopoverClose}
      />}
      <Drawer
            anchor="right"
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
             className={classes.sidebar}
             classes={{ paper: classes.sidebar }}
          >
            <DynamicComposeSidebar />
          </Drawer>
    </>
  );
}

const mapStateToProps = (state) => {
  return {
    isPlaying: state.score.present.isPlaying,
    repeat: state.score.present.repeat,
    toneJs: getToneJs(state.score.present),
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    startStop: () => dispatch(scoreActions.startStop()),
    undo: () => dispatch(ActionCreators.undo()),
    redo: () => dispatch(ActionCreators.redo()),
  };
};

const ConnectedTopToolbar = connect(
  mapStateToProps,
  mapDispatchToProps
)(TopToolbar);

export default ConnectedTopToolbar;
