export default function swap({ probability }, notes) {
  let noteIndexes = [...Array(notes.length).keys()];

  for (let i = 0, length = notes.length; i < length; i++) {
    if (
      Math.random() < probability
    ) {
      let indexToSwap1 = Math.floor(Math.random() * notes.length);
      let swappables = noteIndexes.filter(index => index != indexToSwap1);
      let indexToSwap2 = swappables[Math.floor(Math.random() * swappables.length)];
      swapArrayElems(notes, indexToSwap1, indexToSwap2);
    }
  }
}

function swapArrayElems(arr, from, to) {
  let temp = arr[to];
  arr[to] = arr[from];
  arr[from] = temp;
}
