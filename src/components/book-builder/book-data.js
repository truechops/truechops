import _ from "lodash";
import { getEmptyMeasure } from "../../helpers/score";
import { DEFAULT_TEMPO } from "../../consts/score";

export const BOOK_KEY = "true-chops";
export const BOOK_SLUG = "snare-drum-book";
export const BOOK_TITLE = "Snare Drum Book";
export const BOOK_EDITION = 1;
export const BOOK_CONTENT_VERSION = 3;
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

export function createDefaultBook() {
  return {
    book: BOOK_KEY,
    slug: BOOK_SLUG,
    title: BOOK_TITLE,
    edition: BOOK_EDITION,
    contentVersion: BOOK_CONTENT_VERSION,
    updatedAt: null,
    pdfSettings: normalizePdfSettings(),
    pages: [createBlankPage(1, normalizePdfSettings())],
  };
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
    return createDefaultBook();
  }

  const pdfSettings = normalizePdfSettings(rawBook.pdfSettings);
  const pages = rawBook.pages.length ? rawBook.pages : [createBlankPage(1, pdfSettings)];

  return {
    book: rawBook.book || BOOK_KEY,
    slug: rawBook.slug || BOOK_SLUG,
    title: rawBook.title || BOOK_TITLE,
    edition: Number(rawBook.edition || BOOK_EDITION),
    contentVersion: Number(rawBook.contentVersion || BOOK_CONTENT_VERSION),
    updatedAt: rawBook.updatedAt || null,
    pdfSettings,
    pages: renumberPages(pages, pdfSettings),
  };
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
