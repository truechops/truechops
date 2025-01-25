import React from 'react';
import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import { makeStyles } from '@material-ui/core/styles';
// import any other MUI components you want to style the dialog (Button, etc.)

import Legend from '../../../data/byos/alphabet/legend'; // your Legend component

const useStyles = makeStyles((theme) => ({
  dialogContent: {
    paddingTop: theme.spacing(1),    // or '8px'
    paddingBottom: theme.spacing(2), // or '16px'
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
