import { makeStyles } from "@material-ui/styles";

import { useContext, useEffect, useRef, useState } from "react";
import { ActionCreators } from "redux-undo";
import IconButton from "@material-ui/core/IconButton";
import { update as updateToneJs, setSamplers } from "../../lib/tone";
import { useTheme } from "@material-ui/core/styles";
import ToneContext from "../../store/tone-context";
import { connect, useSelector } from "react-redux";
import { getToneJs, scoreActions } from "../../store/score";
// import Dialog from "../ui/Dialog";
import TextField from "@material-ui/core/TextField";
import {
  DialogContent,
  DialogActions,
  Button,
  Dialog,
} from "@material-ui/core";

import _ from "lodash";

import { FaUndo, FaRedo, FaPlay, FaStop, FaSave, FaLink } from "react-icons/fa";
import useRhythmMutations from "../../graphql/useRhythmMutations";
import $ from "jquery";

export function TopToolbar(props) {
  const {
    setSampler,
    snareSampler,
    tenorsSampler,
    bassSampler,
    cymbalsSampler,
  } = useContext(ToneContext);
  const theme = useTheme();
  const isPlaying = props.isPlaying;
  const toneJs = props.toneJs;
  const repeat = props.repeat;
  const startStop = props.startStop;
  const prevRepeatRef = useRef();
  const { addRhythm } = useRhythmMutations();
  const currentUser = useSelector((state) => state.realm.currentUser);
  const [mustBeLoggedInModalOpen, setMustBeLoggedInModalOpen] = useState(false);
  const [saveRhythmModalOpen, setSaveRhythmModalOpen] = useState(false);
  const [rhythmToSaveName, setRhythmToSaveName] = useState("");
  const rhythmToSaveEmpty = rhythmToSaveName.length === 0;

  function onChangeRhythmName(event) {
    setRhythmToSaveName(event.target.value);
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

  const useStyles = makeStyles({
    button: {
      label: {
        color: "blue",
      },
      disabled: {
        color: "brown",
      },
    },
  });

  const classes = useStyles();

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

  const iconSize = theme.buttons.topToolbar.iconSize;

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
        <IconButton color="inherit" aria-label="play" onClick={startStop}>
          {!isPlaying ? <FaPlay size={iconSize} /> : <FaStop size={iconSize} />}
        </IconButton>
        <IconButton color="inherit" aria-label="save" onClick={onSave}>
          <FaSave size={iconSize} />
        </IconButton>
        <IconButton
          color="inherit"
          aria-label="link"
          onClick={() => alert("link!")}
        >
          <FaLink size={iconSize} />
        </IconButton>
      </div>
      <Dialog
        onOk={setMustBeLoggedInModalOpen.bind(null, false)}
        message="Log in to save your rhythm!"
        isOpen={mustBeLoggedInModalOpen}
        setIsOpen={setMustBeLoggedInModalOpen}
      />
      <Dialog
        maxWidth="xs"
        aria-labelledby="confirmation-dialog-title"
        open={saveRhythmModalOpen}
      >
        <DialogContent dividers>{rhythmNameTextField}</DialogContent>
        <DialogActions>
          <Button
            autoFocus
            onClick={setSaveRhythmModalOpen.bind(null, false)}
            color="primary"
          >
            Cancel
          </Button>
          <Button
            disabled={rhythmToSaveEmpty}
            onClick={() => {
              addRhythm(rhythmToSaveName);
              setSaveRhythmModalOpen(false);
            }}
            classes={{ label: classes.button.label }}
          >
            Ok
          </Button>
        </DialogActions>
      </Dialog>
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
