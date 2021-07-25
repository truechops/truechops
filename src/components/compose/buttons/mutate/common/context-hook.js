import { useState } from "react";
import { useSelector } from "react-redux";
import { getScoreVoices } from "../../../../../store/score";
import { FormControl, FormHelperText, Select } from "@material-ui/core";

export default function useVoices() {
  const scoreContexts = useSelector((state) =>
    getScoreVoices(state.score.present)
  );
  const [selectedContext, setSelectedContext] = useState("All");

  let options = [];

  options.push(<option key={Math.random().toString()} value="All">All
  </option>)

for (const [key, voice] of Object.entries(scoreContexts)) {
    options.push(<option key={Math.random().toString()} value={key}>
      {voice}
    </option>)
  }

  const formControl = (
    <FormControl>
      <Select
        value={selectedContext}
        native
        onChange={(event) => setSelectedContext(event.target.value)}
      >
        {options}
      </Select>
      <FormHelperText>context</FormHelperText>
    </FormControl>
  );
  return { formControl, context: selectedContext };
}
