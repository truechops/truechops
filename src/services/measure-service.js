import _ from "lodash";
import { getEmptyMeasure } from "../helpers/score";

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

// Appends generated snare measures to the score. Other instruments in the score
// get empty parts, and an untouched one-measure score is replaced rather than
// extended.
export function appendGeneratedMeasures(state, action) {
  const generated = action.payload?.measures || [];
  if (!generated.length) return;

  const score = state.score;
  score.parts = score.parts || {};
  score.parts.snare = { ...(score.parts.snare || {}), enabled: true };
  // Same part order as the score's existing measures.
  const instruments = [...new Set([...(score.measures[0]?.parts || []).map((part) => part.instrument), "snare"])];
  const isEmpty = score.measures.length === 1 && score.measures[0].parts.every((part) =>
    part.voices.every((voice) => voice.notes.every((note) => !note.notes || !note.notes.length)));
  const measures = generated.map((measure) => {
    const empty = getEmptyMeasure(measure.timeSig, instruments);
    const snare = measure.parts.find((part) => part.instrument === "snare") || measure.parts[0];
    return {
      timeSig: measure.timeSig,
      parts: empty.parts.map((part) => (part.instrument === "snare" ? _.cloneDeep(snare) : part)),
    };
  });

  if (isEmpty) {
    score.measures = measures;
  } else {
    score.measures.push(...measures);
  }
  state.selectedNoteIndex = null;
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
