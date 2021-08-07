import _ from "lodash";
import { getEmptyMeasure } from "../../helpers/score";

export function addMeasure(state, action) {
  const isRight = action.payload;
  const measures = state.score.measures;
  let index = 0;
  if (!_.has(state, "selectedNoteIndex") || !state.selectedNoteIndex) {
    index = isRight ? measures.length - 1 : 0;
  } else {
    index = state.selectedNoteIndex.measureIndex;
  }

  //make sure a measure is selected
  const { timeSig, parts } = state.score.measures[index];

  //Get the empty measure given the time signature and instruments
  const emptyMeasure = getEmptyMeasure(
    timeSig,
    parts.map((part) => part.instrument)
  );

  //Either insert the empty measure to the left or right of the currently selected measure.
  state.score.measures.splice(isRight ? index + 1 : index, 0, emptyMeasure);

  if(!isRight && "selectedNoteIndex" in state && state.selectedNoteIndex) {
      state.selectedNoteIndex.measureIndex++;
  }
}

export function deleteMeasure(state) {
  if (!_.has(state, "selectedNoteIndex") || !state.selectedNoteIndex) {
    return;
  }

  const measureIndex = state.selectedNoteIndex.measureIndex;

  //make sure a measure is selected
  if (measureIndex >= 0) {
    //The initial splice arguments: deleting one entry at the specified measure index.
    let spliceArguments = [measureIndex, 1];

    //If they are removing the only measure in the score
    if (state.score.measures.length === 1) {
      const { timeSig, parts } = state.score.measures[measureIndex];

      //We need to add an empty measure if they are deleting the only measure in the score.
      spliceArguments.push(
        getEmptyMeasure(
          timeSig,
          parts.map((part) => part.instrument)
        )
      );
    }

    state.score.measures.splice.apply(state.score.measures, spliceArguments);
  }

  state.selectedNoteIndex = null;
}

export function updateTimeSig(state, action) {
  if (!("selectedNoteIndex" in state)) {
    return;
  }

  const timeSig = action.payload;
  state.timeSig = timeSig;
  const measureIndex = state.selectedNoteIndex.measureIndex;
  const { parts } = state.score.measures[measureIndex];
  state.score.measures.splice(
    measureIndex,
    1,
    getEmptyMeasure(
      timeSig,
      parts.map((part) => part.instrument)
    )
  );

  state.selectedNoteIndex = null;
}
