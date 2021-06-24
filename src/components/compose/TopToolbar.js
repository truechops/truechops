//import { makeStyles } from "@material-ui/styles";

import { useState, useContext, useEffect, useCallback } from "react";
import IconButton from "@material-ui/core/IconButton";
import {
  start as startToneJs,
  stop as stopToneJs,
  update as updateToneJs,
  setSamplers,
} from "../../lib/tone";
import { useTheme } from "@material-ui/core/styles";
import ToneContext from "../../store/tone-context";
import { useSelector, useDispatch } from "react-redux";

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

export default function TopToolbar() {
  const theme = useTheme();
  const toneJsData = useSelector((state) => state.score.toneJs);
  const { setSampler, tenorsSampler } = useContext(ToneContext);
  const isPlaying = useSelector((state) => state.score.isPlaying);
  const repeat = useSelector((state) => state.score.repeat);
  const dispatch = useDispatch();

  const startStop = useCallback(() => {
    if (!isPlaying) {
      startToneJs();
    } else {
      stopToneJs();
    }

    dispatch(scoreActions.toggleIsPlaying());
  }, [dispatch, isPlaying]);

  //Set the tonejs samplers, which come from ToneContext
  useEffect(() => {
    setSamplers(setSampler, tenorsSampler);
  }, [setSampler, tenorsSampler]);

  useEffect(() => {
    console.log("update tonejs");
    updateToneJs(toneJsData, repeat, startStop);
  }, [toneJsData, repeat, startStop]);

  const iconSize = theme.buttons.topToolbar.iconSize;
  return (
    <>
      <div style={{ width: "auto", margin: "auto" }}>
        <IconButton
          color="inherit"
          aria-label="undo"
          onClick={() => alert("undo!")}
        >
          <FaUndo size={iconSize} />
        </IconButton>
        <IconButton
          color="inherit"
          aria-label="redo"
          onClick={() => alert("redo!")}
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
