// Shared by the browser, API, and local book generator. A subsection is one page.
const BOOK_STRUCTURE_VERSION = 2;
const subdivisionIds = ["eighths", "sixteenths", "thirtyseconds"];
const ornamentIds = ["stickings", "accents", "flams", "diddles", "cheese"];

function normalizeRhythmPool(value = {}, allowEmpty = true) {
  value = value && typeof value === "object" ? value : {};
  const subdivisions = subdivisionIds.filter((id) => (value.subdivisions || []).includes(id));
  const tuplets = (Array.isArray(value.tuplets) ? value.tuplets : value.tuplet ? [value.tuplet] : [])
    .map((tuplet) => ({ actual: Number(tuplet.actual), normal: Number(tuplet.normal), type: Number(tuplet.type) }))
    .filter((tuplet, index, all) =>
      Number.isInteger(tuplet.actual) && tuplet.actual >= 2 && tuplet.actual <= 16 &&
      Number.isInteger(tuplet.normal) && tuplet.normal >= 2 && tuplet.normal <= 16 &&
      [4, 8, 16].includes(tuplet.type) && tuplet.normal <= tuplet.type &&
      all.findIndex((other) => JSON.stringify(other) === JSON.stringify(tuplet)) === index
    );
  if (!allowEmpty && !subdivisions.length && !tuplets.length) subdivisions.push("eighths");
  return { subdivisions, tuplets, ornaments: ornamentIds.filter((id) => (value.ornaments || []).includes(id)) };
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

function migrateBookStructure(book) {
  if (book.structureVersion >= BOOK_STRUCTURE_VERSION) return book;
  if (!Array.isArray(book.sections)) return { ...book, structureVersion: BOOK_STRUCTURE_VERSION };
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
  return { ...book, structureVersion: BOOK_STRUCTURE_VERSION, sections };
}

function createStructureTableOfContents(sections = []) {
  return sections.flatMap((section, sectionIndex) => {
    const pages = section.pages || [];
    const numbers = pages.map((page) => Number(page.pageNumber)).filter((number) => number > 0);
    return [{
      sectionId: section.id,
      sectionNumber: sectionIndex + 1,
      title: section.title || "Untitled section",
      pageStart: numbers.length ? Math.min(...numbers) : null,
      pageEnd: numbers.length ? Math.max(...numbers) : null,
    }, ...pages.map((page) => ({
      sectionId: section.id,
      subsectionId: page.subsectionId,
      title: page.title || "Untitled subsection",
      pageStart: page.pageNumber,
      pageEnd: page.pageNumber,
    }))];
  });
}

module.exports = { BOOK_STRUCTURE_VERSION, normalizeRhythmPool, migrateBookStructure, createStructureTableOfContents };
