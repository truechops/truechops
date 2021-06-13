//import { makeStyles } from "@material-ui/styles";

import React from "react";
import IconButton from "@material-ui/core/IconButton";

import {
  FaTools,
  FaUndo,
  FaRedo,
  FaPlay,
  FaSave,
  FaLink,
} from "react-icons/fa";

export default function Top() {
    const topToolbarSize = 20;
  return (
    <>
      <div style={{ width: "auto", margin: "auto" }}>
        <IconButton
          color="inherit"
          aria-label="open drawer"
          onClick={() => alert("undo!")}
        >
          <FaUndo size={topToolbarSize} />
        </IconButton>
        <IconButton
          color="inherit"
          aria-label="open drawer"
          onClick={() => alert("redo!")}
        >
          <FaRedo size={topToolbarSize} />
        </IconButton>
        <IconButton
          color="inherit"
          aria-label="open drawer"
          onClick={() => alert("play!")}
        >
          <FaPlay size={topToolbarSize} />
        </IconButton>
        <IconButton
          color="inherit"
          aria-label="open drawer"
          onClick={() => alert("save!")}
        >
          <FaSave size={topToolbarSize} />
        </IconButton>
        <IconButton
          color="inherit"
          aria-label="open drawer"
          onClick={() => alert("link!")}
        >
          <FaLink size={topToolbarSize} />
        </IconButton>
      </div>
      <IconButton
        color="inherit"
        aria-label="open drawer"
        onClick={() => alert("tools!")}
      >
        <FaTools />
      </IconButton>
    </>
  );
}
