import { useState } from "react";
import { FormControl, FormHelperText, Select } from "@material-ui/core";

export default function useRepeat() {
  const [selectedType, setSelectedType] = useState("swap");
  let options = ["swap"].map((type) => (
    <option key={Math.random().toString()} value={type}>
      {type}
    </option>
  ));

  const formControl = (
    <FormControl>
      <Select
        value={selectedType}
        native
        onChange={(event) => setSelectedType(event.target.value)}
      >
        {options}
      </Select>
      <FormHelperText>type</FormHelperText>
    </FormControl>
  );
  return { formControl, type: selectedType };
}
