const { migrateBookStructure, normalizeRhythmPool } = require("./book-structure");
const { SPAN_STUDIES } = require("./book-curriculum");
const { createRhythmProgressionStudies, RHYTHM_DENSITIES } = require("./book-rhythm-progression");

const BOOK_VOLUMES = [
  { number: 1, slug: "snare-drum-book-1-rhythms", title: "Book 1 - Rhythmic Variations", scope: "basic", ornaments: false },
  { number: 2, slug: "snare-drum-book-2-tuplets", title: "Book 2 - Tuplet Variations", scope: "spans", ornaments: false },
  { number: 3, slug: "snare-drum-book-3-complete", title: "Book 3 - Complete Rhythmic Studies", scope: "complete", ornaments: false },
  { number: 4, slug: "snare-drum-book-4-rhythms-ornamented", title: "Book 4 - Rhythmic Variations with Ornaments", scope: "basic", ornaments: true },
  { number: 5, slug: "snare-drum-book-5-tuplets-ornamented", title: "Book 5 - Tuplet Variations with Ornaments", scope: "spans", ornaments: true },
  { number: 6, slug: "snare-drum-book-6-original", title: "Book 6 - Snare Drum Book", scope: "original", ornaments: true },
];

function getBookVolume(value) {
  const volume = BOOK_VOLUMES.find((candidate) => String(candidate.number) === String(value) || candidate.slug === value);
  if (!volume) throw new Error(`Unknown book volume: ${value}. Choose 1 through 6.`);
  return volume;
}

const clone = (value) => JSON.parse(JSON.stringify(value));
const spanIds = new Set(SPAN_STUDIES.map((study) => study.groupId));
const counts = { quarters: 1, eighths: 2, sixteenths: 4, thirtyseconds: 8 };

function basicCount(section) {
  if (section.groupId !== "one-quarter") return null;
  const pool = normalizeRhythmPool(section.primaryRhythms, false);
  if (pool.subdivisions.length + pool.tuplets.length !== 1) return null;
  const tuplet = pool.tuplets[0];
  return tuplet ? (tuplet.normal * 4 / tuplet.type === 1 ? tuplet.actual : null) : counts[pool.subdivisions[0]];
}

function stripPool(pool) {
  if (!pool) return pool;
  return { ...pool, ornaments: [], rhythmOrnaments: Object.fromEntries(Object.keys(pool.rhythmOrnaments || {}).map((key) => [key, []])) };
}

// Rhythm-only pages contain no stickings or ornaments, including per-rhythm,
// per-exercise, nested, and tail settings.
function withoutOrnaments(settings) {
  const result = { ...settings, rhythmOnly: true, ornaments: [], sampleJson: "{}", prompt: "",
    stickingTail: null, requiredSameHandStickingRuns: [] };
  delete result.randomOrnaments;
  delete result.ornamentSegments;
  delete result.ornamentDensity;
  delete result.spreadPrimaryOrnaments;
  if (result.primaryRhythms) result.primaryRhythms = stripPool(result.primaryRhythms);
  if (result.secondaryRhythms) result.secondaryRhythms = stripPool(result.secondaryRhythms);
  if (result.primaryRhythmOrnaments) {
    result.primaryRhythmOrnaments = Object.fromEntries(Object.keys(result.primaryRhythmOrnaments).map((key) => [key, []]));
  }
  if (result.playEveryNote) {
    result.playEveryNote = false;
    result.fullPrimaryGroupShare = 0.75;
    result.playedShareRamp = { start: [0.75, 0.9], end: [0.75, 0.9] };
  }
  if (result.exerciseSteps) {
    result.exerciseSteps = result.exerciseSteps.map((step, index) => {
      const plain = withoutOrnaments(step);
      const density = RHYTHM_DENSITIES[index % RHYTHM_DENSITIES.length];
      plain.playEveryNote = false;
      plain.fullPrimaryGroupShare = 0;
      plain.playedShare = density.range;
      plain.title = `${density.title} rhythmic variations`;
      return plain;
    });
  }
  return result;
}

// Two additional 22-exercise passes for every span grouping. The source layout
// determines whether a pass occupies one or two pages. The growing secondary
// pool and ornament sequence restart for each pass.
function expandSpanPages(section) {
  const template = section.pages.find((page) => !page.generationSettings?.playEveryNote) || section.pages[0];
  const templates = section.pages.filter((page) => page.subsectionId === template.subsectionId);
  const passes = [
    { id: "rest-permutations", title: "Rest permutations", start: [0.75, 0.9], end: [0.4, 0.6], share: 0.25 },
    { id: "density-permutations", title: "Density and placement permutations", start: [0.4, 0.6], end: [0.8, 0.95], share: 0.75 },
  ];
  return [...section.pages, ...passes.flatMap((pass) => templates.map((page) => ({
    ...page,
    subsectionId: `${section.id}-${pass.id}`,
    title: pass.title,
    generationSettings: {
      ...page.generationSettings,
      playEveryNote: false,
      minPlayedNotes: 0,
      maxPlayedNotes: 0,
      fullPrimaryGroupShare: pass.share,
      playedShareRamp: { start: pass.start, end: pass.end },
    },
    lines: [],
  })))];
}

function createBookVolume(source, value) {
  const volume = getBookVolume(value);
  const book = migrateBookStructure(clone(source));
  let sections = book.sections.filter((section) => {
    if (volume.scope === "basic") return basicCount(section) != null || section.groupId === "combinations-one-quarter";
    if (volume.scope === "spans") return spanIds.has(section.groupId) || spanIds.has(section.groupId.replace(/^combinations-/, ""));
    return true;
  });

  // Foundations proceed through the subdivision pyramid, then combinations.
  // Book 6 retains the exact saved curriculum and its order.
  if (volume.scope !== "original") {
    const basics = sections.filter((section) => basicCount(section) != null)
      .sort((a, b) => basicCount(a) - basicCount(b) || Number(a.density === "sparse") - Number(b.density === "sparse"));
    sections = [...basics, ...sections.filter((section) => basicCount(section) == null)];
  }

  sections = sections.map((section) => {
    if (volume.scope === "spans" && spanIds.has(section.groupId)) section.pages = expandSpanPages(section);
    if (!volume.ornaments) {
      section = {
        ...section,
        ...withoutOrnaments(section),
        pages: section.pages.map((page) => ({
          ...page,
          title: page.title === "Every note" ? "Dense rhythmic variations" : page.title,
          generationSettings: withoutOrnaments(page.generationSettings || {}),
        })),
      };
    }
    return { ...section, pages: section.pages.map((page) => ({ ...page, lines: [] })) };
  });
  if (!volume.ornaments && volume.scope !== "spans") {
    sections = [
      ...createRhythmProgressionStudies(book.pdfSettings),
      ...sections.filter((section) => basicCount(section) == null && section.groupId !== "combinations-one-quarter"),
    ];
  }
  const usedGroups = new Set(sections.map((section) => section.groupId));
  return {
    ...book,
    book: `${book.book || "true-chops"}-volume-${volume.number}`,
    slug: volume.slug,
    title: volume.title,
    groups: book.groups.filter((group) => usedGroups.has(group.id)).map((group) => ({
      ...group,
      title: !volume.ornaments ? group.title.replace(/ and ornaments/gi, "") : group.title,
    })),
    sections,
    pages: sections.flatMap((section) => section.pages),
  };
}

module.exports = { BOOK_VOLUMES, getBookVolume, createBookVolume };
