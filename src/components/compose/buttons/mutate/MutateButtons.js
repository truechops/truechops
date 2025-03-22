import { useState } from 'react';
import Button from "../../../ui/Button";
import { makeStyles } from "@mui/styles";
import contextHook from "./common/context-hook";
import repeatHook from "./common/repeat-hook";
import gridHook from "./common/grid-hook";
import typesHook from './common/types-hook';
import { scoreActions } from '../../../../store/score';
import { useDispatch, useSelector } from 'react-redux';
import { DEFAULT_MUTATION_NUM_REPEATS } from '../../../../consts/score';
import Dialog from '../../../ui/Dialog';

export default function MutateButtons() {
  const numParts = useSelector(state => Object.keys(state.score.present.score.parts)
                              .filter(part => state.score.present.score.parts[part] != null).length);
  const [onlyOnePartDialogOpen, setOnlyOnePartDialogOpen] = useState(false);
  const useStyles = makeStyles((theme) => ({
    root: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      margin: 'auto',
      padding: 0 
    },
    formControl: {
      marginRight: theme.spacing(2),
    },
  }));

  function mutateHandler() {
    if(numParts > 1) {
      setOnlyOnePartDialogOpen(true);
    } else {
      dispatch(scoreActions.mutateNotes(numRepeats))
    }
    
  }

  const dispatch = useDispatch();
  let mutationRepeats = DEFAULT_MUTATION_NUM_REPEATS;

  const classes = useStyles();

  const { formControl: contextFormControl} = contextHook();
  const { formControl: repeatFormControl, numRepeats} = repeatHook(mutationRepeats);
  const { formControl: gridFormControl} = gridHook();
  const { formControl: typesFormControl} = typesHook();

  const formControls = [typesFormControl, contextFormControl, gridFormControl, repeatFormControl]

  return (
    <div className={classes.root}>
      {formControls.map(formControl => 
          <div key={Math.random().toString()} className={classes.formControl}>{formControl}
          </div>
      )}
      <Button onClick={mutateHandler}>Go</Button>
      <Dialog
        onOk={() => setOnlyOnePartDialogOpen(false)}
        message={"Mutate can only be used with one part."}
        isOpen={onlyOnePartDialogOpen}
      />
    </div>
  );
}
