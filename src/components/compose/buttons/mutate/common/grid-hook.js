import { useState } from "react";
import { FormControl, FormHelperText, Select } from "@material-ui/core";

export default function useGrid() {
  const [grid, setGrid] = useState(16);
  let options = [4, 8, 16, 32].map((num) => (
    <option key={Math.random().toString()} value={num}>
      {num}
    </option>
  ));

  const formControl = (
    <FormControl>
      <Select
        value={grid}
        native
        onChange={(event) => setGrid(event.target.value)}
      >
        {options}
      </Select>
      <FormHelperText>grid</FormHelperText>
    </FormControl>
  );
  return { formControl, grid };
}
