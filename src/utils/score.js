import { INSTRUMENT_NOTE_TO_VOICE_MAP } from "../consts/score";

export function getScoreVoices(score) {
    let scoreVoices = new Set();
    const instrument = Object.keys(score.parts)[0];
    score.measures.forEach((measure) => {
      measure.parts.forEach((part) => {
        part.voices.forEach((voice) => {
          voice.notes.forEach((note) => {
            note.notes.forEach((n) => {
              scoreVoices.add(n);
            });
          });
        });
      });
    });

    //Returning a 'map' so that the client can access both the key and the associated instrument name
    let keysToVoices = {};
    scoreVoices.forEach((key) => {
      keysToVoices[key] = INSTRUMENT_NOTE_TO_VOICE_MAP[instrument][key];
    });

    return keysToVoices;
}