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
    const type = [4, 8, 16, 32].find((candidate) => {
      const normal = quarterUnits * candidate / 4;
      return Number.isInteger(normal) && normal <= group.actual && group.actual < normal * 2;
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

// Limits the secondary pool on a page's first printed rows, e.g. triplets and
// sixteenths only before the faster tuplets appear.
function normalizeSecondaryRhythmIntro(value) {
  if (!value || !(Number(value.count) > 0)) return null;
  const { subdivisions, tuplets } = normalizeRhythmPool(value);
  return { count: Math.max(1, Math.min(100, Math.floor(Number(value.count)))), unit: "staffRows", subdivisions, tuplets };
}

function getLineSecondaryRhythms(settings, lineIndex, measuresPerLine) {
  const secondary = normalizeRhythmPool(settings.secondaryRhythms);
  const intro = normalizeSecondaryRhythmIntro(settings.secondaryRhythmIntro);
  if (!intro || lineIndex >= intro.count * measuresPerLine) return secondary;
  const key = (tuplet) => `${tuplet.actual}:${tuplet.normal}:${tuplet.type}`;
  const introTuplets = new Set(intro.tuplets.map(key));
  return {
    ...secondary,
    subdivisions: secondary.subdivisions.filter((id) => intro.subdivisions.includes(id)),
    tuplets: secondary.tuplets.filter((tuplet) => introTuplets.has(key(tuplet))),
  };
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
      [4, 8, 16, 32].includes(tuplet.type) && tuplet.normal <= tuplet.type &&
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
  normalizeOrnamentSegments, getLineOrnamentSegment,
  normalizeSecondaryRhythmIntro, getLineSecondaryRhythms,
  normalizeRhythmPool, rhythmOrnamentKey, migrateBookStructure, createStructureTableOfContents,
};
