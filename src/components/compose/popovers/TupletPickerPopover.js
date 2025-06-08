import { Select} from "@mui/material";
import Popover from "@mui/material/Popover";
import { makeStyles } from '@mui/styles';
import { useDispatch, useSelector } from 'react-redux';
import { scoreActions } from '../../../store/score';

export default function TupletPickerPopover(props) {
  const durationOptions = Array.from({ length: 15 }, (_, i) => i + 2);
  const typeOptions = [
    {label: "2", value: 2}, 
    {label: "4", value: 4},
    {label: "8", value: 8}, 
    {label: "16", value: 16},
    {label: "32", value: 32}
  ];

  const actualDuration = useSelector(state => state.score.present.tuplet.actual);
  const normalDuration = useSelector(state => state.score.present.tuplet.normal);
  const type = useSelector(state => state.score.present.tuplet.type);

  const dispatch = useDispatch();

  function onChangeActualDuration(event) {
    dispatch(scoreActions.changeTupletActualDuration(+event.target.value));
  }

  function onChangeNormalDuration(event) {
    dispatch(scoreActions.changeTupletNormalDuration(+event.target.value));
  }

  function onChangeType(event) {
    dispatch(scoreActions.changeTupletType(event.target.value));
  }

  const useStyles = makeStyles((theme) => ({
    select: {
      textAlign: "left",
      margin: theme.spacing(2),
      width: 50
    }
  }));

  const classes = useStyles();

  return (
    <Popover
      id="tuplet-picker-popover"
      open={props.tupletPickerOpen}
      anchorEl={props.tupletPickerAnchorEl}
      onClose={props.handleTupletPickerClose}
      anchorOrigin={{
        vertical: "top",
        horizontal: "right",
      }}
      transformOrigin={{
        vertical: "top",
        horizontal: "right",
      }}
    >
      <Select
        value={actualDuration}
        className={classes.select}
        onChange={onChangeActualDuration}
        native
      >
        {durationOptions.map((duration) => (
          <option key={Math.random().toString()} value={duration}>
            {duration}
          </option>
        ))}
      </Select>
      :
      <Select
        value={normalDuration}
        onChange={onChangeNormalDuration}
        className={classes.select}
        native
      >
        {durationOptions.map((duration) => (
          <option key={Math.random().toString()} value={duration}>
            {duration}
          </option>
        ))}
      </Select>
      <Select
        value={type}
        onChange={onChangeType}
        className={classes.select}
        native
      >
        {typeOptions.map(props => (
          <option key={Math.random().toString()} value={props.value}>
            {props.label}
          </option>
        ))}
      </Select>
    </Popover>
  );
}
