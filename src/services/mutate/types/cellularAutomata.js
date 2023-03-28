import {
  DELAYED_STABILITY,
  RHYTHMIC_INVERSION,
  DENSITY_THINNING,
  EVOLVING_THINNING,
  EMERGENT_CYCLES,
  PROPABILISTIC_TRANSITIONS,
  RHYTHMIC_PHASING} from "../../../consts/raTypes";
import {
  N,
  R,
  F,
  U,
  RF,
  raTypes
} from "../../../consts/raRules";
import {
  _N,
  _R,
  _F,
  _U,
  _RF
} from "./cellularAutomataApplicationFunctions";

export default function cellularAutomata(config, notes, type) {
  // MOVE TO PROPS or general settings.
  // Massage input. Convert Notes to single drum sound notes.
  // NOTE: All automata will normalize this input,
  // so most like a generic service could hold it.
  let drumSounds = [];
  for (let i = 0, lengthI = notes.length; i < lengthI; i++) {
    let currentNote = notes[i];
    if(currentNote != null) {
      for (let j = 0, lengthJ = currentNote.notes.length; j < lengthJ; j++) {
        let drumsoundOnNote = notes[i].notes[j];
        let noteIndex = findWithAttr(drumSounds, "note", drumsoundOnNote);
        if( noteIndex == -1) {
          let initialRhythmicScheme = new Array(notes.length).fill(0);
          initialRhythmicScheme[i]=1;
          drumSounds.push({note: drumsoundOnNote, data: initialRhythmicScheme});
        } else {
          drumSounds[noteIndex].data[i]=1;
        }
      }
    }
  }
 // Create neighnooring notes. That could fx be hihat, ride cymbal. If all of them are absent, consider adding one(randomly?)
 // Run emergent Cycles til a point you find something slightly similar.
 // Todo similarity function.

  const loop0 = ra(drumSounds, type);
  if (loop0.length > 0) {
    let newNotes =  convertArrayToNotes(loop0);
    for (let i = 0; i < newNotes.length; i++) {
      notes.splice(i,1, newNotes[i]);
    }
  }
}

function convertArrayToNotes(loop) {
 const newNotes = initializeNotes();
    // The above work now! Need to make the function converting these arrays to not arrays.
  for (let i = 0; i < loop[0].data.length; i++) {
    for (let voiceIndex = 0; voiceIndex < loop.length; voiceIndex++) {
      if (loop[voiceIndex].data[i]) {
        newNotes[i].notes.push(loop[voiceIndex].note);
      }
    }
  }
  return newNotes;
}

function initializeNotes() {
  return Array.from({ length: 16 }, () => {
   let tempNote = new Object();
   tempNote.notes = [];
   tempNote.duration = 16;
   tempNote.velocity = 1;
   tempNote.ornaments = "";
   return tempNote;
  });
}

/**
 *
 * @param array<objects> notes
 *  An array of notes objects.
 *
 * @param array drumSounds
 *   It contains an array of drum sounds of the same length.
 **/
function ra(drumSounds, type) {
  const newDrumSounds = [];
  for (let [i, val] of drumSounds.entries()) {
    newDrumSounds.push({note: drumSounds[i].note, data: []});
    for (let j = 0, lengthJ = drumSounds[i].data.length; j < lengthJ; j++) {
      let neighborhoodSize = calculateNeighborhood(drumSounds[i].data, j);
      let a = applyRA(neighborhoodSize, drumSounds[i].data[j], type);
      newDrumSounds[i].data.push(a);
    }
  }
  return newDrumSounds;
}

function calculateNeighborhood(drumSoundPattern, index) {
  if (index ==0 ) {
    return drumSoundPattern[index] + drumSoundPattern[index+1]
  }
  else if (index == drumSoundPattern.length-1) {
    return drumSoundPattern[index] + drumSoundPattern[index-1]
  }
  else {
    return drumSoundPattern[index] + drumSoundPattern[index-1] + drumSoundPattern[index+1]
  }
}
// (0) Note, (1) Rest , (2) Rest ,(3) Unchanged.
// Make this abstract so that you can pass the type and it'll figure out the rules.
function applyRA(neighborhoodSize, noteValue, raType) {
  switch (raTypes[raType][neighborhoodSize]) {
    case N:
      return _N(noteValue);
    case R:
      return _R(noteValue);
    case U:
      return _U(noteValue);
    case F:
      return _F(noteValue);
    case RF:
      return _RF(noteValue);
    default:
      return _U(noteValue);
  }
 }

/**
 * Function returning the index of an object with a specific param value within an array.
 */
function findWithAttr(array, attr, value) {
    for(var i = 0; i < array.length; i += 1) {
        if(array[i][attr] === value) {
            return i;
        }
    }
    return -1;
}
