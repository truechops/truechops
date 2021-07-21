import { useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import Slider from "@material-ui/core/Slider";
import Input from "@material-ui/core/Input";
import { Popover } from "@material-ui/core";
import { scoreActions } from "../../../store/score";
import { useDispatch, useSelector } from "react-redux";
import { MIN_TEMPO, MAX_TEMPO } from "../../../../consts/score";

const useStyles = makeStyles((theme) => ({
  root: {
    width: 250,
    padding: theme.spacing(1.5),
  },
  input: {
    width: 42,
  },
}));

export default function MetronomePopover(props) {
  const classes = useStyles();
  const [value, setValue] = useState(90);
  const dispatch = useDispatch();
  const tempo = useSelector((state) => state.score.present.tempo);

  const open = Boolean(props.anchorEl);

  const handleSliderChange = (event, newValue) => {
    setValue(newValue);
    dispatch(scoreActions.updateTempo(newValue));
  };

  const handleInputChange = (event) => {
    const newValue = Number(event.target.value);
    setValue(event.target.value === "" ? "" : newValue);
    dispatch(scoreActions.updateTempo(newValue));
  };

  function getValidValue(valueIn) {
    if (valueIn < MIN_TEMPO) {
      return MIN_TEMPO;
    } else if (valueIn > MAX_TEMPO) {
      return MAX_TEMPO;
    } else {
      return valueIn;
    }
  }

  const handleBlur = () => {
    const validValue = getValidValue(value);
    setValue(validValue);
  };

  return (
    <Popover
      id="metronome-popover"
      className={classes.popover}
      classes={{
        paper: classes.paper,
      }}
      open={open}
      anchorEl={props.anchorEl}
      onClose={props.handlePopoverClose}
      disableRestoreFocus
    >
      <div className={classes.root}>
        <Typography id="input-slider" center gutterBottom>
          Tempo
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs>
            <Slider
              value={typeof value === "number" ? value : 0}
              onChange={handleSliderChange}
              min={MIN_TEMPO}
              max={MAX_TEMPO}
              default={tempo}
              aria-labelledby="input-slider"
            />
          </Grid>
          <Grid item>
            <Input
              className={classes.input}
              value={value}
              margin="dense"
              onChange={handleInputChange}
              onBlur={handleBlur}
              inputProps={{
                step: 1,
                min: 40,
                max: 250,
                type: "number",
                "aria-labelledby": "input-slider",
                pattern: "\\d*",
              }}
            />
          </Grid>
        </Grid>
      </div>
    </Popover>
  );
}
