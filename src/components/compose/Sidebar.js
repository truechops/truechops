import { Switch, Button, Select } from "@mui/material";
import { makeStyles } from "@mui/styles";

import { useEffect, useState, useRef } from "react";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemSecondaryAction from "@mui/material/ListItemSecondaryAction";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import { scoreActions } from "../../store/score";
import { useSelector, useDispatch } from "react-redux";
import _ from "lodash";
import { FaTrash, FaPlus } from "react-icons/fa";
import { useTheme } from "@mui/styles";

import React from "react";
import Dialog from "../ui/Dialog";

const useStyles = makeStyles((theme) => ({
  root: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: theme.palette.background.paper,
    textAlign: "center",
  },
  trash: {
    marginRight: theme.spacing(1),
  },
  select: {
    textAlign: "left",
  },
  subheader: {
    fontSize: 20,
  },
}));

export default function Sidebar() {
  const classes = useStyles();
  const unusedInstrumentsRef = useRef();
  const [modalOpen, setModalOpen] = useState(false);
  const theme = useTheme();
  let partConfig = useSelector((state) => state.score.present.score.parts);
  partConfig = _.omitBy(partConfig, _.isNil);

  const unusedInstruments = useSelector((state) =>
    Object.keys(state.score.present.voices).filter(
      (voice) => !Object.keys(partConfig).includes(voice)
    )
  );

  const [instrumentToDelete, setInstrumentToDelete] = useState("");
  const [selectedInstrument, setSelectedInstrument] = useState("");

  function onChangeInstrument(event) {
    setSelectedInstrument(event.target.value);
  }

  function deletePart(instrument) {
    dispatch(scoreActions.deletePart(instrument));
    setModalOpen(false);
  }

  useEffect(() => {
    if (
      unusedInstruments.length > 0 &&
      (!unusedInstrumentsRef.current ||
        !_.isEqual(unusedInstrumentsRef.current, unusedInstruments))
    ) {
      setSelectedInstrument(unusedInstruments[0]);

      unusedInstrumentsRef.current = unusedInstruments;
    }
  }, [unusedInstruments]);

  const dispatch = useDispatch();
  var instrumentConfig = [];

  for (var part in partConfig) {
    const clonedPart = _.clone(part);
    instrumentConfig.push({
      label: part,
      checked: partConfig[clonedPart].enabled,
      onChange: () => dispatch(scoreActions.togglePartEnabled(clonedPart)),
      onDelete: () => {
        setInstrumentToDelete(clonedPart);
        setModalOpen(true);
      },
    });
  }

  const listItems = instrumentConfig.map((config) => (
    <>
      <ListItem>
        <ListItemText
          id={`switch-list-label-${config.label}`}
          primary={config.label}
        />
        <Button className={classes.trash} onClick={config.onDelete}>
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
    <>
      <List
        subheader={
          <ListSubheader classes={{ root: classes.subheader }}>
            Parts
          </ListSubheader>
        }
        className={classes.root}
      >
        {unusedInstruments.length > 0 && (
          <>
            <Select
              className={classes.select}
              value={selectedInstrument}
              native
              onChange={onChangeInstrument}
            >
              {unusedInstruments.map((instrument) => (
                <option key={Math.random().toString()} value={instrument}>
                  {instrument}
                </option>
              ))}
            </Select>
            <Button
              onClick={() => dispatch(scoreActions.addPart(selectedInstrument))}
            >
              <FaPlus />
            </Button>
          </>
        )}
        {listItems}
      </List>

      {_.size(partConfig) > 1 && (
        <Dialog
          onCancel={() => setModalOpen(false)}
          isOpen={modalOpen}
          setIsOpen={setModalOpen}
          message={`Are you sure you want to delete the '${instrumentToDelete}' part?`}
          onOk={deletePart.bind(null, instrumentToDelete)}
        />
      )}

      {_.size(partConfig) === 1 && (
        <Dialog
          isOpen={modalOpen}
          setIsOpen={setModalOpen}
          message="Add another part before deleting."
          onOk={setModalOpen.bind(null, false)}
        />
      )}
    </>
  );
}
