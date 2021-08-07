import { useContext, useEffect, useRef, useState, useCallback } from "react";
import { ActionCreators } from "redux-undo";
import IconButton from "@material-ui/core/IconButton";
import { update as updateToneJs, setSamplers } from "../../lib/tone";
import { useTheme } from "@material-ui/core/styles";
import ToneContext from "../../store/tone-context";
import { connect, useSelector, useDispatch } from "react-redux";
import { getToneJs, scoreActions } from "../../store/score";
import Dialog from "../ui/Dialog";
import TextField from "@material-ui/core/TextField";
import { RHYTHM_TYPES } from "../../consts/db";
import ReactGA from "react-ga";

import { copyToClipboard } from "../../helpers/browser";

import _ from "lodash";
import { score } from '../../consts/score';

import { FaUndo, FaRedo, FaPlay, FaStop, FaSave, FaLink } from "react-icons/fa";
import { FiCopy } from "react-icons/fi";
import { GiMetronome } from "react-icons/gi";
import useRhythmMutations from "../../graphql/rhythm/useRhythmMutations";
import useLinkMutations from "../../graphql/link/useLinkMutations";
import MetronomePopover from "./popovers/MetronomePopover";
import addComposeEventListeners from "./event-listeners";
import {
  FormControlLabel,
  Switch,
} from "@material-ui/core";

export function TopToolbar(props) {
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
  const prevRepeatRef = useRef();
  const { addRhythm: addRhythmMutation } = useRhythmMutations();
  const { getRhythmLink } = useLinkMutations();

  const dispatch = useDispatch();

  const currentUser = useSelector((state) => state.realm.currentUser);
  const [logInToSaveRhythmModalOpen, setLogInToSaveRhythmModalOpen] =
    useState(false);
  const [logInToAddLinkModalOpen, setLogInToAddLinkModalOpen] = useState(false);
  const [saveRhythmModalOpen, setSaveRhythmModalOpen] = useState(false);
  const [addLinkModalOpen, setAddLinkModalOpen] = useState(false);
  const [rhythmToSaveName, setRhythmToSaveName] = useState("");
  const rhythmToSaveEmpty = rhythmToSaveName.length === 0;
  const [rhythmLink, setRhythmLink] = useState("");

  const [metronomeAnchorEl, setMetronomeAnchorEl] = useState(null);
  const [errorAddingRhythm, setErrorAddingRhythm] = useState(false);
  const [errorAddingLink, setErrorAddingLink] = useState(false);

  const numParts = useSelector(state => Object.keys(state.score.present.score.parts)
                              .filter(part => state.score.present.score.parts[part] != null).length);

  score.modalShown =
    addLinkModalOpen || saveRhythmModalOpen || 
    logInToSaveRhythmModalOpen || logInToAddLinkModalOpen;

  const [saveMutations, setSaveMutations] = useState(false);

  useEffect(() => {''
    if(!window.tcEventsAdded) {
      addComposeEventListeners(dispatch);
    }
    window.tcEventsAdded = true;
  }, [dispatch]);

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

  async function addRhythm() {
    const addedRhythm = await addRhythmMutation(
      rhythmToSaveName,
      RHYTHM_TYPES.saved,
      numParts === 1 ? saveMutations : false
    );
    if (!addedRhythm) {
      setErrorAddingRhythm(true);
      ReactGA.event({
        category: "exception",
        action: "save rhythm",
      });
    }

    setSaveRhythmModalOpen(false);
    setRhythmToSaveName("");
  }

  async function addLink() {
    const link = await getRhythmLink(rhythmToSaveName, numParts === 1 ? saveMutations : false);
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
    {
      onOk: () => setErrorAddingRhythm(false),
      message: "Unable to save rhythm. Please try again later.",
      isOpen: errorAddingRhythm,
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
      <div style={{ width: "auto", margin: "auto" }}>
        <IconButton color="inherit" aria-label="undo" onClick={props.undo}>
          <FaUndo size={iconSize} />
        </IconButton>
        <IconButton color="inherit" aria-label="redo" onClick={props.redo}>
          <FaRedo size={iconSize} />
        </IconButton>
        <IconButton
          color="inherit"
          aria-label="metronome"
          onClick={handleMetronomePopoverOpen}
        >
          <GiMetronome size={iconSize + 6} />
        </IconButton>
        <IconButton color="inherit" aria-label="play" onClick={startStop}>
          {!isPlaying ? <FaPlay size={iconSize} /> : <FaStop size={iconSize} />}
        </IconButton>
        <IconButton color="inherit" aria-label="save" onClick={onSave}>
          <FaSave size={iconSize} />
        </IconButton>
        <IconButton color="inherit" aria-label="link" onClick={onAddLink}>
          <FaLink size={iconSize} />
        </IconButton>
      </div>
      <Dialog
        isOpen={saveRhythmModalOpen}
        message={rhythmNameTextField}
        onOk={addRhythm}
        onCancel={() => setSaveRhythmModalOpen(false)}
        okDisabled={rhythmToSaveEmpty}
      />

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

      <MetronomePopover
        anchorEl={metronomeAnchorEl}
        handlePopoverClose={handleMetronomePopoverClose}
      />
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
