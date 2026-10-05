// Shared by the browser, API, and local book generator. A subsection is a run of
// consecutive pages sharing one subsectionId; its first page holds the settings.
const BOOK_STRUCTURE_VERSION = 3;
const DEFAULT_RHYTHM_SPAN = { count: 1, unit: 4 };
const MAX_SUBSECTION_PAGES = 20;

function normalizeSubsectionPageCount(value) {
  return Math.max(1, Math.min(MAX_SUBSECTION_PAGES, Number.parseInt(value, 10) || 1));
}

function groupSubsectionPages(pages = []) {
  const groups = [];
  for (const page of pages) {
    const last = groups[groups.length - 1];
    if (last && page.subsectionId && last[0].subsectionId === page.subsectionId) last.push(page);
    else groups.push([page]);
  }
  return groups;
}

function normalizeRhythmSpan(value = {}) {
  const unit = [1, 2, 4, 8, 16, 32].includes(Number(value?.unit)) ? Number(value.unit) : 4;
  const count = Math.max(1, Math.min(unit, Number.parseInt(value?.count, 10) || 1));
  return { count, unit };
}

function getSpanPrimaryRhythms(primaryRhythms, span) {
  const pool = normalizeRhythmPool(primaryRhythms, false);
  const { count, unit } = normalizeRhythmSpan(span);
  // The original one-quarter families retain their ordinary notation.
  if (count * 4 === unit) return pool;
  const quarterUnits = count * 4 / unit;
  const groups = [
    ...pool.subdivisions.map((id) => {
      const type = { eighths: 8, sixteenths: 16, thirtyseconds: 32 }[id];
      return { actual: type / 4, type };
    }),
    ...pool.tuplets,
  ];
  const tuplets = groups.map((group) => {
    // Standard notation: the note value whose count fits the span is at most the
    // tuplet size and more than half of it (3:2 quarters, 5:4 eighths, 9:8 sixteenths).
    // Fewer notes than the span holds use the shortest value that fits a whole
    // number of times (3:5 eighths over five eighths).
    const type = [2, 4, 8, 16, 32].find((candidate) => {
      const normal = quarterUnits * candidate / 4;
      return Number.isInteger(normal) && normal <= group.actual && group.actual < normal * 2;
    }) || [2, 4, 8, 16, 32].find((candidate) => {
      const normal = quarterUnits * candidate / 4;
      return Number.isInteger(normal) && normal > group.actual && normal <= 16;
    }) || [32, 16, 8, 4].find((candidate) => {
      const normal = quarterUnits * candidate / 4;
      return Number.isInteger(normal) && normal >= 1 && normal <= 16;
    });
    if (!type) throw new Error("This span cannot be represented with the supported note values.");
    return { actual: group.actual, normal: quarterUnits * type / 4, type };
  });
  // A count that matches the span exactly is just plain notes (4 over two quarters = eighths).
  const plainIds = { 8: "eighths", 16: "sixteenths", 32: "thirtyseconds" };
  const plain = tuplets.filter((tuplet) => tuplet.actual === tuplet.normal && plainIds[tuplet.type]);
  return normalizeRhythmPool({
    subdivisions: plain.map((tuplet) => plainIds[tuplet.type]),
    tuplets: tuplets.filter((tuplet) => !plain.includes(tuplet)),
    ornaments: pool.ornaments,
  });
}

function rhythmSpanLabel(span) {
  const { count, unit } = normalizeRhythmSpan(span);
  const label = { 1: "whole", 2: "half", 4: "quarter", 8: "eighth", 16: "sixteenth", 32: "thirty-second" }[unit];
  return `${count} ${label} ${count === 1 ? "note" : "notes"}`;
}

function normalizeBookGroups(groups) {
  const seen = new Set();
  return (Array.isArray(groups) && groups.length ? groups : [{ id: "one-quarter", title: "Over one quarter note" }])
    .map((group, index) => {
      const base = group.id || `span-${index + 1}`;
      let id = base;
      for (let suffix = 2; seen.has(id); suffix += 1) id = `${base}-${suffix}`;
      seen.add(id);
      const rhythmSpan = normalizeRhythmSpan(group.rhythmSpan);
      return { id, title: group.title || `Over ${rhythmSpanLabel(rhythmSpan)}`, rhythmSpan };
    });
}

