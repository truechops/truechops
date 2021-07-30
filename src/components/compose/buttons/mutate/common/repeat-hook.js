import { useState } from "react";
import { useSelector } from 'react-redux';
import { FormControl, FormHelperText, Select } from "@material-ui/core";

export default function useRepeat(repeat) {
  const [numRepeats, setNumRepeats] = useState(repeat);
  const numMeasures = useSelector(state => state.score.present.score.measures.length);
  let options = [...Array(numMeasures > 16? 16 : Math.floor(16 / numMeasures)).keys()].map((num) => (
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
