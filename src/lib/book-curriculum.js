const { normalizeRhythmPool } = require("./book-structure");

const STUDY_TOPICS = [
  { id: "nothing", title: "Nothing", ornaments: [] },
  { id: "accents", title: "Accents", ornaments: ["accents"] },
  { id: "accents-stickings", title: "Accents with stickings", ornaments: ["accents", "stickings"] },
  { id: "accents-stickings-diddles", title: "Accents with stickings and diddles", ornaments: ["accents", "stickings", "diddles"] },
  { id: "accents-stickings-flams", title: "Accents with stickings and flams", ornaments: ["accents", "stickings", "flams"] },
  { id: "accents-stickings-cheese", title: "Accents with stickings and cheese", ornaments: ["accents", "stickings", "cheese"] },
  { id: "accents-stickings-diddles-flams", title: "Accents with stickings, diddles and flams", ornaments: ["accents", "stickings", "diddles", "flams"] },
  { id: "everything", title: "Everything", ornaments: ["accents", "stickings", "diddles", "flams", "cheese"] },
];

const STUDY_FAMILIES = [
  { id: "sixteenths", title: "16s", subdivisions: ["sixteenths"], notesPerQuarter: 4 },
  { id: "eighth-triplets", title: "Eighth-note triplets", tuplets: [{ actual: 3, normal: 2, type: 8 }], notesPerQuarter: 3 },
  { id: "quintuplets", title: "Quintuplets", tuplets: [{ actual: 5, normal: 4, type: 16 }], notesPerQuarter: 5 },
  { id: "sextuplets", title: "Sextuplets", tuplets: [{ actual: 6, normal: 4, type: 16 }], notesPerQuarter: 6 },
  { id: "septuplets", title: "Septuplets", tuplets: [{ actual: 7, normal: 4, type: 16 }], notesPerQuarter: 7 },
  { id: "thirtyseconds", title: "32nd notes", subdivisions: ["thirtyseconds"], notesPerQuarter: 8 },
  { id: "nine-eight-thirtyseconds", title: "9:8 32nds", tuplets: [{ actual: 9, normal: 8, type: 32 }], notesPerQuarter: 9 },
];

function createStudySections(groupId, pdfSettings, tailUnit = "staffRows") {
  return STUDY_FAMILIES.flatMap((family) => ["sparse", "full"].map((density) => {
    const id = `${groupId}-${family.id}-${density}`;
    const full = density === "full";
    const primaryRhythms = normalizeRhythmPool(family, false);
    const topics = full ? STUDY_TOPICS.slice(1) : STUDY_TOPICS;
    return {
      id, groupId, title: `${family.title} ${density}`,
      studyFamily: family.id, density,
      primaryRhythms,
      secondaryRhythms: normalizeRhythmPool(),
      pdfSettings,
      pages: topics.map((topic) => ({
        subsectionId: `${id}-${topic.id}`,
        title: topic.title,
        pdfSettings,
        generationSettings: {
          prompt: "", sampleJson: "", ornaments: topic.ornaments,
          minPlayedNotes: full ? 0 : Math.ceil(family.notesPerQuarter * 4 * 0.6),
          maxPlayedNotes: full ? 0 : Math.floor(family.notesPerQuarter * 4 * 0.82),
          playEveryNote: full,
          maxSameHandStickingRun: 2,
          requiredSameHandStickingRuns: [],
          stickingTail: full && topic.ornaments.includes("stickings")
            ? { count: 5, unit: tailUnit, maxSameHandStickingRun: 4, requiredSameHandStickingRuns: [3, 4] }
            : null,
        },
        lines: [],
      })),
    };
  }));
}

module.exports = { STUDY_TOPICS, STUDY_FAMILIES, createStudySections };
