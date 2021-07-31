import { useState } from "react";
import { FormControl, FormHelperText, Select } from "@material-ui/core";
import { useSelector, useDispatch } from 'react-redux';
import { scoreActions } from '../../../../../store/score';

export default function useType() {
  const type = useSelector(state => state.score.present.mutations[0].type);
    const dispatch = useDispatch();

  let options = ["swap", "shuffle"].map((type) => (
    <option key={Math.random().toString()} value={type}>
      {type}
    </option>
  ));

  const formControl = (
    <FormControl>
      <Select
        value={type}
        native
        onChange={(event) => dispatch(scoreActions.updateMutateType(event.target.value))}
      >
        {options}
      </Select>
      <FormHelperText>type</FormHelperText>
    </FormControl>
  );
  return { formControl, type };
}
