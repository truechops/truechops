export default function raEmergentCycles({ probability }, notes) {
  let noteIndexes = [...Array(notes.length).keys()];

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

        //if (drumSounds.hasOwnProperty(drumsoundOnNote) === false) {
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
  emergentCycles(notes, drumSounds);
}

/**
 *
 * @param array<objects> notes
 *  An array of notes objects.
 *
 * @param array drumSounds
 *   It contains an array of drum sounds of the same length.
 **/
function emergentCycles(notes, drumSounds) {
  for (let [i, val] of drumSounds.entries()) {
    console.log(val);
    for (let j = 0, lengthJ = drumSounds[i].data.length; j < lengthJ; j++) {
      let neighborhoodSize = calculateNeighborhood(drumSounds[i].data, j);
      drumSounds[i].data[j] = applyEmergentCykles(neighborhoodSize, drumSounds[i].data[j])
    }
  }
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
function applyEmergentCykles(neighborhoodSize, noteValue) {
  if (neighborhoodSize == 0) {
    return 1;
  } else if (neighborhoodSize == 1) {
    return 0;
  } else if (neighborhoodSize == 2) {
    return 0;
  } else {
    return noteValue;
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
