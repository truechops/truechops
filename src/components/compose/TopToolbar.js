//import { makeStyles } from "@material-ui/styles";

import React from "react";
import IconButton from "@material-ui/core/IconButton";
import { play } from '../../lib/tone';
import { useTheme } from '@material-ui/core/styles'

import {
  FaTools,
  FaUndo,
  FaRedo,
  FaPlay,
  FaSave,
  FaLink,
} from "react-icons/fa";

export default function TopToolbar() {
    const theme = useTheme();
  const iconSize = theme.compose.topToolbar.iconSize;
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
        <IconButton
          color="inherit"
          aria-label="play"
          onClick={play}
        >
          <FaPlay size={iconSize} />
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
