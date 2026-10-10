import { useCallback, useContext, useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import ToneContext from "../../store/tone-context";
import { practicePlayback } from "../../lib/book-practice-score";
import { clearPlayback } from "../../lib/tone";
import styles from "./practice.module.css";

export default function PracticePlayer({ score, tempo, setTempo }) {
  const { snareSampler } = useContext(ToneContext);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [click, setClick] = useState(false);
  const [error, setError] = useState("");
  const run = useRef({ part: null, end: null, revision: 0 });
  const stop = useCallback(() => {
    run.current.revision++;
    run.current.part?.dispose();
    run.current.part = null;
    if (run.current.end != null) Tone.Transport.clear(run.current.end);
    run.current.end = null;
    Tone.Transport.stop();
    Tone.Transport.position = 0;
    snareSampler?.releaseAll();
    setPlaying(false);
  }, [snareSampler]);
  useEffect(() => { stop(); return stop; }, [score, tempo, loop, click, stop]);
  async function play() {
    if (playing) { stop(); return; }
    stop();
    const revision = run.current.revision;
    setError("");
    setPlaying(true);
    try {
      await Tone.start();
      await Tone.loaded();
      if (revision !== run.current.revision) return;
      if (!snareSampler?.loaded) throw new Error("Drum samples are still loading. Please try again.");
      const data = practicePlayback(score, tempo, click);
      clearPlayback();
      const part = new Tone.Part((time, note) => snareSampler.triggerAttackRelease(note.note, "32n", time, note.velocity), data.events);
      run.current.part = part;
      part.loop = loop;
      part.loopEnd = data.duration;
      part.start(0);
      if (!loop) run.current.end = Tone.Transport.scheduleOnce((time) => Tone.Draw.schedule(stop, time), data.duration);
      const startsAt = Tone.now() + 0.05;
      data.initialGrace.forEach((note) => snareSampler.triggerAttackRelease(note.note, "32n", startsAt + note.time, note.velocity));
      Tone.Transport.start(startsAt);
    } catch (playError) { stop(); setError(playError.message); }
  }
  return <div>
    <div className={styles.row}>
      <button className={styles.primary} disabled={!score} onClick={play}>{playing ? "Stop" : "Play selected"}</button>
      <label className={styles.field}>Tempo <input aria-label="Tempo" type="number" min="30" max="300" value={tempo}
        onChange={(event) => setTempo(Math.max(30, Math.min(300, Number(event.target.value) || 30)))} /> BPM</label>
      <button onClick={() => setTempo(Math.max(30, tempo - 5))} aria-label="Slower by 5 BPM">−5</button>
      <button onClick={() => setTempo(Math.min(300, tempo + 5))} aria-label="Faster by 5 BPM">+5</button>
      <label><input type="checkbox" checked={loop} onChange={(event) => setLoop(event.target.checked)} /> Loop</label>
      <label><input type="checkbox" checked={click} onChange={(event) => setClick(event.target.checked)} /> Metronome</label>
    </div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </div>;
}
