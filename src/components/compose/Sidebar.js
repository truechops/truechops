import { Switch, makeStyles, Button, Select } from "@material-ui/core";

import { useState } from "react";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemSecondaryAction from "@material-ui/core/ListItemSecondaryAction";
import ListItemText from "@material-ui/core/ListItemText";
import ListSubheader from "@material-ui/core/ListSubheader";
import { scoreActions } from "../../store/score";
import { useSelector, useDispatch } from "react-redux";
import _ from "lodash";
import { FaTrash, FaPlus } from "react-icons/fa";
import { useTheme } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: theme.palette.background.paper,
    textAlign: "center",
  },
  select: {
    textAlign: 'left'
  },
  subheader: {
    fontSize: 20,
  },
}));

export default function Sidebar() {
  const classes = useStyles();
  const theme = useTheme();
  const partConfig = useSelector((state) => state.score.present.score.parts);
  const unusedInstruments = useSelector(state => Object.keys(state.score.present.voices)
                           .filter(voice => !Object.keys(partConfig).includes(voice)));

  const [selectedInstrument, setSelectedInstrument] = useState(unusedInstruments.length ? unusedInstruments[0] : '');

  function onChangeInstrument(event) {
      setSelectedInstrument(event.target.value);
  }

  const dispatch = useDispatch();
  var instrumentConfig = [];

  for (var part in partConfig) {
    const clonedPart = _.clone(part);
    instrumentConfig.push({
      label: part,
      checked: partConfig[clonedPart].enabled,
      onChange: () => dispatch(scoreActions.togglePartEnabled(clonedPart)),
      onDelete: () => dispatch(scoreActions.deletePart(clonedPart))
    });
  }

  const listItems = instrumentConfig.map((config) => (
    <>
      <ListItem>
        <ListItemText
          id={`switch-list-label-${config.label}`}
          primary={config.label}
        />
        <Button onClick={config.onDelete}>
          <FaTrash size={theme.compose.sidebar.icons.size} />
        </Button>
        <ListItemSecondaryAction>
          <Switch
            edge="end"
            onChange={config.onChange}
            checked={config.checked}
            inputProps={{
              "aria-labelledby": `switch-list-label-${config.label}`,
            }}
          />
        </ListItemSecondaryAction>
      </ListItem>
    </>
  ));

  return (
    <List
      subheader={
        <ListSubheader classes={{ root: classes.subheader }}>
          Parts
        </ListSubheader>
      }
      className={classes.root}
    >
        {unusedInstruments.length && <><Select
        className={classes.select}
          value={selectedInstrument}
          onChange={onChangeInstrument}
        //   inputProps={{
        //     name: 'age',
        //     id: 'age-native-simple',
        //   }}
        >
            {unusedInstruments.map(instrument => <option key={Math.random().toString()} value={instrument}>{instrument}</option>)}
        </Select>
        <Button onClick={() => dispatch(scoreActions.addPart(selectedInstrument))}><FaPlus /></Button></>}
      {listItems}
    </List>
  );
        }
