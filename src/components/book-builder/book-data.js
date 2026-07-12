import _ from "lodash";
import { getEmptyMeasure } from "../../helpers/score";
import { DEFAULT_TEMPO } from "../../consts/score";

export const BOOK_KEY = "true-chops";
export const BOOK_SLUG = "snare-drum-book";
export const BOOK_TITLE = "Snare Drum Book";
export const BOOK_EDITION = 1;
export const BOOK_CONTENT_VERSION = 3;
export const DEFAULT_BOOK_SECTIONS = [
  {
    id: "eighth-notes",
    title: "Eighth Notes",
    prompt: "Generate one-measure snare drum examples using eighth notes only. Keep the examples readable, progressive, and focused on note placement without accents.",
    sampleJson: "{\n  \"rhythmFamily\": \"eighth-notes\",\n  \"allowedDurations\": [8],\n  \"accents\": false\n}",
  },
  {
    id: "eighth-notes-accents",
    title: "Eighth Notes with Accents",
    prompt: "Generate one-measure snare drum examples using eighth notes with clear accent patterns. Keep the examples progressive and avoid changing the rhythmic subdivision.",
    sampleJson: "{\n  \"rhythmFamily\": \"eighth-notes\",\n  \"allowedDurations\": [8],\n  \"accents\": true\n}",
  },
];
export const MEASURES_PER_LINE = 1;
export const PDF_COLUMNS = 2;
export const PDF_ROWS = 12;
export const PDF_COLUMN_OPTIONS = [2, 3];
export const LINES_PER_PAGE = PDF_COLUMNS * PDF_ROWS;

export const DEFAULT_PDF_SETTINGS = {
  columns: PDF_COLUMNS,
  rows: PDF_ROWS,
  noteRenderWidth: 420,
  noteStartPadding: 25,
  noteEndPadding: 25,
};

export function normalizeSectionPageCount(value, fallback = 1) {
  const parsed = Number.parseInt(value, 10);
  const normalizedFallback = Number.parseInt(fallback, 10);

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return Number.isInteger(normalizedFallback) && normalizedFallback > 0
    ? normalizedFallback
    : 1;
}

export function normalizePdfSettings(pdfSettings = {}) {
  const columns = PDF_COLUMN_OPTIONS.includes(Number(pdfSettings.columns))
    ? Number(pdfSettings.columns)
    : DEFAULT_PDF_SETTINGS.columns;

  return {
    ...DEFAULT_PDF_SETTINGS,
    ...pdfSettings,
    columns,
    rows: PDF_ROWS,
  };
}

export function getLinesPerPage(pdfSettings) {
  const normalizedSettings = normalizePdfSettings(pdfSettings);
  return normalizedSettings.columns * normalizedSettings.rows;
}

export function getPagePdfSettings(page, bookPdfSettings = DEFAULT_PDF_SETTINGS) {
  return normalizePdfSettings({
    ...bookPdfSettings,
    ...(page?.pdfSettings || {}),
  });
}

export function getPageLinesPerPage(page, bookPdfSettings = DEFAULT_PDF_SETTINGS) {
  return getLinesPerPage(getPagePdfSettings(page, bookPdfSettings));
}

export function createBlankLine(pageNumber, lineNumber) {
  return {
    pageNumber,
    lineNumber,
    title: "",
    notes: "",
    tempo: DEFAULT_TEMPO,
    score: null,
    updatedAt: null,
  };
}

export function createBlankPage(pageNumber, pdfSettings = DEFAULT_PDF_SETTINGS) {
  const normalizedSettings = normalizePdfSettings(pdfSettings);
  const linesPerPage = getLinesPerPage(normalizedSettings);

  return {
    pageNumber,
    title: `Page ${pageNumber}`,
    pdfSettings: normalizedSettings,
    lines: Array.from({ length: linesPerPage }, (_, index) =>
      createBlankLine(pageNumber, index + 1)
    ),
  };
}

function slugify(value) {
  return String(value || "section")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "section";
}

