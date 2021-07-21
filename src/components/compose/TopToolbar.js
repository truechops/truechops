import { useContext, useEffect, useRef, useState } from "react";
import { ActionCreators } from "redux-undo";
import IconButton from "@material-ui/core/IconButton";
import { update as updateToneJs, setSamplers } from "../../lib/tone";
import { useTheme } from "@material-ui/core/styles";
import ToneContext from "../../store/tone-context";
import { connect, useSelector } from "react-redux";
import { getToneJs, scoreActions } from "../../store/score";
import Dialog from "../ui/Dialog";
import TextField from "@material-ui/core/TextField";

import { copyToClipboard } from '../../helpers/browser';

import _ from "lodash";

import { FaUndo, FaRedo, FaPlay, FaStop, FaSave, FaLink } from "react-icons/fa";
import { FiCopy } from 'react-icons/fi';
import { GiMetronome } from "react-icons/gi";
import useRhythmMutations from "../../graphql/rhythm/useRhythmMutations";
import useLinkMutations from "../../graphql/link/useLinkMutations";
import MetronomeIcon from "../../../icons/metronome.svg";
import MetronomePopover from "./popovers/MetronomePopover";
import SvgButton from "../ui/SvgButton";

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
  const { addLink: addLinkMutation } = useLinkMutations();

  const currentUser = useSelector((state) => state.realm.currentUser);
  const [mustBeLoggedInModalOpen, setMustBeLoggedInModalOpen] = useState(false);
  const [saveRhythmModalOpen, setSaveRhythmModalOpen] = useState(false);
  const [addLinkModalOpen, setAddLinkModalOpen] = useState(false);
  const [rhythmToSaveName, setRhythmToSaveName] = useState("");
  const rhythmToSaveEmpty = rhythmToSaveName.length === 0;
  const [rhythmLink, setRhythmLink] = useState('');

  const [metronomeAnchorEl, setMetronomeAnchorEl] = useState(null);

  function rhythmLinkDialogContents(link) {
    return <>
      {rhythmLink}
      <IconButton
          style={{marginLeft: 8}}
          color="inherit"
          aria-label="copy-to-clipboard"
          onClick={() => copyToClipboard(link)}
        >
          <FiCopy size={iconSize} />
        </IconButton>
    </>
  }

  const handleMetronomePopoverOpen = (event) => {
    setMetronomeAnchorEl(event.currentTarget);
  };

  const handleMetronomePopoverClose = () => {
    setMetronomeAnchorEl(null);
  };

  function addRhythm() {
    addRhythmMutation(rhythmToSaveName, "saved");
    setSaveRhythmModalOpen(false);
    setRhythmToSaveName("");
  }

  async function addLink() {
    const { _id } = await addRhythmMutation(rhythmToSaveName, "link");

    //What if this fails?
    const { _id: linkId } = await addLinkMutation("rhythm", _id);

    setAddLinkModalOpen(false);
    setRhythmToSaveName("");
    setRhythmLink(`https://truechops.com/r/${linkId}`);
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

  function onSave() {
    if (!currentUser) {
      setMustBeLoggedInModalOpen(true);
    } else {
      setSaveRhythmModalOpen(true);
    }
  }

  function onAddLink() {
    setAddLinkModalOpen(true);
  }

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
    </form>
  );
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

      <Dialog
        onOk={setMustBeLoggedInModalOpen.bind(null, false)}
        message="Log in to save your rhythm!"
        isOpen={mustBeLoggedInModalOpen}
      />

      <Dialog
        onOk={() => setRhythmLink('')}
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
