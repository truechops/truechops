/**
 * Mutates the score with different mutate types:
 *   swap: swap different positions in the score given a swap grid and probability. 
 */

import { duration } from "@material-ui/core";
import _ from "lodash";
import {
  vfDurationToTcDuration,
  tcDurationToVfDuration,
  NON_ACCENT_VELOCITY,
} from "../../consts/score";

import { getVFDurations } from "../../helpers/score";

/**
 *
 * modifiers = [
 * {
 *     type: 'swap',
 *     context: 'C5',
 *     config: {
 *         grid: 16,
 *         probability: 0.25,
 *         swapWithRests: true
 * },
 * {
 *     type: 'random',
 *     context: 'all',
 *     config: {
 *         probability: 0.25
 *     }
 *
 * }]
 */

//Assuming only one part for now.
export function mutate(score, modifiers) {
  let voiceNoteArrays = convertToVoiceNoteArrays(score);
  let mutateAllConfig = null;

  modifiers = modifiers.filter((modifier) => {
    if (modifier.context === "all") {
      mutateAllConfig = _.cloneDeep(modifier);
      return false;
    } else {
      return true;
    }
  });

  for (const modifier of modifiers) {
    const { context, type, config } = modifier;

    let measureNoteArrays = voiceNoteArrays[context];
    for (let measureNotes of measureNoteArrays) {
      if (type === "swap") {
        swap(config, measureNotes);
      }
    }
  }

  let mergedVoiceNoteArray = mergeVoiceNoteArrays(voiceNoteArrays);

  if (mutateAllConfig) {
    let mutateFn = null;
    let { type, config } = mutateAllConfig;

    if(type === 'swap') {
      mutateFn = swap.bind(null, config)
    }
    if (mutateAllConfig.type === "swap") {
      mergedVoiceNoteArray.forEach((measureNotes) => {
        mutateFn(measureNotes);
      });
    }
  }

  updateScore(score, mergedVoiceNoteArray);
}

function getModifiableIndices(grid, length) {
  let modifiableIndices = [];
  let tcDuration = vfDurationToTcDuration[grid];
  let numIndices = length / tcDuration;
  for (let i = 0; i < numIndices; i++) {
    modifiableIndices.push(tcDuration * i);
  }

  return modifiableIndices;
}

function convertToVoiceNoteArrays(score) {
  let voiceNoteArrays = {};

  //keep track of measure lengths so we can add in voice note arrays for previous measures
  //when discovering new voices.
  let measureLengths = [];

  score.measures.forEach((measure) => {
    const timeSig = measure.timeSig;
    const measureLength = vfDurationToTcDuration[timeSig.type] * timeSig.num;
    measureLengths.push(measureLength);
    let durationCount = 0;
    measure.parts.forEach((part) => {
      part.voices.forEach((voice) => {
        voice.notes.forEach((note) => {
          note.notes.forEach((n) => {
            //If this is a new voice. Assuming only one part for now.
            if (!voiceNoteArrays[n]) {
              voiceNoteArrays[n] = measureLengths.map((measureLength) =>
                new Array(measureLength).fill(null)
              );
            }

            voiceNoteArrays[n][measureLengths.length - 1][durationCount] = {
              ornaments: note.ornaments || "",
              velocity: note.velocity,
            };
          });

          durationCount += vfDurationToTcDuration[note.duration];
        });
      });
    });
  });

  return voiceNoteArrays;
}

function addDuration(measureNotes, index, previousNoteIndex) {
  //Add the duration to the note. If the duration is dotted, i.e.: '8d',
  //it will be returned in the undotted form.
  function _addDuration(duration, note) {
    let dotted = false;
    if (duration.includes("d")) {
      duration = duration.replace("d", "");
      dotted = true;
    }

    note.duration = duration;
    if (dotted) {
      note.dots = 1;
    }

    return duration;
  }

  let durations = getVFDurations(index - previousNoteIndex);
  let previousNote = measureNotes[previousNoteIndex];
  durations[0] = _addDuration(durations[0], previousNote);
  let durationAccumulation = vfDurationToTcDuration[durations[0].replace('d', '')];

  //note rests need to be created for additional durations.
  for (let i = 1; i < durations.length; i++) {
    let newNote = _.cloneDeep(previousNote);
    newNote.notes = [];
    delete newNote.dots;

    durations[i] = _addDuration(durations[i], newNote);
    measureNotes[previousNoteIndex + durationAccumulation] = newNote;
    durationAccumulation += vfDurationToTcDuration[durations[i]];
  }
}