function normalizeSectionSampleJson(value) {
  if (value == null) {
    return "";
  }

  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

export function createBookSection(sectionNumber = 1, overrides = {}, pdfSettings = DEFAULT_PDF_SETTINGS) {
  const template = DEFAULT_BOOK_SECTIONS[sectionNumber - 1] || {};
  const title = overrides.title || template.title || `Section ${sectionNumber}`;
  const normalizedSettings = normalizePdfSettings({
    ...pdfSettings,
    ...(template.pdfSettings || {}),
    ...(overrides.pdfSettings || {}),
  });

  return {
    id: overrides.id || template.id || `${slugify(title)}-${sectionNumber}`,
    title,
    prompt: overrides.prompt ?? template.prompt ?? "",
    sampleJson: normalizeSectionSampleJson(overrides.sampleJson ?? template.sampleJson),
    pageCount: normalizeSectionPageCount(
      overrides.pageCount ?? template.pageCount,
      overrides.pages?.length || template.pages?.length || 1
    ),
    pdfSettings: normalizedSettings,
    pages: overrides.pages || [createBlankPage(1, normalizedSettings)],
  };
}

export function createDefaultBook() {
  return normalizeBook({
    book: BOOK_KEY,
    slug: BOOK_SLUG,
    title: BOOK_TITLE,
    edition: BOOK_EDITION,
    contentVersion: BOOK_CONTENT_VERSION,
    updatedAt: null,
    pdfSettings: normalizePdfSettings(),
    sections: DEFAULT_BOOK_SECTIONS.map((section, index) =>
      createBookSection(index + 1, section, normalizePdfSettings())
    ),
  });
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createBlankLineScore() {
  const timeSig = { num: 4, type: 4 };

  return {
    parts: {
      snare: {
        enabled: true,
      },
    },
    measures: Array.from({ length: MEASURES_PER_LINE }, () =>
      _.cloneDeep(getEmptyMeasure(timeSig, ["snare"]))
    ),
  };
}

export function scoreToBookLine(score) {
  return score && Array.isArray(score.measures)
    ? cloneJson(score)
    : createBlankLineScore();
}

export function normalizeBook(rawBook) {
  if (!rawBook || !Array.isArray(rawBook.pages)) {
    if (!rawBook || !Array.isArray(rawBook.sections)) {
      return createDefaultBook();
    }
  }

  const pdfSettings = normalizePdfSettings(rawBook.pdfSettings);
  const sections = normalizeBookSections(rawBook, pdfSettings);
  const pages = sections.flatMap((section) => section.pages);

  return {
    book: rawBook.book || BOOK_KEY,
    slug: rawBook.slug || BOOK_SLUG,
    title: rawBook.title || BOOK_TITLE,
    edition: Number(rawBook.edition || BOOK_EDITION),
    contentVersion: Number(rawBook.contentVersion || BOOK_CONTENT_VERSION),
    updatedAt: rawBook.updatedAt || null,
    pdfSettings,
    sections,
    pages,
  };
}

function normalizeBookSections(rawBook, pdfSettings) {
  const rawSections = Array.isArray(rawBook.sections) && rawBook.sections.length
    ? rawBook.sections
    : [{
        id: "imported-pages",
        title: "Imported Pages",
        prompt: "",
        sampleJson: "",
        pdfSettings,
        pages: Array.isArray(rawBook.pages) && rawBook.pages.length
          ? rawBook.pages
          : [createBlankPage(1, pdfSettings)],
      }];
  const seenIds = new Set();
  let globalPageNumber = 1;

  return rawSections.map((rawSection, sectionIndex) => {
    const section = createBookSection(sectionIndex + 1, rawSection, pdfSettings);
    let id = section.id || `${slugify(section.title)}-${sectionIndex + 1}`;
    let suffix = 2;

    while (seenIds.has(id)) {
      id = `${section.id}-${suffix}`;
      suffix += 1;
    }

    seenIds.add(id);

    const sectionPdfSettings = normalizePdfSettings({
      ...pdfSettings,
      ...(section.pdfSettings || {}),
    });
    const sectionPages = Array.isArray(section.pages) && section.pages.length
      ? section.pages
      : [createBlankPage(1, sectionPdfSettings)];
    const normalizedPages = renumberPages(sectionPages, sectionPdfSettings);

    return {
      ...section,
      id,
      title: section.title || `Section ${sectionIndex + 1}`,
      prompt: section.prompt || "",
      sampleJson: normalizeSectionSampleJson(section.sampleJson),
      pageCount: normalizeSectionPageCount(section.pageCount, normalizedPages.length),
      pdfSettings: sectionPdfSettings,
      pages: normalizedPages.map((page, sectionPageIndex) => {
        const pageNumber = globalPageNumber;
        globalPageNumber += 1;

        return {
          ...page,
          pageNumber,
          sectionId: id,
          sectionTitle: section.title,
          sectionPageNumber: sectionPageIndex + 1,
          title: page.title || `${section.title} ${sectionPageIndex + 1}`,
          lines: page.lines.map((line, lineIndex) => ({
            ...line,
            pageNumber,
            lineNumber: lineIndex + 1,
            sectionId: id,
            sectionPageNumber: sectionPageIndex + 1,
            tempo: Number(line.tempo || DEFAULT_TEMPO),
            score: line.score ? cloneJson(line.score) : null,
          })),
        };
      }),
    };
  });
}

function isBlankLine(line) {
  return !line || (!line.score && !line.title && !line.notes);
}

export function renumberPages(pages, pdfSettings = DEFAULT_PDF_SETTINGS) {
  const normalizedBookSettings = normalizePdfSettings(pdfSettings);
  const flatLines = pages.flatMap((page) => page.lines || []);
  const pageSettings = pages.map((page) =>
    getPagePdfSettings(page, normalizedBookSettings)
  );
  const minimumLinesPerPage = getLinesPerPage(normalizedBookSettings);

  while (flatLines.length > minimumLinesPerPage && isBlankLine(flatLines[flatLines.length - 1])) {
    flatLines.pop();
  }

  const nextPages = [];
  let nextLineIndex = 0;

  while (nextLineIndex < flatLines.length || nextPages.length === 0) {
    const pageIndex = nextPages.length;
    const pageNumber = pageIndex + 1;
    const pagePdfSettings = pageSettings[pageIndex] || normalizedBookSettings;
    const linesPerPage = getLinesPerPage(pagePdfSettings);
    const pageLines = flatLines.slice(nextLineIndex, nextLineIndex + linesPerPage);

    while (pageLines.length < linesPerPage) {
      pageLines.push(createBlankLine(pageNumber, pageLines.length + 1));
    }

    nextPages.push({
      pageNumber,
      title: `Page ${pageNumber}`,
      pdfSettings: pagePdfSettings,
      lines: pageLines.slice(0, linesPerPage).map((line, lineIndex) => ({
        ...createBlankLine(pageNumber, lineIndex + 1),
        ...line,
        pageNumber,
        lineNumber: lineIndex + 1,
        tempo: Number(line.tempo || DEFAULT_TEMPO),
        score: line.score ? cloneJson(line.score) : null,
      })),
    });

    nextLineIndex += linesPerPage;
  }

  return nextPages;
}
