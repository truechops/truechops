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

function simplifyQuarterNoteTuplets(voice) {
  const tuplets = voice.tuplets || [];
  const collapsed = new Set(tuplets.filter((tuplet) => isQuarterNoteTuplet(voice, tuplet)));
  if (!collapsed.size) return voice;
  const starts = new Map([...collapsed].map((tuplet) => [Number(tuplet.start), tuplet]));
  const notes = [];
  const boundaries = [];
  for (let index = 0; index < voice.notes.length;) {
    boundaries[index] = notes.length;
    const tuplet = starts.get(index);
    if (tuplet) {
      notes.push({ ...voice.notes[index], duration: 4, dots: 0 });
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

module.exports = { isQuarterNoteTuplet, simplifyQuarterNoteTuplets };
