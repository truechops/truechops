import { Switch, makeStyles } from "@material-ui/core";
import { useState } from "react";

import React from "react";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import ListItemText from "@material-ui/core/ListItemText";
import ListSubheader from "@material-ui/core/ListSubheader";
import { getScoreInstruments, scoreActions } from '../../store/score';
import { useSelector, useDispatch } from 'react-redux';

const useStyles = makeStyles((theme) => ({
    root: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: theme.palette.background.paper,
      textAlign: 'center'
    },
    subheader: {
        fontSize: 20
    }
  }));

export default function Sidebar() {
    const classes = useStyles();
  const currentInstruments = useSelector(state => getScoreInstruments(state.score.present));
  console.log('current instruments: ' + currentInstruments);
  const dispatch = useDispatch();

  const instrumentConfig = [{
      label: 'Drumset',
      checked: currentInstruments.includes('drumset'),
      onChange: () => dispatch(scoreActions.togglePartEnabled('drumset'))
  },
  {
    label: 'Tenors',
    checked: currentInstruments.includes('tenors'),
    onChange: () => dispatch(scoreActions.togglePartEnabled('tenors'))
}]

const listItems = instrumentConfig.map(config => <><ListItem>
    <ListItemText id={`switch-list-label-${config.label}`} primary={config.label} />
    <ListItemSecondaryAction>
      <Switch
        edge="end"
        onChange={config.onChange}
        checked={config.checked}
        inputProps={{ "aria-labelledby": `switch-list-label-${config.label}` }}
      />
    </ListItemSecondaryAction>
  </ListItem></>)

  return (
    <List
      subheader={<ListSubheader classes={{root: classes.subheader}}>Parts</ListSubheader>}
      className={classes.root}
    >
      {listItems}
    </List>
  );
}
