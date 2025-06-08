import { useSelector, useDispatch } from "react-redux";
import { getScoreVoices, scoreActions } from "../../../../../store/score";
import { FormControl, FormHelperText, Select } from "@mui/material";


export default function useContext() {
  const scoreContexts = useSelector((state) =>
    getScoreVoices(state.score.present)
  );

  const context = useSelector(state => state.score.present.mutations[0].context);
  const dispatch = useDispatch();

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
        value={context}
        native
        onChange={(event) => dispatch(scoreActions.updateMutateContext(event.target.value))}
      >
        {options}
      </Select>
      <FormHelperText>context</FormHelperText>
    </FormControl>
  );
  return { formControl, context };
}
