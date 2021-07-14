import TextField from "@material-ui/core/TextField";
import { useState } from "react";

export default function SaveRhythmForm(props) {
  const [rhythmName, setRhythmName] = useState("");

  function onChangeRhythmName(event) {
    props.setRhythmName(event.target.value);
  }

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
