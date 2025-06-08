import { FormControl, FormHelperText, Select } from "@mui/material";
import { useSelector, useDispatch } from 'react-redux';
import { scoreActions } from '../../../../../store/score';
import {
  DELAYED_STABILITY,
  RHYTHMIC_INVERSION,
  DENSITY_THINNING,
  EVOLVING_THINNING,
  EMERGENT_CYCLES,
  PROPABILISTIC_TRANSITIONS,
  RHYTHMIC_PHASING} from "../../../../../consts/raTypes";

export default function useType() {
  const type = useSelector(state => state.score.present.mutations[0].type);
    const dispatch = useDispatch();

  // let options = [DELAYED_STABILITY,
  //   RHYTHMIC_INVERSION,
  //   DENSITY_THINNING,
  //   EVOLVING_THINNING,
  //   EMERGENT_CYCLES,
  //   PROPABILISTIC_TRANSITIONS,
  //   RHYTHMIC_PHASING, "swap", "shuffle"].map((type) => (
  //   <option key={Math.random().toString()} value={type}>
  //     {type}
  //   </option>

  let options = ["swap", "shuffle", "reverse"].map((type) => (
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
