const { normalizeRhythmPool, getSpanPrimaryRhythms, rhythmOrnamentKey } = require("./book-structure");

// Three through nine attacks per beat, in numerical order.
const SPAN_COMPANION_ORDER = ["3:2:8", "sixteenths", "5:4:16", "6:4:16", "7:4:16", "thirtyseconds", "9:8:32"];

function normalizeSpanRhythmStudy(value) {
  if (!value || !["focused", "combinations"].includes(value.mode)) return null;
  return { mode: value.mode, exerciseOffset: Math.max(0, Math.floor(Number(value.exerciseOffset) || 0)),
    measures: value.measures === 2 ? 2 : 1,
    exerciseCount: Math.max(1, Math.floor(Number(value.exerciseCount) || (value.cyclePrimary ? 66 : 22))),
    ...(value.cyclePrimary ? { cyclePrimary: true } : {}) };
}

function getSpanStudyPhase(section, exerciseIndex) {
  const plan = normalizeSpanRhythmStudy(section.spanRhythmStudy);
  if (!plan) return null;
  const index = Math.min(plan.exerciseCount - 1, exerciseIndex + plan.exerciseOffset);
  const families = plan.cyclePrimary ? getSpanPrimaryRhythms(section.primaryRhythms, section.rhythmSpan).tuplets.length : 1;
  const familyIndex = Math.min(families - 1, Math.floor(index * families / plan.exerciseCount));
  const start = Math.ceil(familyIndex * plan.exerciseCount / families);
  const end = Math.ceil((familyIndex + 1) * plan.exerciseCount / families);
  const progress = (index - start) / Math.max(1, end - start - 1);
  const density = Math.min(2, Math.floor(progress * 3));
  return { familyIndex, progress, density,
    range: plan.cyclePrimary ? [[0.75, 0.9], [0.45, 0.6], [0.15, 0.3]][density]
      : plan.mode === "focused" ? [0.75 - 0.6 * progress, 0.9 - 0.6 * progress] : null,
  };
}

function getSpanStudyPrimaryPool(section, exerciseIndex) {
  const pool = getSpanPrimaryRhythms(section.primaryRhythms, section.rhythmSpan);
  const plan = normalizeSpanRhythmStudy(section.spanRhythmStudy);
  if (!plan?.cyclePrimary || !pool.tuplets.length) return pool;
  return normalizeRhythmPool({ ...pool, subdivisions: [],
    tuplets: [pool.tuplets[getSpanStudyPhase(section, exerciseIndex).familyIndex]],
  });
}

function getSpanStudyCompanionKeys(section, exerciseIndex) {
  const plan = normalizeSpanRhythmStudy(section.spanRhythmStudy);
  if (!plan || plan.mode !== "combinations") return [];
  const primary = getSpanStudyPrimaryPool(section, exerciseIndex);
  const span = primary.tuplets[0];
  if (!span || Math.ceil(span.normal * 4 / span.type) >= 4) return [];
  const pool = normalizeRhythmPool(section.secondaryRhythms);
  const available = new Set([...pool.subdivisions, ...pool.tuplets.filter((tuplet) =>
    tuplet.normal * 4 / tuplet.type <= 4 - Math.ceil(span.normal * 4 / span.type)).map(rhythmOrnamentKey)]);
  const keys = SPAN_COMPANION_ORDER.filter((key) => available.has(key));
  return keys.length ? [keys[(exerciseIndex + plan.exerciseOffset) % keys.length]] : [];
}

function getSpanStudySecondaryPool(section, exerciseIndex) {
  const pool = normalizeRhythmPool(section.secondaryRhythms);
  if (section.spanRhythmStudy?.mode === "focused") {
    const progress = getSpanStudyPhase(section, exerciseIndex).progress;
    return normalizeRhythmPool({ subdivisions: progress < 0.35 ? ["quarters", "eighths"] : ["quarters", "eighths", "sixteenths"] });
  }
  if (section.spanRhythmStudy?.mode !== "combinations") return pool;
  const keys = getSpanStudyCompanionKeys(section, exerciseIndex);
  return normalizeRhythmPool({ ...pool,
    subdivisions: pool.subdivisions.filter((key) => keys.includes(key)),
    tuplets: pool.tuplets.filter((tuplet) => keys.includes(rhythmOrnamentKey(tuplet))),
  });
}

