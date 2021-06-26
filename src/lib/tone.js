import * as Tone from "tone";

let part = null;

let setSampler = null;
let tenorsSampler = null;

export function setSamplers(setSamplerIn, tenorsSamplerIn)
{
  setSampler = setSamplerIn;
  tenorsSampler = tenorsSamplerIn;
}

export function update(toneJsData, repeat, toggleIsPlaying) {
  if (part) {
    part.dispose();
  }

  let counter = 0;
  part = new Tone.Part((time, value) => {
    if (value) {
      if (value.instrument === "drumset") {
        // the value is an object which contains both the note and the velocity
        setSampler.triggerAttackRelease(value.note, "4", time, value.velocity);
      } else if (value.instrument === "tenors") {
        // the value is an object which contains both the note and the velocity
        tenorsSampler.triggerAttackRelease(
          value.note,
          "8n",
          time,
          value.velocity
        );
      }
    } else {
      //It's a rest
    }

    if(++counter === toneJsData.notes.length && !part.loop) {
      toggleIsPlaying();
    }
  }, toneJsData.notes);

  if('start' in repeat && 'end' in repeat) {
    const numMeasures = toneJsData.numMeasures;
    const durationPerMeasure = toneJsData.duration / numMeasures;
    part.loopStart = durationPerMeasure * repeat.start;
    part.loopEnd = durationPerMeasure * (repeat.end + 1);
    part.loop = true;
  }

  part.start(0);

  // if(isInitial) {
  //   Tone.Transport.scheduleRepeat((time) => {
  //     const newToneJsNotes = newNotes();

  //     if(newToneJsNotes) {
  //       if(part) {
  //         part.dispose();
  //       }
  //       console.log("has new notes");
  //       part = new Tone.Part((time, value) => {
  //         if (value.note) {
  //           if (value.instrument === "drumset") {
  //             // the value is an object which contains both the note and the velocity
  //             setSampler.triggerAttackRelease(value.note, "8n", time, value.velocity);
  //           } else if (value.instrument === "tenors") {
  //             // the value is an object which contains both the note and the velocity
  //             tenorsSampler.triggerAttackRelease(
  //               value.note,
  //               "8n",
  //               time,
  //               value.velocity
  //             );
  //           }
  //         } else {
  //           //It's a rest
  //         }
  //       }, newToneJsNotes);

  //       part.start(0);
  //       part.loopStart = 0;
  //       part.loopEnd = loopTimeDuration;
  //       part.loop = true;

  //       clearToneJsNotes();
  //     }
  //   }, loopTimeDuration);

  //   isInitial = false;
  // }
}

export async function start() {
  await Tone.start();
  Tone.Transport.start();
}

export async function stop() {
  Tone.Transport.stop();
}
