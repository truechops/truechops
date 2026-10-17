const markingOrder = [..."adcfbrl"];

// Compare the written rhythm: meters, note/rest lengths, dots, and tuplets.
// Pitch, tempo, title and creator do not affect a rhythmic match.
export function notationShape(score, includeMarkings = false) {
  return score.measures.map((measure) => [measure.timeSig.num, measure.timeSig.type,
    measure.parts.filter((part) => score.parts?.[part.instrument]?.enabled !== false).map((part) => part.voices.map((voice) => [
      voice.notes.map((note) => [note.duration, note.dots || 0, Boolean(note.notes?.length),
        ...(includeMarkings ? [markingOrder.filter((letter) => (note.ornaments || "").includes(letter))] : [])]),
      (voice.tuplets || []).map((tuplet) => [tuplet.actual, tuplet.normal, tuplet.start, tuplet.end]),
    ])),
  ]);
}

// This projection runs on existing scores as well as new ones; no backfill or
// external search index is needed to search the actual notation.
export function notationProjection(includeMarkings = false) {
  const disabled = { $map: { input: { $filter: { input: { $objectToArray: { $ifNull: ["$score.parts", {}] } }, as: "config", cond: { $eq: ["$$config.v.enabled", false] } } }, as: "config", in: "$$config.k" } };
  return { $map: { input: { $ifNull: ["$score.measures", []] }, as: "measure", in: ["$$measure.timeSig.num", "$$measure.timeSig.type",
    { $map: { input: { $filter: { input: "$$measure.parts", as: "part", cond: { $not: [{ $in: ["$$part.instrument", disabled] }] } } }, as: "part", in:
      { $map: { input: "$$part.voices", as: "voice", in: [
        { $map: { input: "$$voice.notes", as: "note", in: ["$$note.duration", { $ifNull: ["$$note.dots", 0] }, { $gt: [{ $size: { $ifNull: ["$$note.notes", []] } }, 0] },
          ...(includeMarkings ? [{ $filter: { input: markingOrder, as: "letter", cond: { $gte: [{ $indexOfCP: [{ $ifNull: ["$$note.ornaments", ""] }, "$$letter"] }, 0] } } }] : [])] } },
        { $map: { input: { $ifNull: ["$$voice.tuplets", []] }, as: "tuplet", in: ["$$tuplet.actual", "$$tuplet.normal", "$$tuplet.start", "$$tuplet.end"] } },
      ] } },
    } },
  ] } };
}

export function notationMatch(shape) {
  return { $anyElementTrue: [{ $map: {
    input: { $range: [0, { $max: [0, { $add: [{ $subtract: [{ $size: "$notationShape" }, shape.length] }, 1] }] }] }, as: "start",
    in: { $eq: [{ $slice: ["$notationShape", "$$start", shape.length] }, { $literal: shape }] },
  } }] };
}

export async function openNotationSearch(router, score, label = "Your score") {
  sessionStorage.setItem("truechops:notation-search", JSON.stringify({ score, label }));
  await router.push("/discover?notation=1&type=rhythms");
}