// Keep the working book's span order and ratios. Focused pages repeat their
// featured tuplet, using progressively varied ordinary notes between groups.
function createBookTwoStudies(sections) {
  const planned = [];
  const grouped = new Set();
  for (const source of sections) {
    const spanBeats = source.rhythmSpan.count * 4 / source.rhythmSpan.unit;
    if (!source.groupId.startsWith("combinations-") || spanBeats <= 3) {
      planned.push(source);
      continue;
    }
    if (grouped.has(source.groupId)) continue;
    grouped.add(source.groupId);
    const members = sections.filter((section) => section.groupId === source.groupId);
    const tuplets = members.flatMap((section) => getSpanPrimaryRhythms(section.primaryRhythms, section.rhythmSpan).tuplets);
    planned.push({ ...source, id: `${source.groupId}-ordered`, cyclePrimary: true, studyFamily: undefined,
      title: `${tuplets.map((tuplet) => tuplet.actual).join(", ")} over ${source.title.split(" over ")[1]}`,
      primaryRhythms: normalizeRhythmPool({ tuplets }),
    });
  }
  return planned.map((source) => {
    const combinations = source.groupId.startsWith("combinations-");
    const mode = combinations ? "combinations" : "focused";
    const primary = getSpanPrimaryRhythms(source.primaryRhythms, source.rhythmSpan).tuplets[0];
    const spanBeats = source.rhythmSpan.count * 4 / source.rhythmSpan.unit;
    // Three-note groups written in sixteenths have at most six attack positions
    // even with host-note splits. Two-bar phrases keep their sparse vocabulary
    // fresh without adding unrelated subdivisions or raising the final density.
    const measures = !source.cyclePrimary && primary?.actual === 3 && primary.type === 16 ? 2 : 1;
    const roomy = source.pages.some((page) => page.pdfSettings?.measuresPerLine === 1) ||
      (spanBeats <= 1 && primary?.actual >= 7);
    const settings = { ...source.pdfSettings, measuresPerExercise: measures,
      measuresPerLine: measures === 2 ? 4 : roomy ? 1 : 2 };
    const exercisesPerPage = 11 * settings.measuresPerLine / measures;
    const pageCount = !combinations ? 1 : source.cyclePrimary ? 3 : spanBeats <= 2 ? 2 : 1;
    const primaryRhythms = normalizeRhythmPool({
      subdivisions: source.primaryRhythms.subdivisions, tuplets: source.primaryRhythms.tuplets, ornaments: [],
    }, false);
    const secondaryRhythms = normalizeRhythmPool(combinations ? {
      subdivisions: source.secondaryRhythms.subdivisions, tuplets: source.secondaryRhythms.tuplets, ornaments: [],
    } : { subdivisions: ["quarters", "eighths", "sixteenths"] });
    return {
      id: source.id, groupId: source.groupId, title: source.title, studyFamily: source.studyFamily,
      rhythmSpan: source.rhythmSpan, density: "mixed", primaryRhythms, secondaryRhythms, pdfSettings: settings,
      pages: Array.from({ length: pageCount }, (_, pageIndex) => {
        const range = pageCount === 1 || (pageCount === 3 && pageIndex === 1) ? [0.45, 0.6]
          : pageIndex === 0 ? [0.75, 0.9] : [0.15, 0.3];
        const label = pageCount === 1 || (pageCount === 3 && pageIndex === 1) ? "Medium density"
          : pageIndex === 0 ? "Dense" : "Low density";
        return {
          subsectionId: `${source.id}-rhythms-${pageIndex + 1}`, subsectionPageCount: 1,
          title: `${!combinations || source.cyclePrimary ? "Higher to lower density" : label} - ${combinations ? "combination exercises" : "focused tuplet studies"}${measures === 2 ? " (two-bar phrases)" : ""}`,
          pdfSettings: settings,
          generationSettings: {
            rhythmOnly: true, ornaments: [], prompt: "", sampleJson: "{}",
            spanRhythmStudy: { mode, exerciseOffset: pageIndex * exercisesPerPage, measures,
              exerciseCount: exercisesPerPage * pageCount,
              ...(source.cyclePrimary ? { cyclePrimary: true } : {}) },
            chainPrimaryGroups: source.pages.some((page) => page.generationSettings?.chainPrimaryGroups),
            ...(!source.cyclePrimary ? { playedShareRamp: !combinations
              ? { start: [0.75, 0.9], end: [0.15, 0.3] } : { start: range, end: range } } : {}),
            fillerSubdivisions: ["sixteenths"],
            minPlayedNotes: 0, maxPlayedNotes: 0, playEveryNote: false,
            stickingTail: null, requiredSameHandStickingRuns: [],
          },
          lines: [],
        };
      }),
    };
  });
}

module.exports = { SPAN_COMPANION_ORDER, normalizeSpanRhythmStudy, getSpanStudyPhase, getSpanStudyPrimaryPool, getSpanStudyCompanionKeys,
  getSpanStudySecondaryPool, createBookTwoStudies };
