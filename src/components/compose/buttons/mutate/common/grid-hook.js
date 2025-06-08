import { useState } from "react";
import { FormControl, FormHelperText, Select } from "@mui/material";
import { useSelector, useDispatch } from 'react-redux';
import { scoreActions } from '../../../../../store/score';

export default function useGrid() {
    const grid = useSelector(state => state.score.present.mutations[0].grid);
    const dispatch = useDispatch();

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
        onChange={(event) => dispatch(scoreActions.updateMutateGrid(event.target.value))}
      >
        {options}
      </Select>
      <FormHelperText>grid</FormHelperText>
    </FormControl>
  );
  return { formControl, grid };
}
