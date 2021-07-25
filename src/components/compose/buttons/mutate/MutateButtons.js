import Button from "../../../ui/Button";
import { makeStyles } from "@material-ui/core/styles";
import contextHook from "./common/context-hook";
import repeatHook from "./common/repeat-hook";
import gridHook from "./common/grid-hook";
import typesHook from './common/types-hook';
import { scoreActions } from '../../../../store/score';
import { useDispatch } from 'react-redux';

export default function MutateButtons() {
  const useStyles = makeStyles((theme) => ({
    root: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    },
    formControl: {
      marginRight: theme.spacing(2),
    },
  }));

  const dispatch = useDispatch();

  const classes = useStyles();

  const { formControl: voicesFormControl, context } = contextHook();
  const { formControl: repeatFormControl, numRepeats } = repeatHook();
  const { formControl: gridFormControl, grid } = gridHook();
  const { formControl: typesFormControl, type } = typesHook();

  const formControls = [typesFormControl, voicesFormControl, gridFormControl, repeatFormControl]

  return (
    <div className={classes.root}>
      {formControls.map(formControl => 
          <div key={Math.random().toString()} className={classes.formControl}>{formControl}
          </div>
      )}
      <Button onClick={() => dispatch(scoreActions.mutateNotes({type, grid, context, numRepeats}))}>Go</Button>
    </div>
  );
}
