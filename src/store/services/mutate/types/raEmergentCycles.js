export default function raEmergentCycles(config, notes) {
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
  console.log(drumSounds);
  const loop0 = emergentCycles(drumSounds);
  console.log("Loop0::");
  console.log(loop0);
  const loop1 = emergentCycles(loop0);
  console.log("Loop1::");
  console.log(loop1);
  // The above work now! Need to make the function converting these arrays to not arrays.


  /*for (let i = 1; i < 4; i++) {
    newSounds.push([...emergentCycles(newSounds[i-1])]);
  }*/
}

/**
 *
 * @param array<objects> notes
 *  An array of notes objects.
 *
 * @param array drumSounds
 *   It contains an array of drum sounds of the same length.
 **/
function emergentCycles(drumSounds) {
  const newDrumSounds = [];
  for (let [i, val] of drumSounds.entries()) {
    newDrumSounds.push({note: drumSounds[i].note, data: []});
    for (let j = 0, lengthJ = drumSounds[i].data.length; j < lengthJ; j++) {
      let neighborhoodSize = calculateNeighborhood(drumSounds[i].data, j);
      let a = applyEmergentCycles(neighborhoodSize, drumSounds[i].data[j]);
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
function applyEmergentCycles(neighborhoodSize, noteValue) {
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
