// A beat-long group with just its opening attack reads as an ordinary quarter.
// Use the same rule when generating, validating, loading, and printing books.
function isQuarterNoteTuplet(voice, tuplet) {
  if (!tuplet) return false;
  const notes = voice.notes || [];
  const start = Number(tuplet.start);
  const end = Number(tuplet.end);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > notes.length) return false;
  const group = notes.slice(start, end);
  if (!group[0].notes?.length || group.slice(1).some((note) => note.notes?.length)) return false;
  // Diddles and cheese contain extra attacks and cannot move to a quarter note.
  if (/[dc]/.test(group[0].ornaments || "")) return false;
  // Nested groups depend on their enclosing ratio; leave that notation intact.
  if ((voice.tuplets || []).some((other) => other !== tuplet && Number(other.start) < end && Number(other.end) > start)) return false;
  const writtenBeats = group.reduce((total, note) => total +
    4 / Number(note.duration) * (2 - 2 ** -Number(note.dots || 0)), 0);
  const beats = writtenBeats * Number(tuplet.normal) / Number(tuplet.actual);
  return Number.isFinite(beats) && Math.abs(beats - 1) < 1e-8;
}

// Sextuplet attacks on the beat and/or its midpoint are ordinary eighth-note
// rhythms. Work from timing, since notes may already have absorbed rests.
function getEighthNoteTupletReplacement(voice, tuplet) {
  if (!tuplet || Number(tuplet.actual) !== 6 || Number(tuplet.normal) !== 4) return null;
  const start = Number(tuplet.start);
  const end = Number(tuplet.end);
  const notes = voice.notes || [];
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > notes.length) return null;
  if ((voice.tuplets || []).some((other) => other !== tuplet && Number(other.start) < end && Number(other.end) > start)) return null;
  const attacks = new Map();
  let beats = 0;
  for (const note of notes.slice(start, end)) {
    if (note.notes?.length) {
      if (/[dc]/.test(note.ornaments || "")) return null;
      const half = Math.round(beats * 2);
      if (half < 0 || half > 1 || Math.abs(beats * 2 - half) > 1e-8) return null;
      attacks.set(half, note);
    }
    beats += 4 / Number(note.duration) * (2 - 2 ** -Number(note.dots || 0)) * 2 / 3;
  }
  if (!Number.isFinite(beats) || Math.abs(beats - 1) > 1e-8 || !attacks.has(1)) return null;
  return [0, 1].map((half) => attacks.has(half)
    ? { ...attacks.get(half), duration: 8, dots: 0 }
    : { notes: [], duration: 8, dots: 0, velocity: 0.5 });
}

function isOrdinaryNoteTuplet(voice, tuplet) {
  return isQuarterNoteTuplet(voice, tuplet) || Boolean(getEighthNoteTupletReplacement(voice, tuplet));
}

function rewriteOrdinaryTuplets(voice, includeEighths) {
  const tuplets = voice.tuplets || [];
  const collapsed = new Map(tuplets.flatMap((tuplet) => {
    const replacement = isQuarterNoteTuplet(voice, tuplet)
      ? [{ ...voice.notes[Number(tuplet.start)], duration: 4, dots: 0 }]
      : includeEighths ? getEighthNoteTupletReplacement(voice, tuplet) : null;
    return replacement ? [[tuplet, replacement]] : [];
  }));
  if (!collapsed.size) return voice;
  const starts = new Map([...collapsed.keys()].map((tuplet) => [Number(tuplet.start), tuplet]));
  const notes = [];
  const boundaries = [];
  for (let index = 0; index < voice.notes.length;) {
    boundaries[index] = notes.length;
    const tuplet = starts.get(index);
    if (tuplet) {
      notes.push(...collapsed.get(tuplet));
      index = Number(tuplet.end);
    } else {
      notes.push(voice.notes[index]);
      index += 1;
    }
    boundaries[index] = notes.length;
  }
  return {
    ...voice, notes,
    tuplets: tuplets.filter((tuplet) => !collapsed.has(tuplet)).map((tuplet) => ({
      ...tuplet, start: boundaries[Number(tuplet.start)], end: boundaries[Number(tuplet.end)],
    })),
  };
}

function simplifyQuarterNoteTuplets(voice) {
  return rewriteOrdinaryTuplets(voice, false);
}

function simplifyOrdinaryNoteTuplets(voice) {
  return rewriteOrdinaryTuplets(voice, true);
}

const NOTE_VALUES = [1, 2, 4, 8, 16, 32].flatMap((duration) => [0, 1].map((dots) => ({
  duration, dots, beats: 4 / duration * (dots ? 1.5 : 1),
}))).sort((a, b) => b.beats - a.beats);
const noteBeats = (note) => 4 / Number(note.duration) * (2 - 2 ** -Number(note.dots || 0));

// Inside one tuplet, extend a struck note into its following rests using the
// largest single (possibly dotted) value. Never pass the next attack or the
// tuplet boundary. Extra attacks from diddles/cheese retain their note values.
function mergeTupletNoteRests(notes) {
  if (notes.some((note) => !Number.isFinite(noteBeats(note)) || noteBeats(note) <= 0)) {
    return notes.map((note) => ({ ...note }));
  }
  const merged = [];
  for (let index = 0; index < notes.length;) {
    const note = notes[index];
    if (note.notes?.length && /[dc]/.test(note.ornaments || "")) {
      merged.push({ ...note });
      index += 1;
      continue;
    }
    let end = index + 1;
    let remaining = noteBeats(note);
    while (end < notes.length && !notes[end].notes?.length) remaining += noteBeats(notes[end++]);
    let first = true;
    while (remaining > 1e-8) {
      const value = NOTE_VALUES.find((candidate) => candidate.beats <= remaining + 1e-8);
      // Preserve unsupported values (e.g. 64ths) rather than rounding time.
      if (!value) return notes.map((source) => ({ ...source }));
      merged.push(first && note.notes?.length
        ? { ...note, duration: value.duration, dots: value.dots }
        : { notes: [], duration: value.duration, dots: value.dots, velocity: Number(note.velocity || 0.5) });
      remaining -= value.beats;
      first = false;
    }
    index = end;
  }
  return merged;
}

module.exports = { isQuarterNoteTuplet, simplifyQuarterNoteTuplets,
  isOrdinaryNoteTuplet, simplifyOrdinaryNoteTuplets, mergeTupletNoteRests };
