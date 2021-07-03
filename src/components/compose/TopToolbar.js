//import { makeStyles } from "@material-ui/styles";

import { useContext, useEffect, useRef } from "react";
import { ActionCreators } from "redux-undo";
import IconButton from "@material-ui/core/IconButton";
import { update as updateToneJs, setSamplers } from "../../lib/tone";
import { useTheme } from "@material-ui/core/styles";
import ToneContext from "../../store/tone-context";
import { connect } from "react-redux";
import { getToneJs, scoreActions } from "../../store/score";
import useInstruments from './hooks/instruments-hook';

import _ from "lodash";

import {
  FaUndo,
  FaRedo,
  FaPlay,
  FaStop,
  FaSave,
  FaLink,
} from "react-icons/fa";

export function TopToolbar(props) {
  const { setSampler, tenorsSampler, snareSampler } = useContext(ToneContext);
  const theme = useTheme();
  const isPlaying = props.isPlaying;
  const toneJs = props.toneJs;
  const repeat = props.repeat;
  const startStop = props.startStop;
  const prevRepeatRef = useRef();
  console.log('snareSampler: ' + snareSampler);

  //Key listeners: space = start/stop

  //Set the tonejs samplers, which come from ToneContext
  useEffect(() => {
    setSamplers(setSampler, tenorsSampler, snareSampler);
  }, [setSampler, tenorsSampler, snareSampler]);

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
          onClick={props.undo}
        >
          <FaUndo size={iconSize} />
        </IconButton>
        <IconButton
          color="inherit"
          aria-label="redo"
          onClick={props.redo}
        >
          <FaRedo size={iconSize} />
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
    undo: () => dispatch(ActionCreators.undo()),
    redo: () => dispatch(ActionCreators.redo())
  };
};

const ConnectedTopToolbar = connect(
  mapStateToProps,
  mapDispatchToProps
)(TopToolbar);

export default ConnectedTopToolbar;
