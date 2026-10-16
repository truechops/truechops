import { useCallback, useContext, useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import ToneContext from "../../store/tone-context";
import { noteQuarterDuration } from "../../lib/book-practice-score";
import { clearPlayback } from "../../lib/tone";

export default function usePreviewAudio() {
  const samples = useContext(ToneContext);
  const [playing, setPlaying] = useState(null), [error, setError] = useState("");
  const run = useRef({ revision: 0, part: null, end: null });
  const stop = useCallback(() => {
    run.current.revision++;
    if (run.current.part) {
      run.current.part.dispose();
      Tone.Transport.stop();
      Tone.Transport.position = 0;
    }
    if (run.current.end != null) Tone.Transport.clear(run.current.end);
    run.current.part = null;
    run.current.end = null;
    setPlaying(null);
  }, []);
  useEffect(() => stop, [stop]);
  async function play(key, score, tempo) {
    const wasPlaying = playing === key;
    stop(); setError("");
    if (wasPlaying) return;
    const revision = run.current.revision;
    setPlaying(key);
    try {
      await Tone.start();
      await Tone.loaded();
      if (revision !== run.current.revision) return;
      const instruments = { snare: samples.snareSampler, drumset: samples.setSampler, tenors: samples.tenorsSampler, bass: samples.bassSampler, cymbals: samples.cymbalsSampler };
      const events = [];
      let offset = .04;
      for (const measure of score.measures) {
        for (const part of measure.parts) {
          if (score.parts?.[part.instrument]?.enabled === false) continue;
          if (!instruments[part.instrument]?.loaded) throw new Error("Drum samples are still loading. Please try again.");
          for (const voice of part.voices) {
            let time = offset;
            voice.notes.forEach((note, index) => {
              const duration = noteQuarterDuration(note, index, voice.tuplets || []) * 60 / tempo;
              const markings = note.ornaments || "";
              for (const pitch of note.notes) {
                const event = { time, instrument: part.instrument, pitch: markings.includes("b") ? "G5" : pitch, velocity: markings.includes("a") ? 1 : .5 };
                events.push(event);
                if (/[dc]/.test(markings)) events.push({ ...event, time: time + duration / 2 });
                if (/[fc]/.test(markings)) events.push({ ...event, time: time - .0175, velocity: .3 });
              }
              time += duration;
            });
          }
        }
        offset += measure.timeSig.num * 4 / measure.timeSig.type * 60 / tempo;
      }
      clearPlayback();
      Tone.Transport.stop(); Tone.Transport.position = 0;
      run.current.part = new Tone.Part((time, note) => instruments[note.instrument].triggerAttackRelease(note.pitch, "32n", time, note.velocity), events).start(0);
      run.current.end = Tone.Transport.scheduleOnce((time) => Tone.Draw.schedule(stop, time), offset + .12);
      Tone.Transport.start();
    } catch (failure) { if (revision === run.current.revision) { stop(); setError(failure.message); } }
  }
  return { playing, error, play, stop };
}
