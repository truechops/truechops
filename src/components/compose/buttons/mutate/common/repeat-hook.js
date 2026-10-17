import { useState } from "react";
import { useSelector } from 'react-redux';
import { FormControl, FormHelperText, Select } from "@mui/material";

export default function useRepeat(repeat) {
  const [numRepeats, setNumRepeats] = useState(repeat);
  const numMeasures = useSelector(state => state.score.present.score.measures.length);
  const repeatOptions = [...Array(numMeasures > 16? 16 : Math.floor(16 / numMeasures)).keys()].map((num) => num + 1);
  let options = repeatOptions.map((num) => (
    <option key={num} value={num}>
      {num}
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
  return { formControl, numRepeats, setNumRepeats, repeatOptions };
}
