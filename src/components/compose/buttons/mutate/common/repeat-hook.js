import { useState } from "react";
import { FormControl, FormHelperText, Select } from "@material-ui/core";

export default function useRepeat() {
  const [numRepeats, setNumRepeats] = useState(1);
  let options = [...Array(8).keys()].map((num) => (
    <option key={Math.random().toString()} value={num + 1}>
      {num + 1}
    </option>
  ));

  const formControl = (
    <FormControl>
      <Select
        value={numRepeats}
        native
        onChange={(event) => setNumRepeats(event.target.value)}
      >
        {options}
      </Select>
      <FormHelperText>repeat</FormHelperText>
    </FormControl>
  );
  return { formControl, numRepeats };
}
