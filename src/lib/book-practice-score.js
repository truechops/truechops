// Pure score operations shared by practice, playback, validation, and tests.
export function modifyPracticeScore(score, operation) {
  const next = JSON.parse(JSON.stringify(score));
  let hand = 0;
  for (const measure of next.measures) for (const part of measure.parts) for (const voice of part.voices) {
    for (const note of voice.notes) {
      if (!note.notes.length) continue;
      const ornaments = note.ornaments || "";
      if (operation === "clear") note.ornaments = "";
      if (operation === "accents") note.ornaments = ornaments.replace(/a/g, "");
      if (operation === "swap") note.ornaments = ornaments.replace(/[rl]/g, (value) => value === "r" ? "l" : "r");
      if (operation === "alternate") note.ornaments = ornaments.replace(/[rl]/g, "") + (hand++ % 2 ? "l" : "r");
    }
  }
  return next;
}

export function noteQuarterDuration(note, index, tuplets = []) {
  return (4 / note.duration) * (2 - 2 ** -(note.dots || 0)) * tuplets.reduce((ratio, group) =>
    index >= group.start && index < group.end ? ratio * group.normal / group.actual : ratio, 1);
}

export function practicePlayback(score, tempo = 80, metronome = false) {
  const beat = 60 / tempo;
  const events = [];
  let cursor = 0;
  for (const measure of score.measures) {
    const length = measure.timeSig.num * 4 / measure.timeSig.type;
    if (metronome) for (let count = 0; count < length; count++) {
      events.push({ time: (cursor + count) * beat, note: "D5", velocity: count ? 0.25 : 0.45 });
    }
    for (const part of measure.parts) for (const voice of part.voices) {
      let position = cursor;
      voice.notes.forEach((note, index) => {
        const duration = noteQuarterDuration(note, index, voice.tuplets);
        if (note.notes.length) {
          const ornaments = note.ornaments || "";
          const event = { time: position * beat, note: ornaments.includes("b") ? "G5" : "C5", velocity: ornaments.includes("a") ? 0.95 : 0.55 };
          events.push(event);
          if (/[dc]/.test(ornaments)) events.push({ ...event, time: event.time + duration * beat / 2 });
          if (/[fc]/.test(ornaments)) events.push({ ...event, time: event.time - 0.0175, velocity: 0.25 });
        }
        position += duration;
      });
    }
    cursor += length;
  }
  const duration = cursor * beat;
  // A grace before beat one belongs at the preceding loop's end. Schedule it
  // separately before the first pass; do not shift or lengthen the whole loop.
  return { events: events.map((event) => ({ ...event, time: event.time < 0 ? duration + event.time : event.time })),
    initialGrace: events.filter((event) => event.time < 0), duration };
}

export function validatePracticeLines(lines) {
  if (!Array.isArray(lines) || !lines.length || lines.length > 64) throw new Error("Choose between 1 and 64 rhythms to save.");
  return lines.map((line, index) => {
    const score = line?.score;
    if (!Array.isArray(score?.measures) || !score.measures.length || score.measures.length > 2) throw new Error("Invalid rhythm.");
    const measures = score.measures.map((measure) => {
      if (measure?.timeSig?.num !== 4 || measure?.timeSig?.type !== 4 || measure.parts?.length !== 1 ||
        measure.parts[0].instrument !== "snare" || measure.parts[0].voices?.length !== 1) throw new Error("Expected a snare rhythm in 4/4.");
      const source = measure.parts[0].voices[0];
      if (!Array.isArray(source.notes) || !source.notes.length || source.notes.length > 256 || !Array.isArray(source.tuplets) || source.tuplets.length > 64) throw new Error("Invalid notation.");
      const notes = source.notes.map((note) => {
        if (!Array.isArray(note.notes) || note.notes.length > 1 || note.notes.some((pitch) => pitch !== "C5") ||
          ![1, 2, 4, 8, 16, 32, 64].includes(note.duration) || ![0, 1, 2].includes(note.dots || 0) ||
          (note.ornaments != null && (typeof note.ornaments !== "string" || !/^[afdcblr]*$/.test(note.ornaments) || note.ornaments.length > 7))) throw new Error("Invalid note.");
        return { notes: note.notes, duration: note.duration, dots: note.dots || 0, ornaments: note.notes.length ? note.ornaments || "" : "", velocity: 0.5 };
      });
      const tuplets = source.tuplets.map((group) => {
        const { start, end, actual, normal } = group;
        if (![start, end, actual, normal].every(Number.isInteger) || start < 0 || end <= start || end > notes.length ||
          actual < 2 || actual > 32 || normal < 1 || normal > 32) throw new Error("Invalid tuplet.");
        return { start, end, actual, normal };
      });
      const duration = notes.reduce((sum, note, i) => sum + noteQuarterDuration(note, i, tuplets), 0);
      if (Math.abs(duration - 4) > 0.00001) throw new Error("Each measure must fill 4/4.");
      return { timeSig: { num: 4, type: 4 }, parts: [{ instrument: "snare", voices: [{ notes, tuplets }] }] };
    });
    return { lineNumber: index + 1, score: { parts: { snare: { enabled: true } }, measures } };
  });
}
