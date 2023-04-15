/**
 * Mutates the score with different mutate types:
 *   swap: swap different positions in the score given a swap grid and probability.
 */

import _ from "lodash";
import {
  vfDurationToTcDuration,
  NON_ACCENT_VELOCITY,
  timeSigs
} from "../../consts/score";

import {
  getVFDurations,
  getNotesLength,
  getTupletLengths,
  getTCDurationSingle,
} from "../../helpers/score";
import swap from "./types/swap";
import shuffle from './types/shuffle';
import reverse from './types/reverse';
import cellularAutomata from './types/cellularAutomata';
import {
  DELAYED_STABILITY,
  RHYTHMIC_INVERSION,
  DENSITY_THINNING,
  EVOLVING_THINNING,
  EMERGENT_CYCLES,
  PROPABILISTIC_TRANSITIONS,
  RHYTHMIC_PHASING} from "../../consts/raTypes";

/**
 *
 * modifiers = [
 * {
 *     type: 'swap',
 *     context: 'C5',
 *     config: {
 *         grid: 16,
 *         probability: 0.25
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
export function mutate(score, mutations, numRepeats, scoreVoices) {
  let { voiceNoteArrays, tupletLengths } = convertToVoiceNoteArrays(
    score,
    numRepeats,
    scoreVoices
  );

  let measureBoundaries = getMeasureBoundaries(score);

  let mutateAllConfig = null;
  mutations = mutations.filter((modifier) => {
    if (modifier.context === "All") {
      mutateAllConfig = _.cloneDeep(modifier);
      return false;
    } else {
      return true;
    }
  });

  for (const mutation of mutations) {
    const { context, type, config, grid } = mutation;

    let mutateFn = getMutateFn(type);
    let measureNoteArrays = voiceNoteArrays[context];
    for (let measureNotes of measureNoteArrays) {
      _mutate(mutateFn, config, measureNotes, grid, type);
    }
  }

  let mergedVoiceNoteArray = mergeVoiceNoteArrays(voiceNoteArrays);

  if (mutateAllConfig) {
    let { type, config, grid } = mutateAllConfig;
    let mutateFn = getMutateFn(type);

    mergedVoiceNoteArray.forEach((measureNotes) => {
      _mutate(mutateFn, config, measureNotes, grid, type);
    });
  }

  updateScore(score, mergedVoiceNoteArray, tupletLengths, measureBoundaries);
}

function _mutate(mutateFn, config, notes, grid, type) {
  const modifiableNotes = getModifiableNotes(notes, grid);
  mutateFn(config, modifiableNotes, type);

  let gridSpacing = notes.length / modifiableNotes.length;
  for (let i = 0; i < modifiableNotes.length; i++) {
    notes[i * gridSpacing] = modifiableNotes[i];
  }
}

function getMutateFn(type) {
  let mutateFn = null;
  if (type === "swap") {
    mutateFn = swap;
  } else if(type === "shuffle") {
    mutateFn = shuffle;
  } else if(type === "reverse") {
    mutateFn = reverse;
  } else if(type === DELAYED_STABILITY) {
    mutateFn = cellularAutomata;
  } else if(type === RHYTHMIC_INVERSION) {
    mutateFn = cellularAutomata;
  } else if(type === DENSITY_THINNING) {
    mutateFn = cellularAutomata;
  } else if(type === EVOLVING_THINNING) {
    mutateFn = cellularAutomata;
  } else if(type === EMERGENT_CYCLES) {
    mutateFn = cellularAutomata;
  } else if(type === PROPABILISTIC_TRANSITIONS) {
    mutateFn = cellularAutomata;
  } else if(type === RHYTHMIC_PHASING) {
    mutateFn = cellularAutomata;
  }

  return mutateFn;
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

function getMeasureBoundaries(score) {
  let boundaries = [];

  score.measures.forEach((measure) => {
    let measureBoundaries = [];
    let durations = timeSigs[`${measure.timeSig.num}/${measure.timeSig.type}`].notes;
    let tempBoundaries = [];
    let durationTotal = 0;
    for(let i = 0; i < durations.length - 1; i++) {
      durationTotal += getTCDurationSingle(durations[i].replace('d', ''), durations[i].includes('d') ? 1 : 0);
      tempBoundaries.push(durationTotal);
    }

    measure.parts.forEach((part) => [
      part.voices.forEach((voice) => {
        let notes = voice.notes;
        let index = 0;
        let tuplets = _.cloneDeep(voice.tuplets);
        let length = 0;

        while (index < notes.length && tempBoundaries.length > 0) {
          if (tuplets.length > 0) {
            let {
              start: tupletStart,
              end: tupletEnd,
              actual,
              normal,
            } = tuplets[0];
            if (index >= tupletStart && index < tupletEnd) {
              let noteEnd = length;
              let tupletLength = 0;
              for (let i = tupletStart; i < tupletEnd; i++) {
                let duration = getTCDurationSingle(
                  notes[i].duration,
                  notes[i].dots
                );
                noteEnd += duration;
                tupletLength += duration;
                index++;
              }

              if (noteEnd >= tempBoundaries[0]) {
                measureBoundaries.push(noteEnd);
                tempBoundaries.shift();
              }

              tuplets.shift();
              length = noteEnd;

              let tupletType = tupletLength / actual;
              let additionalLength = tupletType * (actual - normal);
              for (let j = 0; j < tempBoundaries.length; j++) {
                tempBoundaries[j] += additionalLength;
              }
            }
          } else {
            length += getTCDurationSingle(
              notes[index].duration,
              notes[index].dots
            );
            if (length >= tempBoundaries[0]) {
              measureBoundaries.push(tempBoundaries[0]);
              tempBoundaries.shift();
            }

            index++;
          }
        }

        boundaries.push(measureBoundaries);
      }),
    ]);
  });

  return boundaries;
}

function convertToVoiceNoteArrays(score, numRepeats, scoreVoices) {
  let voiceNoteArrays = {};

  let currentMeasures = _.cloneDeep(score.measures);

  for (let i = 1; i < numRepeats; i++) {
    currentMeasures.forEach((measure) => {
      score.measures.push(_.cloneDeep(measure));
    });
  }

  for(const voice of scoreVoices) {
    voiceNoteArrays[voice] = score.measures.map(measure => {
      const measureLength = getNotesLength(measure.parts[0].voices[0].notes);
      return new Array(measureLength).fill(null);
    })
  }

  let tupletLengths = [];
  score.measures.forEach((measure, measureIndex) => {
    let durationCount = 0;
    measure.parts.forEach((part) => {
      part.voices.forEach((voice) => {
        tupletLengths.push(getTupletLengths(voice));
        voice.notes.forEach((note) => {
          note.notes.forEach((n) => {
            //If this is a new voice. Assuming only one part for now.
            // if (!voiceNoteArrays[n]) {
            //   voiceNoteArrays[n] = measureLengths.map((measureLength) =>
            //     new Array(measureLength).fill(null)
            //   );
            // } else if (voiceNoteArrays[n].length !== measureLengths.length) {
            //   voiceNoteArrays[n].push(new Array(measureLength).fill(null));
            // }

            voiceNoteArrays[n][measureIndex][durationCount] = {
              ornaments: note.ornaments || "",
              velocity: note.velocity,
            };
          });

          durationCount += getTCDurationSingle(note.duration, note.dots);
        });
      });
    });
  });

  return { voiceNoteArrays, tupletLengths };
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

function updateScore(
  score,
  mergedNotesArray,
  tupletLengths,
  measureBoundaries
) {

  mergedNotesArray.forEach((measureNotes, measureIndex) => {
    let previousNoteIndex = null;
    measureNotes.forEach((note, index) => {
      if (
        index === 0 ||
        note ||
        measureBoundaries[measureIndex].includes(index)
      ) {
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

    //reset/restore the tuplets
    score.measures[measureIndex].parts.forEach((part) => {
      part.voices.forEach((voice) => {
        let tupletTypes = voice.tuplets.map((tuplet) => ({
          actual: tuplet.actual,
          normal: tuplet.normal,
        }));
        voice.tuplets = [];
        let endTupletIndex = 0;
        tupletLengths[measureIndex].forEach(
          (tupletLength, tupletLengthsIndex) => {
            let notesLength = 0;
            let startTupletIndex = endTupletIndex;
            while (notesLength < tupletLength) {
              notesLength += getTCDurationSingle(
                voice.notes[endTupletIndex].duration,
                voice.notes[endTupletIndex].dots
              );
              endTupletIndex++;
            }

            voice.tuplets.push({
              start: startTupletIndex,
              end: endTupletIndex,
              actual: tupletTypes[tupletLengthsIndex].actual,
              normal: tupletTypes[tupletLengthsIndex].normal,
            });
          }
        );
      });
    });
  });
}
