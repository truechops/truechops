/**
 * Mutates the score with different mutate types:
 *   swap: swap different positions in the score given a swap grid and probability.
 */

import _ from "lodash";
import {
  vfDurationToTcDuration,
  NON_ACCENT_VELOCITY,
} from "../../../consts/score";

import { getVFDurations } from "../../../helpers/score";
import swap from "./types/swap";

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
export async function mutate(score, modifiers, numRepeats) {
  let voiceNoteArrays = convertToVoiceNoteArrays(score, numRepeats);
  let mutateAllConfig = null;

  modifiers = modifiers.filter((modifier) => {
    if (modifier.context === "All") {
      mutateAllConfig = _.cloneDeep(modifier);
      return false;
    } else {
      return true;
    }
  });

  for (const modifier of modifiers) {
    const { context, type, config } = modifier;

    let mutateCallback = getMutateCallback(type);

    let measureNoteArrays = voiceNoteArrays[context];
    for (let measureNotes of measureNoteArrays) {
      _mutate(mutateCallback, config, measureNotes);
    }
  }

  let mergedVoiceNoteArray = mergeVoiceNoteArrays(voiceNoteArrays);

  if (mutateAllConfig) {
    let { type, config } = mutateAllConfig;
    let mutateCallback = getMutateCallback(type);

    mergedVoiceNoteArray.forEach((measureNotes) => {
      _mutate(mutateCallback, config, measureNotes);
    });
  }

  updateScore(score, mergedVoiceNoteArray);
}

function _mutate(mutateCallback, config, notes) {
  const modifiableNotes = getModifiableNotes(notes, config.grid);
  mutateCallback(config, modifiableNotes);

  let gridSpacing = notes.length / modifiableNotes.length;
  for (let i = 0; i < modifiableNotes.length; i++) {
    notes[i * gridSpacing] = modifiableNotes[i];
  }
}

function getMutateCallback(type) {
  let mutateCallback = null;
  if (type === "swap") {
    mutateCallback = swap;
  }

  return mutateCallback;
}

function getModifiableNotes(notes, grid) {
  let modifiableNotes = [];
  let tcDuration = vfDurationToTcDuration[grid];
  let numIndices = notes.length / tcDuration;
  for (let i = 0; i < numIndices; i++) {
    modifiableNotes.push(notes[tcDuration * i]);
  }

  return modifiableNotes;
}

function convertToVoiceNoteArrays(score, numRepeats) {
  let voiceNoteArrays = {};

  //keep track of measure lengths so we can add in voice note arrays for previous measures
  //when discovering new voices.
  let measureLengths = [];

  let currentMeasures = score.measures;

  for(let i = 1; i < numRepeats; i++) {
    currentMeasures.forEach(measure => {
      score.measures.push(_.cloneDeep(measure))
    })
  }

  score.measures.forEach((measure) => {
    const timeSig = measure.timeSig;
    const measureLength = vfDurationToTcDuration[timeSig.type] * timeSig.num;
    measureLengths.push(measureLength);
    let durationCount = 0;
    measure.parts.forEach((part) => {
      part.voices.forEach((voice) => {
        voice.notes.forEach((note) => {
          note.notes.forEach((n) => {
            console.log('1');
            //If this is a new voice. Assuming only one part for now.
            if (!voiceNoteArrays[n]) {
              console.log('2');
              voiceNoteArrays[n] = measureLengths.map((measureLength) =>
                new Array(measureLength).fill(null)
              );
            } else if (voiceNoteArrays[n].length !== measureLengths.length){
              voiceNoteArrays[n].push(new Array(measureLength).fill(null));
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
  let durationAccumulation =
    vfDurationToTcDuration[durations[0].replace("d", "")];

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
    score.measures[measureIndex].parts[0].voices[0].notes = measureNotes;
  });
}
