import * as Tone from "tone";

export function setupPlayback(toneJsNotes, loopTimeDuration) {
  const setSampler = new Tone.Sampler({
    urls: {
      C5: "snare.wav",
      E5: "hh.wav",
      D4: "kick.wav",
    },
    release: 1,
    baseUrl: `${window.location.href}samples/set/`,
  }).toDestination();

  const tenorsSampler = new Tone.Sampler({
    urls: {
      C5: "1.wav",
      E5: "2.wav",
      D4: "3.wav",
    },
    release: 1,
    baseUrl: `${window.location.href}samples/tenors/`,
  }).toDestination();

  new Tone.PolySynth().toDestination();
  // use an array of objects as long as the object has a "time" attribute

  let part = new Tone.Part((time, value) => {
    if (value.instrument === "drumset") {
      // the value is an object which contains both the note and the velocity
      setSampler.triggerAttackRelease(value.note, "8n", time, value.velocity);
    } else if (value.instrument === "tenors") {
      // the value is an object which contains both the note and the velocity
      tenorsSampler.triggerAttackRelease(
        value.note,
        "8n",
        time,
        value.velocity
      );
    }
  }, toneJsNotes).start(0);

  part.loopStart = 0;
  part.loopEnd = loopTimeDuration;
  part.loop = true;
}

export async function play() {
  await Tone.start();
  Tone.Transport.start();
}

// Tone.Transport.scheduleRepeat((time) => {
//   if (changeNotes) {
//     part.dispose();
//     part = new Tone.Part((time, value) => {
//       // the value is an object which contains both the note and the velocity
//       sampler.triggerAttackRelease(value.note, "8n", time, value.velocity);
//     }, notes).start(0);
//     part.loopStart = 0;
//     part.loopEnd = loopTimeDuration;
//     part.loop = true;

//     changeNotes = false;
//   }
// }, loopTimeDuration);
