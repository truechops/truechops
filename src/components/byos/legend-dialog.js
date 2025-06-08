import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import { makeStyles } from '@mui/styles';
// import any other MUI components you want to style the dialog (Button, etc.)

import Legend from '../../../data/byos/alphabet/legend'; // your Legend component

const useStyles = makeStyles((theme) => ({
  dialogContent: {
    paddingTop: theme.spacing(1),    // or '8px'
    paddingBottom: theme.spacing(2), // or '16px'
    overflow: 'scroll'
  },
}));

export default function LegendDialog({ open, onClose }) {
  const classes = useStyles();
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Legend</DialogTitle>
      <DialogContent className={classes.dialogContent}>
        <Legend />
      </DialogContent>
    </Dialog>
  );
}
