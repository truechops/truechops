//import { makeStyles } from "@material-ui/styles";

import { useContext, useEffect, useRef } from "react";
import { ActionCreators } from "redux-undo";
import IconButton from "@material-ui/core/IconButton";
import { update as updateToneJs, setSamplers } from "../../lib/tone";
import { useTheme } from "@material-ui/core/styles";
import ToneContext from "../../store/tone-context";
import { connect, useDispatch } from "react-redux";
import { getToneJs } from "../../store/score";

import _ from "lodash";

import {
  FaTools,
  FaUndo,
  FaRedo,
  FaPlay,
  FaStop,
  FaSave,
  FaLink,
} from "react-icons/fa";
import { scoreActions } from "../../store/score";

export function TopToolbar(props) {
  const { setSampler, tenorsSampler } = useContext(ToneContext);
  const theme = useTheme();
  const dispatch = useDispatch();
  const isPlaying = props.isPlaying;
  const toneJs = props.toneJs;
  const repeat = props.repeat;
  const startStop = props.startStop;
  const prevRepeatRef = useRef();

  //Set the tonejs samplers, which come from ToneContext
  useEffect(() => {
    setSamplers(setSampler, tenorsSampler);
  }, [setSampler, tenorsSampler]);

  useEffect(() => {
    let doUpdateToneJs = false;

    //Initial load, update tone js.
    if(!prevRepeatRef.current) {
      doUpdateToneJs = true;
    }
    else if (!_.isEqual(repeat, prevRepeatRef.current)) {
      //If repeat information changed, only change tone js if switching from repeat to not-repeat or vice-versa.
      if ("start" in repeat && "end" in repeat) {
        if (repeat.start >= 0 && repeat.end >= 0) {
          doUpdateToneJs = true;
        }
      } else if ("start" in prevRepeatRef.current && "end" in prevRepeatRef.current) {
          doUpdateToneJs = true;
      }
    } else {
      doUpdateToneJs = true;
    }

    if(doUpdateToneJs) {
      updateToneJs(toneJs, repeat, startStop);
    }

    prevRepeatRef.current = repeat;
  }, [toneJs, repeat, startStop]);

  const iconSize = theme.buttons.topToolbar.iconSize;
  return (
    <>
      <div style={{ width: "auto", margin: "auto" }}>
        <IconButton
          color="inherit"
          aria-label="undo"
          onClick={() => dispatch(ActionCreators.undo())}
        >
          <FaUndo size={iconSize} />
        </IconButton>
        <IconButton
          color="inherit"
          aria-label="redo"
          onClick={() => dispatch(ActionCreators.redo())}
        >
          <FaRedo size={iconSize} />
        </IconButton>
        <IconButton
          color="inherit"
          aria-label="open drawer"
          onClick={() => alert("tools!")}
        >
          <FaTools />
        </IconButton>
        <IconButton color="inherit" aria-label="play" onClick={startStop}>
          {!isPlaying ? <FaPlay size={iconSize} /> : <FaStop size={iconSize} />}
        </IconButton>
        <IconButton
          color="inherit"
          aria-label="save"
          onClick={() => alert("save!")}
        >
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
  };
};

const ConnectedTopToolbar = connect(
  mapStateToProps,
  mapDispatchToProps
)(TopToolbar);

export default ConnectedTopToolbar;
