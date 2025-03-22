import TextField from "@mui/material/TextField";
import { useState, useEffect } from "react";
import $ from 'jquery';

export default function SaveRhythmForm(props) {
  const [rhythmName, setRhythmName] = useState("");

  function onChangeRhythmName(event) {
    props.setRhythmName(event.target.value);
  }

  useEffect(() => {
   $('#rhythm-name').attr('onblur', "yo")
  }, []);

  return (
    <form onSubmit={props.onSubmitHandler.bind(null, rhythmName)}>
      <TextField
        id="rhythm-name"
        label="name"
        style={{ margin: 8 }}
        fullWidth
        required
        margin="normal"
        onChange={onChangeRhythmName}
        onBlur={onChangeRhythmName}
        value={props.rhythmName}
      />
    </form>
  );
}