function mergeVoiceNoteArrays(voiceNoteArrays) {
  let mergedVoiceNoteArray = [];
  let mergedMeasureNotes = {};

  for (const [voice, measureNoteArrays] of Object.entries(voiceNoteArrays)) {
    measureNoteArrays.forEach((measureNotes, measureIndex) => {
      if (!mergedMeasureNotes[measureIndex]) {
        mergedMeasureNotes[measureIndex] = new Array(measureNotes.length).fill(
          null
        );
      }

      measureNotes.forEach((note, noteIndex) => {
        if (note) {
          let notes = _.get(
            mergedMeasureNotes,
            `${measureIndex}[${noteIndex}].notes`,
            []
          );
          notes.push(voice);
          let duration = note.duration;
          let velocity = note.velocity;
          let ornaments = note.ornaments;
          mergedMeasureNotes[measureIndex][noteIndex] = {
            notes,
            duration,
            velocity,
            ornaments,
          };
        }
      });
    });
  }

  for (const [measureNum, measureNotes] of Object.entries(mergedMeasureNotes)) {
    mergedVoiceNoteArray.push(measureNotes);
  }

  return mergedVoiceNoteArray;
}

function updateScore(score, mergedNotesArray) {
  console.log("mergedNotesArray: " + JSON.stringify(mergedNotesArray));
  mergedNotesArray.forEach((measureNotes, measureIndex) => {
    let previousNoteIndex = null;
    measureNotes.forEach((note, index) => {
      //If we encounter a non-rest note or we are at the quarter note boundary (index % 8 === 0).
      if (note || index % 8 === 0) {
        //This is null for the very first note we encounter.
        if (previousNoteIndex != null) {
          addDuration(measureNotes, index, previousNoteIndex);
        }

        if (!note) {
          //duration will be filled in by this process
          measureNotes[index] = {
            notes: [],
            velocity: NON_ACCENT_VELOCITY,
            ornaments: "",
          };
        }

        previousNoteIndex = index;
      }
    });

    addDuration(measureNotes, measureNotes.length, previousNoteIndex);
    measureNotes = measureNotes.filter((note) => note != null);
    console.log("measureNotes: " + JSON.stringify(measureNotes));
    score.measures[measureIndex].parts[0].voices[0].notes = measureNotes;
  });
}

function swap(config, notes) {
  const { grid, probability, swapWithRests } = config;
  let modifiableIndices = getModifiableIndices(grid, notes.length);
  let swappableIndices = modifiableIndices.slice();

  for (let m = 0, length = modifiableIndices.length; m < length; m++) {
    const noteIndex = modifiableIndices[m];
    if (
      Math.random() < probability &&
      swappableIndices.length > 0 &&
      swappableIndices.indexOf(noteIndex) > 0
    ) {
      let indexToSwap = Math.floor(Math.random() * swappableIndices.length);
      let indexSwap1 = swappableIndices[indexToSwap];

      //Don't swap if we are swapping with the same index
      if (
        noteIndex !== indexSwap1 &&
        (notes[noteIndex] != null || swapWithRests)
      ) {
        swappableIndices.splice(indexToSwap, 1);
        let indexSwap2 = swappableIndices.splice(
          swappableIndices.indexOf(noteIndex),
          1
        )[0];
        swapArrayElems(notes, indexSwap1, indexSwap2);
      }
    }
  }
}

const swapArrayElems = (arr, from, to) => {
  let temp = arr[to];
  arr[to] = arr[from];
  arr[from] = temp;
};
