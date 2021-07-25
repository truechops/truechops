export default function swap(config, notes) {
    const { probability, swapWithRests } = config;
    let swappableIndices = [...Array(notes.length).keys()];
  
    for (let i = 0, length = notes.length; i < length; i++) {
      const noteIndex = i;
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