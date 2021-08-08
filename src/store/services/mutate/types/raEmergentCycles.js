export default function raEmergentCycles({ probability }, notes) {
  let noteIndexes = [...Array(notes.length).keys()];
  console.log(notes);

  // Massage input. Convert Notes to single drum sound notes.
  let drumSounds = [];
  for (let i = 0, lengthI = notes.length; i < lengthI; i++) {
    let currentNote = notes[i];
    if(currentNote != null) {
      for (let j = 0, lengthJ = currentNote.notes.length; j < lengthJ; j++) {
        let drumsoundOnNote = notes[i].notes[j];
        if (drumSounds.hasOwnProperty(drumsoundOnNote) === false) {
          drumSounds[drumsoundOnNote] = new Array(notes.length).fill(false);
        }
        // Set the actual note.
        drumSounds[drumsoundOnNote][i] = true;
      }
    }
    else {
      // Consider this non note.
    }
  }
  console.log(drumSounds);
}

function swapArrayElems(arr, from, to) {
  let temp = arr[to];
  arr[to] = arr[from];
  arr[from] = temp;
}