function normalizeStickingTail(value) {
  if (!value || !(Number(value.count) > 0)) return null;
  const maxSameHandStickingRun = Math.max(1, Math.min(32, Number(value.maxSameHandStickingRun) || 4));
  return {
    count: Math.max(1, Math.min(100, Math.floor(Number(value.count)))),
    unit: "staffRows",
    maxSameHandStickingRun,
    requiredSameHandStickingRuns: [...new Set((value.requiredSameHandStickingRuns || [3, 4])
      .map(Number).filter((run) => Number.isInteger(run) && run > 0 && run <= maxSameHandStickingRun))].sort((a, b) => a - b),
  };
}

function getLineStickingSettings(settings, lineIndex, linesPerPage, measuresPerLine) {
  const tail = normalizeStickingTail(settings.stickingTail);
  if (!tail || !(settings.ornaments || []).includes("stickings")) return settings;
  const start = Math.max(0, linesPerPage - tail.count * measuresPerLine);
  return lineIndex % linesPerPage < start ? settings : {
    ...settings,
    maxSameHandStickingRun: tail.maxSameHandStickingRun,
    requiredSameHandStickingRuns: tail.requiredSameHandStickingRuns,
  };
}
// Lets one page cycle through ornament topics: [{ count: 4, ornaments: ["accents"] }, ...].
function normalizeOrnamentSegments(value) {
  if (!Array.isArray(value)) return null;
  const segments = value
    .map((segment) => ({
      count: Math.max(1, Math.min(100, Number.parseInt(segment?.count, 10) || 1)),
      ...(segment?.title ? { title: String(segment.title) } : {}),
      ornaments: ornamentIds.filter((id) => (segment?.ornaments || []).includes(id)),
    }));
  return segments.length ? segments : null;
}

// The printed row where each secondary rhythm joins the pool, e.g.
// { sixteenths: 1, "5:4:16": 6 }. Rhythms without a row are not used on the page.
function normalizeSecondaryRhythmRows(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const rows = Object.fromEntries(Object.entries(value)
    .map(([key, row]) => [key, Number.parseInt(row, 10)])
    .filter(([, row]) => Number.isInteger(row) && row >= 1 && row <= 100));
  return Object.keys(rows).length ? rows : null;
}

// Phases repeat a row plan in passes, e.g. three pages that each walk through
// the same groupings with a harder set of basic notes:
// [{ title: "Easy", rows: 11, rhythmRows: { sixteenths: 1, ... } }, ...].
function normalizeSecondaryRhythmPhases(value) {
  if (!Array.isArray(value)) return null;
  const phases = value.map((phase) => ({
    ...(phase?.title ? { title: String(phase.title) } : {}),
    rows: Math.max(1, Number.parseInt(phase?.rows, 10) || 1),
    rhythmRows: normalizeSecondaryRhythmRows(phase?.rhythmRows) || {},
  }));
  return phases.length ? phases : null;
}

// The phase a printed row falls in, and the row within that phase.
function getSecondaryRhythmPhase(settings, row) {
  const phases = normalizeSecondaryRhythmPhases(settings?.secondaryRhythmPhases);
  if (!phases) return null;
  let start = 0;
  for (const [index, phase] of phases.entries()) {
    if (row <= start + phase.rows || index === phases.length - 1) return { phase, index, row: row - start };
    start += phase.rows;
  }
  return null;
}

function getLineSecondaryRhythms(settings, lineIndex, measuresPerLine) {
  const secondary = normalizeRhythmPool(settings.secondaryRhythms);
  let row = Math.floor(lineIndex / Math.max(1, measuresPerLine)) + 1;
  let rows = normalizeSecondaryRhythmRows(settings.secondaryRhythmRows);
  const phase = getSecondaryRhythmPhase(settings, row);
  if (phase) {
    rows = phase.phase.rhythmRows;
    row = phase.row;
  }
  // secondaryRhythmExercises: the exercise (1-based, across the subsection)
  // where a rhythm joins, so a pool can grow evenly and mid-row.
  const exerciseJoins = normalizeSecondaryRhythmRows(settings.secondaryRhythmExercises) || {};
  if (!rows && !Object.keys(exerciseJoins).length) return secondary;
  const available = (rhythm) => {
    const key = rhythmOrnamentKey(rhythm);
    if (key in exerciseJoins) return exerciseJoins[key] <= lineIndex + 1;
    return Boolean(rows) && rows[key] <= row;
  };
  return {
    ...secondary,
    subdivisions: secondary.subdivisions.filter(available),
    tuplets: secondary.tuplets.filter(available),
  };
}

