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
        if (drumSounds.hasOwnProperty(drumsoundOnNote) === false) {
          drumSounds.push({note: drumsoundOnNote, data: new Array(notes.length).fill(0)});
        }
        // Set the actual note.
        console.log(findWithAttr(drumSounds, "note", drumsoundOnNote));
        //drumSounds[][i] = 1;
      }
    }
  }
  console.log(drumSounds);
  //emergentCycles(notes, drumSounds);
}

function findWithAttr(array, attr, value) {
    for(var i = 0; i < array.length; i += 1) {
        if(array[i][attr] === value) {
            return i;
        }
    }
    return -1;
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
  console.log("emergentCycles");
    console.log(drumSounds);

  for (let [index, val] of drumSounds.entries()) {
    console.log(11111);
  }

  for (let [i, val] of drumSounds.entries()) {
    for (let j = 0, lengthJ = drumSounds[i].length; j < lengthJ; j++) {
      let neighborhoodSize = calculateNeighborhood(drumSounds[i], j);
      console.log(neighborhoodSize);
    }
  }
  /*for (let i = 0, lengthI = drumSounds.length; i < lengthI; i++) {
  }*/
}

function calculateNeighborhood(drumSoundPattern, index) {
  if (j>0 && j < drumSoundPattern.length-1) {
    return drumSoundPattern[index] + drumSoundPattern[index+1]
  }
  else if (j <= drumSoundPattern.length-1) {
    return drumSoundPattern[index] + drumSoundPattern[index-1]
  }
  else {
    return drumSoundPattern[index] + drumSoundPattern[index-1] + drumSoundPattern[index+1]
  }
}
