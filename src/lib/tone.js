import * as Tone from "tone";

let part = null;

let setSampler = null;
let snareSampler = null;
let tenorsSampler = null;
let bassSampler = null;
let cymbalSampler = null;


export function setSamplers(setSamplerIn, snareSamplerIn, tenorsSamplerIn, bassSamplerIn, cymbalSamplerIn)
{
  setSampler = setSamplerIn;
  snareSampler = snareSamplerIn;
  tenorsSampler = tenorsSamplerIn;
  bassSampler = bassSamplerIn;
  cymbalSampler = cymbalSamplerIn;
}

export function update(toneJsData, repeat, startStop) {
  if (part) {
    part.dispose();
  }

  let counter = 0;
  part = new Tone.Part((time, value) => {
    if (value) {
      if (value.instrument === "drumset") {
        // the value is an object which contains both the note and the velocity
        setSampler.triggerAttackRelease(value.note, "4", time, value.velocity);
      } else if (value.instrument === "snare") {
        // the value is an object which contains both the note and the velocity
        snareSampler.triggerAttackRelease(value.note, "8n", time, value.velocity);
      } else if(value.instrument === 'tenors') {
        tenorsSampler.triggerAttackRelease(value.note, "8n", time, value.velocity);
      } else if(value.instrument === 'bass') {
        bassSampler.triggerAttackRelease(value.note, "8n", time, value.velocity);
      } else if(value.instrument === 'cymbals') {
        cymbalSampler.triggerAttackRelease(value.note, "8n", time, value.velocity);
      }
    } else {
      //It's a rest
    }

    if(++counter === toneJsData.notes.length && !part.loop) {
      startStop();
      counter = 0;
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

}

export async function start() {
  await Tone.start();
  Tone.Transport.start();
}

export async function stop() {
  Tone.Transport.stop();
}