// randomOrnaments picks each exercise's ornaments at random, e.g.
// { always: ["stickings"], from: [...ornament ids], min: 1, max: 3 }: every
// `always` ornament plus min-max drawn from `from`, never repeating the previous
// exercise's set. Seeded by `seed`, so regenerating gives the same plan.
function normalizeRandomOrnaments(value) {
  if (!value || !Array.isArray(value.from)) return null;
  const always = ornamentIds.filter((id) => (Array.isArray(value.always) ? value.always : []).includes(id));
  const from = ornamentIds.filter((id) => value.from.includes(id) && !always.includes(id));
  if (!from.length) return null;
  const min = Math.max(1, Math.min(from.length, Number.parseInt(value.min, 10) || 1));
  const max = Math.max(min, Math.min(from.length, Number.parseInt(value.max, 10) || from.length));
  return { ...(always.length ? { always } : {}), from, min, max };
}

function seededRandom(seed) {
  let state = 2166136261;
  for (const char of String(seed)) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function getLineRandomOrnaments(settings, lineIndex, seed) {
  const config = normalizeRandomOrnaments(settings?.randomOrnaments);
  if (!config) return null;
  let previous = "";
  let chosen = [];
  for (let index = 0; index <= lineIndex; index += 1) {
    const random = seededRandom(`${seed}:${index}`);
    do {
      const count = config.min + Math.floor(random() * (config.max - config.min + 1));
      const shuffled = [...config.from].sort(() => random() - 0.5);
      chosen = ornamentIds.filter((id) => (config.always || []).includes(id) || shuffled.slice(0, count).includes(id));
    } while (chosen.join() === previous && config.min < config.from.length);
    previous = chosen.join();
  }
  return chosen;
}

// Nested tuplets: `actual` notes in the time of `hostNotes` notes of a host
// tuplet. Written in the next shorter values when faster (5 in the time of two
// triplet eighths is 5:4 sixteenths), in the host's values when slower.
function getNestedTupletNotation(variant, host) {
  const hostType = Number(host.type);
  let type = hostType;
  if (variant.actual > variant.hostNotes) {
    while (variant.hostNotes * (type / hostType) * 2 <= variant.actual) type *= 2;
  }
  return { actual: variant.actual, normal: variant.hostNotes * (type / hostType), type };
}

// The systematic variants for a host with `actual` notes of value `type`:
// 3, 5, 7, 9, and 11 in the time of two host notes, then for each larger span of
// k host notes (short of the whole group), k - 1 and k + 1 notes, plus 11 in the
// time of eight in nine-note hosts. Only variants written in 32nds or longer.
function getNestedTupletVariants(host) {
  const isPowerOfTwo = (value) => Number.isInteger(value) && value > 0 && (value & (value - 1)) === 0;
  const related = (m, k) => isPowerOfTwo(m / k) || isPowerOfTwo(k / m);
  const candidates = [
    ...[3, 5, 7, 9, 11].map((actual) => ({ actual, hostNotes: 2 })),
    ...Array.from({ length: Math.max(0, host.actual - 3) }, (_, index) => index + 3)
      .flatMap((k) => [k - 1, k + 1].map((actual) => ({ actual, hostNotes: k }))),
    ...(host.actual === 9 ? [{ actual: 11, hostNotes: 8 }] : []),
  ];
  const seen = new Set();
  return candidates.filter((variant) => {
    const key = `${variant.actual}:${variant.hostNotes}`;
    if (seen.has(key) || variant.actual < 2 || variant.hostNotes >= host.actual || related(variant.actual, variant.hostNotes)) return false;
    seen.add(key);
    return getNestedTupletNotation(variant, host).type <= 32;
  });
}

const NOTE_VALUE_NAMES = { 2: "half", 4: "quarter", 8: "eighth", 16: "sixteenth", 32: "thirty-second" };

// "5 over 2 notes (5:4 sixteenths)": how many notes, in the time of how many
// host notes, and how the nested bracket is written.
function nestedTupletLabel(variant, host) {
  const notation = getNestedTupletNotation(variant, host);
  return `${variant.actual} over ${variant.hostNotes} notes (${notation.actual}:${notation.normal} ${NOTE_VALUE_NAMES[notation.type]}s)`;
}

// nestedTupletPlan: [{ actual, hostNotes, count }] in order; each exercise
// nests the variant its position falls in (the last one continues to the end).
function normalizeNestedTupletPlan(value) {
  if (!Array.isArray(value)) return null;
  const plan = value
    .map((variant) => ({
      actual: Number.parseInt(variant?.actual, 10),
      hostNotes: Number.parseInt(variant?.hostNotes, 10),
      count: Math.max(1, Number.parseInt(variant?.count, 10) || 1),
    }))
    .filter((variant) => variant.actual >= 2 && variant.hostNotes >= 1 && variant.actual <= 16);
  return plan.length ? plan : null;
}

function getLineNestedTuplet(settings, lineIndex) {
  const plan = normalizeNestedTupletPlan(settings?.nestedTupletPlan);
  if (!plan) return null;
  let end = 0;
  return plan.find((variant) => (end += variant.count) > lineIndex) || plan[plan.length - 1];
}

// ornamentDensity: a page's ornament frequency as a percentage of the book's
// (100 = the book's own setting), for pages that should be busier or calmer.
function normalizePageOrnamentDensity(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? Math.max(25, Math.min(300, Math.round(number))) : null;
}

// offbeatTupletPlan: [{ offset, count }] in order; each exercise starts its
// primary tuplet `offset` sixteenths after a beat (1 = "e", 2 = "+", 3 = "a"),
// by the run its position falls in (the last one continues to the end).
const OFFBEAT_LABELS = { 1: "e", 2: "+", 3: "a" };

function normalizeOffbeatTupletPlan(value) {
  if (!Array.isArray(value)) return null;
  const plan = value
    .map((run) => ({ offset: Number.parseInt(run?.offset, 10), count: Math.max(1, Number.parseInt(run?.count, 10) || 1) }))
    .filter((run) => OFFBEAT_LABELS[run.offset]);
  return plan.length ? plan : null;
}

function getLineOffbeatTuplet(settings, lineIndex) {
  const plan = normalizeOffbeatTupletPlan(settings?.offbeatTupletPlan);
  if (!plan) return null;
  let end = 0;
  return plan.find((run) => (end += run.count) > lineIndex) || plan[plan.length - 1];
}

// exerciseSteps: steps each run of the page's plan (a nested tuplet, or an
// off-beat start) goes through in order, e.g. every note with stickings, then
// accents, then sparse with accents, then random ornaments. Each step sets the
// exercise's density and ornaments:
// { title, playEveryNote, fullPrimaryGroupShare?, playedShare?: [min, max], ornaments }
// or, instead of ornaments, randomOrnaments.
function normalizeExerciseSteps(value) {
  if (!Array.isArray(value)) return null;
  const steps = value.filter((step) => step && typeof step === "object").map((step) => {
    const random = normalizeRandomOrnaments(step.randomOrnaments);
    const share = Number.parseFloat(step.fullPrimaryGroupShare);
    const playEveryNote = step.playEveryNote === true || step.playEveryNote === "true";
    const playedShare = Array.isArray(step.playedShare)
      ? step.playedShare.map((value) => Math.max(0, Math.min(1, Number.parseFloat(value))))
      : null;
    return {
      title: String(step.title || "").slice(0, 80),
      playEveryNote,
      ...(!playEveryNote && Number.isFinite(share) ? { fullPrimaryGroupShare: Math.max(0, Math.min(1, share)) } : {}),
      ...(!playEveryNote && playedShare?.length === 2 && playedShare.every(Number.isFinite) && playedShare[0] <= playedShare[1]
        ? { playedShare } : {}),
      ornaments: random
        ? ornamentIds.filter((id) => (random.always || []).includes(id) || random.from.includes(id))
        : ornamentIds.filter((id) => (Array.isArray(step.ornaments) ? step.ornaments : []).includes(id)),
      ...(random ? { randomOrnaments: random } : {}),
    };
  });
  return steps.length ? steps : null;
}

// How a run's `count` exercises split over the steps: evenly, with any extra
// exercises going to the later steps.
function getStepCounts(count, stepCount) {
  const base = Math.floor(count / stepCount);
  const extra = count % stepCount;
  return Array.from({ length: stepCount }, (_, index) => base + (index >= stepCount - extra ? 1 : 0));
}

// The runs the steps repeat over: the nested tuplet plan or the off-beat plan.
function getStepRuns(settings) {
  return normalizeNestedTupletPlan(settings?.nestedTupletPlan) || normalizeOffbeatTupletPlan(settings?.offbeatTupletPlan);
}

function getLineExerciseStep(settings, lineIndex) {
  const steps = normalizeExerciseSteps(settings?.exerciseSteps);
  const plan = getStepRuns(settings);
  if (!steps || !plan) return null;
  let start = 0;
  let run = null;
  for (const candidate of plan) {
    if (lineIndex < start + candidate.count) {
      run = candidate;
      break;
    }
    start += candidate.count;
  }
  if (!run) return steps[steps.length - 1];
  let end = 0;
  const counts = getStepCounts(run.count, steps.length);
  return steps[counts.findIndex((count) => (end += count) > lineIndex - start)] || steps[steps.length - 1];
}

function getLineOrnamentSegment(settings, lineIndex) {
  const segments = normalizeOrnamentSegments(settings?.ornamentSegments);
  if (!segments) return null;
  let end = 0;
  return segments.find((segment) => (end += segment.count) > lineIndex) || segments[segments.length - 1];
}

const subdivisionIds = ["eighths", "sixteenths", "thirtyseconds"];
const ornamentIds = ["stickings", "accents", "flams", "diddles", "cheese"];

function normalizeRhythmPool(value = {}, allowEmpty = true) {
  value = value && typeof value === "object" ? value : {};
  const subdivisions = subdivisionIds.filter((id) => (value.subdivisions || []).includes(id));
  const tuplets = (Array.isArray(value.tuplets) ? value.tuplets : value.tuplet ? [value.tuplet] : [])
    .map((tuplet) => ({ actual: Number(tuplet.actual), normal: Number(tuplet.normal), type: Number(tuplet.type) }))
    .filter((tuplet, index, all) =>
      Number.isInteger(tuplet.actual) && tuplet.actual >= 2 && tuplet.actual <= 16 &&
      Number.isInteger(tuplet.normal) && tuplet.normal >= 1 && tuplet.normal <= 16 &&
      [2, 4, 8, 16, 32].includes(tuplet.type) && tuplet.normal <= tuplet.type &&
      all.findIndex((other) => JSON.stringify(other) === JSON.stringify(tuplet)) === index
    );
  if (!allowEmpty && !subdivisions.length && !tuplets.length) subdivisions.push("eighths");
  const pool = { subdivisions, tuplets, ornaments: ornamentIds.filter((id) => (value.ornaments || []).includes(id)) };
  // Optional per-rhythm ornaments, e.g. { sixteenths: ["accents"], "6:4:16": ["flams"] }.
  // Stickings are not listed here: they follow the exercise's topic on every note.
  if (value.rhythmOrnaments && typeof value.rhythmOrnaments === "object") {
    pool.rhythmOrnaments = Object.fromEntries([...subdivisions, ...tuplets].map((rhythm) => {
      const key = rhythmOrnamentKey(rhythm);
      return [key, ornamentIds.filter((id) => id !== "stickings" && (value.rhythmOrnaments[key] || []).includes(id))];
    }));
    pool.ornaments = ornamentIds.filter((id) => Object.values(pool.rhythmOrnaments).some((list) => list.includes(id)));
  }
  return pool;
}

function rhythmOrnamentKey(rhythm) {
  return typeof rhythm === "string" ? rhythm : `${rhythm.actual}:${rhythm.normal}:${rhythm.type}`;
}

function rhythmKey(pool) {
  return JSON.stringify([pool.subdivisions, [...pool.tuplets].sort((a, b) =>
    a.type - b.type || a.actual - b.actual || a.normal - b.normal)]);
}

function rhythmTitle(pool, fallback) {
  if (pool.subdivisions.length === 1 && !pool.tuplets.length) {
    return { eighths: "Eighth Notes", sixteenths: "Sixteenth Notes", thirtyseconds: "Thirty-second Notes" }[pool.subdivisions[0]];
  }
  if (!pool.subdivisions.length && pool.tuplets.length === 1) {
    const { actual, normal, type } = pool.tuplets[0];
    if (actual === 3 && normal === 2 && type === 8) return "Eighth-note Triplets";
    if (actual === 5 && normal === 4 && type === 16) return "Sixteenth-note Quintuplets";
  }
  return fallback;
}

function migrateLegacySections(book) {
  if (book.structureVersion >= 2 || !Array.isArray(book.sections)) return book;
  const sections = [];
  let previousKey = null;
  for (const section of book.sections || []) {
    // Only consolidate adjacent legacy families, preserving printed page order and QR links.
    const pages = section.pages?.length ? section.pages : [{}];
    for (const [pageIndex, page] of pages.entries()) {
      const settings = { ...section, ...page.generationSettings };
      const primaryRhythms = normalizeRhythmPool(section.primaryRhythms || settings, false);
      primaryRhythms.ornaments = [];
      const key = section.primaryRhythms ? section.id : rhythmKey(primaryRhythms);
      let target = sections[sections.length - 1];
      if (!target || key !== previousKey) {
        target = {
          ...section,
          title: section.primaryRhythms ? section.title : rhythmTitle(primaryRhythms, section.title),
          primaryRhythms,
          secondaryRhythms: normalizeRhythmPool(section.secondaryRhythms),
          pages: [],
        };
        sections.push(target);
      }
      previousKey = key;
      target.pages.push({
        ...page,
        subsectionId: page.subsectionId || `${section.id || "section"}-topic-${pageIndex + 1}`,
        title: pages.length === 1 || !page.title || /^Page \d+$/.test(page.title) || page.title === `${section.title} ${pageIndex + 1}`
          ? section.title : page.title,
        generationSettings: Object.fromEntries([
          "prompt", "sampleJson", "subdivisions", "tuplets", "ornaments", "minPlayedNotes",
          "maxPlayedNotes", "playEveryNote", "maxSameHandStickingRun", "requiredSameHandStickingRuns",
        ].filter((field) => settings[field] !== undefined).map((field) => [field, settings[field]])),
      });
      target.pageCount = target.pages.length;
    }
  }
  return { ...book, structureVersion: 2, sections };
}

function migrateBookStructure(book) {
  const legacy = migrateLegacySections(book);
  const groups = normalizeBookGroups(legacy.groups);
  const sections = (legacy.sections || []).map((section) => {
    const group = groups.find((candidate) => candidate.id === section.groupId) || groups[0];
    return { ...section, groupId: group.id, rhythmSpan: group.rhythmSpan };
  });
  return { ...legacy, structureVersion: BOOK_STRUCTURE_VERSION, groups,
    ...(legacy.sections ? { sections: groups.flatMap((group) => sections.filter((section) => section.groupId === group.id)) } : {}),
  };
}

function createStructureTableOfContents(sections = [], groups = []) {
  const entries = sections.flatMap((section, sectionIndex) => {
    const pages = section.pages || [];
    const numbers = pages.map((page) => Number(page.pageNumber)).filter((number) => number > 0);
    return [{
      sectionId: section.id,
      sectionNumber: sectionIndex + 1,
      title: section.title || "Untitled section",
      pageStart: numbers.length ? Math.min(...numbers) : null,
      pageEnd: numbers.length ? Math.max(...numbers) : null,
    }, ...groupSubsectionPages(pages).map((subsectionPages) => ({
      sectionId: section.id,
      subsectionId: subsectionPages[0].subsectionId,
      title: subsectionPages[0].title || "Untitled subsection",
      pageStart: subsectionPages[0].pageNumber,
      pageEnd: subsectionPages[subsectionPages.length - 1].pageNumber,
    }))];
  });
  if (!groups.length) return entries;
  return groups.flatMap((group) => {
    const ids = new Set(sections.filter((section) => section.groupId === group.id).map((section) => section.id));
    const children = entries.filter((entry) => ids.has(entry.sectionId));
    const numbers = children.map((entry) => entry.pageStart).filter((number) => number > 0);
    return children.length ? [{
      groupId: group.id, title: group.title,
      pageStart: Math.min(...numbers), pageEnd: Math.max(...children.map((entry) => entry.pageEnd)),
    }, ...children] : [];
  });
}

module.exports = {
  BOOK_STRUCTURE_VERSION, DEFAULT_RHYTHM_SPAN, normalizeRhythmSpan, rhythmSpanLabel,
  MAX_SUBSECTION_PAGES, normalizeSubsectionPageCount, groupSubsectionPages,
  getSpanPrimaryRhythms,
  normalizeBookGroups, normalizeStickingTail, getLineStickingSettings,
  normalizeOrnamentSegments, getLineOrnamentSegment, normalizeRandomOrnaments, getLineRandomOrnaments,
  getNestedTupletNotation, getNestedTupletVariants, nestedTupletLabel, normalizeNestedTupletPlan, getLineNestedTuplet,
  OFFBEAT_LABELS, normalizeOffbeatTupletPlan, getLineOffbeatTuplet, normalizePageOrnamentDensity,
  normalizeExerciseSteps, getStepCounts, getStepRuns, getLineExerciseStep,
  normalizeSecondaryRhythmRows, normalizeSecondaryRhythmPhases, getSecondaryRhythmPhase, getLineSecondaryRhythms,
  normalizeRhythmPool, rhythmOrnamentKey, migrateBookStructure, createStructureTableOfContents,
};
