import fs from "fs/promises";
import path from "path";
import process from "process";
import { Buffer } from "buffer";
import { createHash } from "crypto";
import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import QRCode from "qrcode";
import { JSDOM } from "jsdom";
import {
  BOOK_SLUG,
  BOOK_TITLE,
  DEFAULT_PDF_SETTINGS,
  createBlankLineScore,
  createBookTableOfContents,
  createDefaultBook,
  getLinesPerPage,
  getPagePdfSettings,
  normalizeBook,
  normalizePdfSettings,
} from "../../src/components/book-builder/book-data";
import { getBookPageQrUrl } from "../../src/lib/book-qr";

const BOOK_ROOT = path.join(process.cwd(), "data", "book-builder", BOOK_SLUG);
const MANIFEST_PATH = path.join(BOOK_ROOT, "book.json");
const PDF_CACHE_ROOT = process.env.BOOK_PDF_CACHE_DIR || path.join(process.cwd(), ".next", "cache", "book-builder-pdf");
const SCORE_SVG_CACHE_VERSION = "score-svg-v12";
const PDF_FILE_CACHE_VERSION = "pdf-v16";
const SCORE_SVG_MEMORY_CACHE_LIMIT = Number(process.env.BOOK_PDF_SVG_MEMORY_CACHE_LIMIT || 800);
const PDF_PAGE_WIDTH = 612;
const PDF_PAGE_HEIGHT = 792;
const PDF_MARGIN = 24;
const PDF_FOOTER_HEIGHT = 38;
const CONTINUOUS_SCORE_RENDER_WIDTH = 1100;
const CONTINUOUS_SYSTEM_SPACING = 132;
const CONTINUOUS_MEASURE_GAP = 6;
const CONTINUOUS_MEASURE_START_PADDING = 4;
const CONTINUOUS_MEASURE_END_PADDING = 8;
const MIN_CONTINUATION_SYSTEMS = 3;

// Module-level flag so setupDom re-runs after a hot-reload (globalThis persists
// across hot-reloads but module scope resets, clearing this flag).
let domSetup = false;
let renderCounter = 0;
let vexflowModulePromise = null;
const scoreSvgMemoryCache = new Map();
const scoreSvgInflight = new Map();
const qrSvgMemoryCache = new Map();

function pageDir(pageNumber) {
  return path.join(BOOK_ROOT, "pages", `page-${String(pageNumber).padStart(2, "0")}`);
}

function linePath(pageNumber, lineNumber) {
  return path.join(pageDir(pageNumber), `line-${String(lineNumber).padStart(2, "0")}.json`);
}

async function readJson(filePath) {
  try {
    const contents = await fs.readFile(filePath, "utf8");
    return JSON.parse(contents);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function createManifest(book) {
  const createLineManifest = (line) => ({
    pageNumber: line.pageNumber,
    lineNumber: line.lineNumber,
    sectionId: line.sectionId,
    sectionPageNumber: line.sectionPageNumber,
    title: line.title,
    notes: line.notes,
    tempo: line.tempo,
    exerciseShortForm: line.exerciseShortForm,
    hasScore: Boolean(line.score),
    updatedAt: line.updatedAt,
  });
  const createPageManifest = (page) => ({
    pageNumber: page.pageNumber,
    sectionId: page.sectionId,
    sectionTitle: page.sectionTitle,
    sectionPageNumber: page.sectionPageNumber,
    title: page.title,
    pdfSettings: page.pdfSettings,
    lines: page.lines.map(createLineManifest),
  });

  return {
    book: book.book,
    slug: book.slug,
    title: book.title,
    edition: book.edition,
    contentVersion: book.contentVersion,
    updatedAt: book.updatedAt,
    globalAiRules: book.globalAiRules,
    pdfSettings: book.pdfSettings,
    sections: book.sections.map((section) => ({
      id: section.id,
      title: section.title,
      prompt: section.prompt,
      sampleJson: section.sampleJson,
      subdivisions: section.subdivisions,
      ornaments: section.ornaments,
      tuplets: section.tuplets,
      pageCount: section.pageCount,
      minPlayedNotes: section.minPlayedNotes,
      maxPlayedNotes: section.maxPlayedNotes,
      playEveryNote: section.playEveryNote,
      maxSameHandStickingRun: section.maxSameHandStickingRun,
      requiredSameHandStickingRuns: section.requiredSameHandStickingRuns,
      pdfSettings: section.pdfSettings,
      pages: section.pages.map(createPageManifest),
    })),
    tableOfContents: createBookTableOfContents(book.sections),
    pages: book.pages.map(createPageManifest),
  };
}

async function loadBook() {
  const manifest = (await readJson(MANIFEST_PATH)) || createDefaultBook();
  const hydratePage = async (page, pageIndex) => ({
    ...page,
    pageNumber: page.pageNumber || pageIndex + 1,
    lines: await Promise.all(
      (page.lines || []).map(async (line, lineIndex) => {
        const pageNumber = page.pageNumber || pageIndex + 1;
        const lineNumber = line.lineNumber || lineIndex + 1;
        const lineFile = await readJson(linePath(pageNumber, lineNumber));
        return {
          ...line,
          ...(lineFile || {}),
          pageNumber,
          lineNumber,
        };
      })
    ),
  });

  if (Array.isArray(manifest.sections) && manifest.sections.length) {
    const sections = await Promise.all(
      manifest.sections.map(async (section) => ({
        ...section,
        pages: await Promise.all((section.pages || []).map(hydratePage)),
      }))
    );

    return normalizeBook({
      ...manifest,
      sections,
    });
  }

  const manifestPages = Array.isArray(manifest.pages) && manifest.pages.length
    ? manifest.pages
    : createDefaultBook().pages;
  const pages = await Promise.all(
    manifestPages.map(hydratePage)
  );

  return normalizeBook({
    ...manifest,
    pages,
  });
}

function getStableLineKey(page, line) {
  return [
    line.sectionId || page.sectionId || "",
    line.sectionPageNumber || page.sectionPageNumber || 1,
    line.lineNumber || 1,
  ].join(":");
}

function preserveExistingGeneratedLines(rawBook, existingBook, clearedLines = []) {
  const clearedKeys = new Set((clearedLines || []).map((line) => [
    line.sectionId || "",
    line.sectionPageNumber || 1,
    line.lineNumber || 1,
  ].join(":")));
  const existingLines = new Map();

  for (const page of existingBook.pages || []) {
    for (const line of page.lines || []) {
      existingLines.set(getStableLineKey(page, line), line);
    }
  }

  return {
    ...rawBook,
    sections: (rawBook.sections || []).map((section) => ({
      ...section,
      pages: (section.pages || []).map((page) => ({
        ...page,
        lines: (page.lines || []).map((line) => {
          const key = getStableLineKey(page, line);
          const existingLine = existingLines.get(key);

          if (line.score || !existingLine?.score || clearedKeys.has(key)) {
            return line;
          }

          return {
            ...line,
            title: line.title || existingLine.title,
            notes: line.notes || existingLine.notes,
            tempo: line.tempo || existingLine.tempo,
            score: existingLine.score,
            exerciseShortForm: existingLine.exerciseShortForm,
            updatedAt: existingLine.updatedAt,
          };
        }),
      })),
    })),
  };
}

async function saveBook(rawBook, { clearedLines = [] } = {}) {
  const now = new Date().toISOString();
  const existingBook = await loadBook();
  const mergedBook = preserveExistingGeneratedLines(rawBook, existingBook, clearedLines);
  const book = normalizeBook({
    ...mergedBook,
    updatedAt: now,
  });

  await fs.mkdir(BOOK_ROOT, { recursive: true });

  await Promise.all(
    book.pages.flatMap((page) =>
      page.lines.map(async (line) => {
        await fs.mkdir(pageDir(page.pageNumber), { recursive: true });
        await fs.writeFile(
          linePath(page.pageNumber, line.lineNumber),
          `${JSON.stringify(
            {
              ...line,
              pageNumber: page.pageNumber,
              lineNumber: line.lineNumber,
            },
            null,
            2
          )}\n`
        );
      })
    )
  );

  await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(createManifest(book), null, 2)}\n`);

  return book;
}

function getPdfBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

function getPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getScoreRenderConcurrency() {
  return getPositiveInteger(process.env.BOOK_PDF_RENDER_CONCURRENCY, 16);
}

function createAsyncLimiter(limit) {
  let activeCount = 0;
  const queue = [];

  function runNext() {
    if (activeCount >= limit || queue.length === 0) {
      return;
    }

    const next = queue.shift();
    activeCount += 1;

    Promise.resolve()
      .then(next.task)
      .then(next.resolve, next.reject)
      .finally(() => {
        activeCount -= 1;
        runNext();
      });
  }

  return function limitTask(task) {
    return new Promise((resolve, reject) => {
      queue.push({ task, resolve, reject });
      runNext();
    });
  };
}

function getHash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function getScoreSvgCacheKey(line, pdfSettings) {
  return getHash({
    version: SCORE_SVG_CACHE_VERSION,
    score: line.score || createBlankLineScore(),
    pdfSettings: {
      noteRenderWidth: pdfSettings.noteRenderWidth,
      noteStartPadding: pdfSettings.noteStartPadding,
      noteEndPadding: pdfSettings.noteEndPadding,
    },
  });
}

function getScoreSvgCachePath(cacheKey) {
  return path.join(PDF_CACHE_ROOT, SCORE_SVG_CACHE_VERSION, `${cacheKey}.json`);
}

function rememberScoreSvg(cacheKey, rendered) {
  scoreSvgMemoryCache.set(cacheKey, rendered);

  while (scoreSvgMemoryCache.size > SCORE_SVG_MEMORY_CACHE_LIMIT) {
    const oldestKey = scoreSvgMemoryCache.keys().next().value;
    scoreSvgMemoryCache.delete(oldestKey);
  }
}

async function readScoreSvgCache(cacheKey) {
  if (process.env.BOOK_PDF_DISABLE_CACHE === "1") {
    return null;
  }

  const memoryHit = scoreSvgMemoryCache.get(cacheKey);
  if (memoryHit) {
    return memoryHit;
  }

  try {
    const cached = JSON.parse(await fs.readFile(getScoreSvgCachePath(cacheKey), "utf8"));
    rememberScoreSvg(cacheKey, cached);
    return cached;
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }

    return null;
  }
}

async function writeScoreSvgCache(cacheKey, rendered) {
  rememberScoreSvg(cacheKey, rendered);

  if (process.env.BOOK_PDF_DISABLE_CACHE === "1") {
    return;
  }

  try {
    const cachePath = getScoreSvgCachePath(cacheKey);
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    await fs.writeFile(cachePath, `${JSON.stringify(rendered)}\n`);
  } catch {
    // Cache writes are best-effort; PDF generation should never fail because
    // the local cache directory is unavailable.
  }
}

function getRelevantPdfBookPayload(book, pages) {
  return {
    book: book.book,
    slug: book.slug,
    title: book.title,
    edition: book.edition,
    contentVersion: book.contentVersion,
    pdfSettings: book.pdfSettings,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://truechops.com",
    sections: book.sections.map((section) => ({
      id: section.id,
      title: section.title,
      prompt: section.prompt,
      sampleJson: section.sampleJson,
      subdivisions: section.subdivisions,
      ornaments: section.ornaments,
      tuplets: section.tuplets,
      minPlayedNotes: section.minPlayedNotes,
      maxPlayedNotes: section.maxPlayedNotes,
      playEveryNote: section.playEveryNote,
      maxSameHandStickingRun: section.maxSameHandStickingRun,
      requiredSameHandStickingRuns: section.requiredSameHandStickingRuns,
      pages: section.pages.map((page) => page.pageNumber),
    })),
    tableOfContents: createBookTableOfContents(book.sections),
    pages: pages.map((page) => ({
      pageNumber: page.pageNumber,
      sectionId: page.sectionId,
      sectionPageNumber: page.sectionPageNumber,
      pdfSettings: page.pdfSettings,
      lines: page.lines.map((line) => ({
        lineNumber: line.lineNumber,
        score: line.score,
      })),
    })),
  };
}

function getPdfCacheKey(book, pages, scope) {
  return getHash({
    version: PDF_FILE_CACHE_VERSION,
    scope,
    book: getRelevantPdfBookPayload(book, pages),
  });
}

function getPdfCachePath(cacheKey) {
  return path.join(PDF_CACHE_ROOT, PDF_FILE_CACHE_VERSION, `${cacheKey}.pdf`);
}

async function readPdfCache(cacheKey) {
  if (process.env.BOOK_PDF_DISABLE_CACHE === "1") {
    return null;
  }

  try {
    return await fs.readFile(getPdfCachePath(cacheKey));
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }

    return null;
  }
}

async function writePdfCache(cacheKey, pdf) {
  if (process.env.BOOK_PDF_DISABLE_CACHE === "1") {
    return;
  }

  try {
    const cachePath = getPdfCachePath(cacheKey);
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    await fs.writeFile(cachePath, pdf);
  } catch {
    // Best-effort cache write.
  }
}

function setNoStoreHeaders(res) {
  res.setHeader("Cache-Control", "private, no-store, no-cache, max-age=0, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

function sendPdfResponse(res, pdf, filename, disposition, cacheStatus) {
  setNoStoreHeaders(res);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Length", pdf.length);
  res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);
  res.setHeader("X-Book-PDF-Cache", cacheStatus);
  res.status(200).send(pdf);
}

function getVexflowModule() {
  if (!vexflowModulePromise) {
    vexflowModulePromise = import("../../src/lib/vexflow");
  }

  return vexflowModulePromise;
}

function setupDom() {
  if (domSetup) return;
  domSetup = true;

  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    pretendToBeVisual: true,
  });

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  // globalThis.navigator is a read-only getter in Node.js v21+; use defineProperty
  try {
    Object.defineProperty(globalThis, "navigator", {
      value: dom.window.navigator,
      writable: true,
      configurable: true,
    });
  } catch {
    // already writable or already set — skip
  }
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.SVGElement = dom.window.SVGElement;

  if (!dom.window.SVGElement.prototype.getBBox) {
    dom.window.SVGElement.prototype.getBBox = function getBBox() {
      const text = this.textContent || "";
      const rawFontSize = this.getAttribute("font-size") || "10";
      const fontSize = Number.parseFloat(rawFontSize) || 10;
      return {
        x: 0,
        y: -fontSize,
        width: text.length * fontSize * 0.58,
        height: fontSize,
      };
    };
  }

  // VexFlow may create SVG elements via createElement('svg') which returns HTMLElement
  // in JSDOM (not SVGSVGElement), so we patch Element.prototype to cover both paths.
  if (!dom.window.Element.prototype.createSVGPoint) {
    dom.window.Element.prototype.createSVGPoint = function createSVGPoint() {
      return {
        x: 0,
        y: 0,
        matrixTransform() {
          return { x: this.x, y: this.y };
        },
      };
    };
  }

  if (!dom.window.Element.prototype.getScreenCTM) {
    dom.window.Element.prototype.getScreenCTM = function getScreenCTM() {
      return {
        inverse() {
          return this;
        },
      };
    };
  }
}

async function renderScoreSvgFresh(
  line,
  renderKey
) {
  setupDom();

  const { initialize, drawScore } = await getVexflowModule();
  renderCounter += 1;
  const safeRenderKey = String(renderKey).replace(/[^a-zA-Z0-9_-]/g, "-");
  const id = `book-pdf-slot-${safeRenderKey}-${renderCounter}`;
  const container = globalThis.document.createElement("div");
  container.id = id;
  globalThis.document.body.appendChild(container);

  try {
    const { renderer, context } = initialize(id);
    drawScore(
      renderer,
      context,
      line.score || createBlankLineScore(),
      null,
      () => {},
      {
        width: CONTINUOUS_SCORE_RENDER_WIDTH,
        scale: 1,
        hResize: 1,
        vResize: 1,
        justifyLastRow: false,
        measureNoteStartPadding: CONTINUOUS_MEASURE_START_PADDING,
        measureNoteEndPadding: CONTINUOUS_MEASURE_END_PADDING,
        measureGap: CONTINUOUS_MEASURE_GAP,
        hideTimeSignature: false,
        showMeasureNumbers: true,
        systemSpacing: CONTINUOUS_SYSTEM_SPACING,
      },
      { start: [], end: [] }
    );

    const svg = container.querySelector("svg");
    if (!svg) {
      throw new Error(`Unable to render page ${line.pageNumber}, slot ${line.lineNumber}`);
    }

    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.setAttribute("version", "1.1");

    const rendered = {
      source: svg.outerHTML,
      width: Number.parseFloat(svg.getAttribute("width")),
      height: Number.parseFloat(svg.getAttribute("height")),
    };

    return rendered;
  } finally {
    container.remove();
  }
}

async function renderScoreSvg(line, renderKey, pdfSettings) {
  const cacheKey = getScoreSvgCacheKey(line, pdfSettings);

  if (scoreSvgInflight.has(cacheKey)) {
    return scoreSvgInflight.get(cacheKey);
  }

  const renderPromise = (async () => {
    const cached = await readScoreSvgCache(cacheKey);

    if (cached) {
      return cached;
    }

    const rendered = await renderScoreSvgFresh(line, renderKey);
    writeScoreSvgCache(cacheKey, rendered);
    return rendered;
  })().finally(() => {
    scoreSvgInflight.delete(cacheKey);
  });

  scoreSvgInflight.set(cacheKey, renderPromise);
  return renderPromise;
}

function getPageScoreSlices(svg, width, height) {
  const scale = width / svg.width;
  const systemHeight = CONTINUOUS_SYSTEM_SPACING * scale;
  const totalSystems = Math.max(
    1,
    Math.round(svg.height / CONTINUOUS_SYSTEM_SPACING)
  );
  const maxSystemsPerPage = Math.max(1, Math.floor(height / systemHeight));
  const minimumContinuationSystems = Math.min(
    MIN_CONTINUATION_SYSTEMS,
    maxSystemsPerPage
  );
  const slices = [];
  let systemStart = 0;

  while (systemStart < totalSystems) {
    const remainingSystems = totalSystems - systemStart;
    let systemCount = Math.min(maxSystemsPerPage, remainingSystems);
    const continuationSystems = remainingSystems - systemCount;

    if (
      continuationSystems > 0 &&
      continuationSystems < minimumContinuationSystems
    ) {
      systemCount -= minimumContinuationSystems - continuationSystems;
    }

    slices.push({ systemStart, systemCount });
    systemStart += systemCount;
  }

  return slices;
}

function drawPageScoreSvg(doc, svg, x, y, width, height, slice) {
  const scale = width / svg.width;
  const svgWidth = svg.width * scale;
  const svgHeight = svg.height * scale;
  const sliceTop = slice.systemStart * CONTINUOUS_SYSTEM_SPACING * scale;
  const sliceHeight = slice.systemCount * CONTINUOUS_SYSTEM_SPACING * scale;

  if (sliceHeight > height) {
    throw new Error(
      `Continuous score slice height ${sliceHeight.toFixed(1)} exceeds the page area ${height.toFixed(1)}.`
    );
  }

  doc.save();
  doc.rect(x, y, width, sliceHeight).clip();
  SVGtoPDF(doc, svg.source, x, y - sliceTop, {
    width: svgWidth,
    height: svgHeight,
    assumePt: true,
    preserveAspectRatio: "xMidYMid meet",
    fontCallback(fontFamily, bold) {
      return bold ? "Times-Bold" : "Times-Roman";
    },
    warningCallback() {},
  });
  doc.restore();
}

function createSampleScore(pattern) {
  const timeSig = { num: 4, type: 4 };
  const velocity = 0.5;

  const notesByPattern = {
    "eighth-notes": Array.from({ length: 8 }, () => ({ notes: ["C5"], duration: 8, dots: 0, velocity })),
    "quarter-notes": Array.from({ length: 4 }, () => ({ notes: ["C5"], duration: 4, dots: 0, velocity })),
    "sixteenth-notes": Array.from({ length: 16 }, () => ({ notes: ["C5"], duration: 16, dots: 0, velocity })),
  };

  const notes = notesByPattern[pattern] ?? notesByPattern["eighth-notes"];

  return {
    parts: { snare: { enabled: true } },
    measures: [{ timeSig, parts: [{ instrument: "snare", voices: [{ notes, tuplets: [] }] }] }],
  };
}

async function renderSamplePdf(pattern) {
  const book = await loadBook();
  const pdfSettings = normalizePdfSettings(book.pdfSettings);
  const score = createSampleScore(pattern);
  const linesPerPage = getLinesPerPage(pdfSettings);
  const sampleBook = {
    slug: BOOK_SLUG,
    title: "Sample — " + pattern.replace(/-/g, " "),
    updatedAt: null,
    pdfSettings,
    pages: [{
      pageNumber: 1,
      title: "Sample",
      pdfSettings,
      lines: Array.from({ length: linesPerPage }, (_, i) => ({
        pageNumber: 1,
        lineNumber: i + 1,
        title: pattern.replace(/-/g, " "),
        notes: "",
        tempo: 120,
        score,
      })),
    }],
  };
  return renderPagePdf(normalizeBook(sampleBook), 1);
}

function createBookPdfDocument(book, title) {
  return new PDFDocument({
    autoFirstPage: false,
    margin: 0,
    size: "LETTER",
    info: {
      Title: title,
      Creator: "TrueChops Book Builder",
    },
  });
}

async function getPracticeQrSvg(book, page) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://truechops.com";
  const practiceUrl = getBookPageQrUrl(page.pageNumber, book, siteUrl);
  const cached = qrSvgMemoryCache.get(practiceUrl);

  if (cached) {
    return cached;
  }

  const qrSvg = await QRCode.toString(practiceUrl, { type: "svg", margin: 1 });
  qrSvgMemoryCache.set(practiceUrl, qrSvg);
  return qrSvg;
}

function createContinuousPageScore(pageLines) {
  const scores = pageLines
    .map((line) => line.score)
    .filter((score) => Array.isArray(score?.measures) && score.measures.length > 0);

  if (!scores.length) {
    return createBlankLineScore();
  }

  return {
    ...scores[0],
    measures: scores.flatMap((score) => score.measures),
  };
}

async function renderBookPageAssets(book, page, bookPdfSettings, limitScoreRender) {
  const pdfSettings = getPagePdfSettings(page, bookPdfSettings);
  const linesPerPage = getLinesPerPage(pdfSettings);
  const pageLines = page.lines.slice(0, linesPerPage);

  const pageLine = {
    pageNumber: page.pageNumber,
    lineNumber: 0,
    score: createContinuousPageScore(pageLines),
  };
  const [scoreSvg, qrSvg] = await Promise.all([
    limitScoreRender(() =>
      renderScoreSvg(
        pageLine,
        `${page.pageNumber}-continuous`,
        pdfSettings
      )
    ),
    getPracticeQrSvg(book, page),
  ]);

  return {
    page,
    scoreSvg,
    qrSvg,
  };
}

function drawBookPage(doc, book, pageAssets) {
  const { page, scoreSvg, qrSvg } = pageAssets;
  const pageWidth = PDF_PAGE_WIDTH;
  const pageHeight = PDF_PAGE_HEIGHT;
  const margin = PDF_MARGIN;
  const footerHeight = PDF_FOOTER_HEIGHT;
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2 - footerHeight;
  const slices = getPageScoreSlices(scoreSvg, contentWidth, contentHeight);

  slices.forEach((slice) => {
    doc.addPage();
    doc.font("Times-Bold").fontSize(10).text(String(page.pageNumber), pageWidth - margin - 18, 8, {
      width: 18,
      align: "right",
      lineBreak: false,
    });
    drawPageScoreSvg(
      doc,
      scoreSvg,
      margin,
      margin,
      contentWidth,
      contentHeight,
      slice
    );

    doc.font("Times-Roman").fillColor("#111111").fontSize(9).text("*  R = right stick", margin + 18, pageHeight - margin - 2, {
      lineBreak: false,
    });
    doc.fontSize(9).text("L  = left stick", margin + 26, pageHeight - margin + 10, {
      lineBreak: false,
    });
    const contentBottom = margin + contentHeight;
    const qrSize = 36;
    const qrX = pageWidth - margin - qrSize;
    const qrY = contentBottom + 5;
    SVGtoPDF(doc, qrSvg, qrX, qrY, { width: qrSize, height: qrSize });
  });
}

function drawTableOfContentsPage(doc, book) {
  const entries = Array.isArray(book.tableOfContents) && book.tableOfContents.length
    ? book.tableOfContents
    : createBookTableOfContents(book.sections);
  const margin = 48;
  const pageNumberWidth = 46;
  const contentWidth = PDF_PAGE_WIDTH - margin * 2;
  const titleWidth = contentWidth - pageNumberWidth - 12;
  const rowHeight = Math.min(26, 590 / Math.max(entries.length, 1));
  const rowFontSize = entries.length > 24 ? 9.5 : 11;
  const firstRowY = 142;

  doc.addPage();
  doc.font("Times-Roman").fillColor("#111111").fontSize(24).text(
    book.title || BOOK_TITLE,
    margin,
    48,
    { width: contentWidth, align: "center", lineBreak: false }
  );
  doc.font("Times-Bold").fontSize(18).text(
    "Table of Contents",
    margin,
    91,
    { width: contentWidth, align: "center", lineBreak: false }
  );

  entries.forEach((entry, index) => {
    const y = firstRowY + index * rowHeight;
    const pageLabel = entry.pageStart == null
      ? ""
      : entry.pageEnd && entry.pageEnd !== entry.pageStart
        ? `${entry.pageStart}\u2013${entry.pageEnd}`
        : String(entry.pageStart);
    const label = `${index + 1}. ${entry.title}`;

    doc.font("Times-Roman").fontSize(rowFontSize).fillColor("#111111");
    doc.text(label, margin, y, { width: titleWidth, lineBreak: false, ellipsis: true });
    doc.text(pageLabel, margin + contentWidth - pageNumberWidth, y, {
      width: pageNumberWidth,
      align: "right",
      lineBreak: false,
    });

    const labelWidth = Math.min(doc.widthOfString(label), titleWidth - 8);
    const leaderStart = margin + labelWidth + 7;
    const leaderEnd = margin + contentWidth - pageNumberWidth - 7;

    if (leaderEnd > leaderStart) {
      doc.save().strokeColor("#777777").lineWidth(0.5).dash(1, { space: 2 })
        .moveTo(leaderStart, y + rowFontSize * 0.78)
        .lineTo(leaderEnd, y + rowFontSize * 0.78)
        .stroke().restore();
    }
  });
}

async function renderPagePdfFresh(book, pageNumber) {
  const bookPdfSettings = normalizePdfSettings({
    ...DEFAULT_PDF_SETTINGS,
    ...(book.pdfSettings || {}),
  });
  const page = book.pages.find((candidate) => candidate.pageNumber === pageNumber) || book.pages[0];
  const doc = createBookPdfDocument(book, `${book.title || BOOK_TITLE} Page ${page.pageNumber}`);
  const finished = getPdfBuffer(doc);
  const limitScoreRender = createAsyncLimiter(getScoreRenderConcurrency());
  const pageAssets = await renderBookPageAssets(book, page, bookPdfSettings, limitScoreRender);
  drawBookPage(doc, book, pageAssets);

  doc.end();
  return finished;
}

async function renderPagePdf(book, pageNumber) {
  const page = book.pages.find((candidate) => candidate.pageNumber === pageNumber) || book.pages[0];
  const cacheKey = getPdfCacheKey(book, [page], `page-${page.pageNumber}`);
  const cached = await readPdfCache(cacheKey);

  if (cached) {
    return { pdf: cached, cacheStatus: "HIT" };
  }

  const pdf = await renderPagePdfFresh(book, page.pageNumber);
  await writePdfCache(cacheKey, pdf);
  return { pdf, cacheStatus: "MISS" };
}

async function renderFullBookPdfFresh(book) {
  const bookPdfSettings = normalizePdfSettings({
    ...DEFAULT_PDF_SETTINGS,
    ...(book.pdfSettings || {}),
  });
  const doc = createBookPdfDocument(book, book.title || BOOK_TITLE);
  const finished = getPdfBuffer(doc);
  const limitScoreRender = createAsyncLimiter(getScoreRenderConcurrency());

  // Kick off all pages in parallel; the limiter caps concurrent SVG renders.
  const pageAssetPromises = book.pages.map((page) =>
    renderBookPageAssets(book, page, bookPdfSettings, limitScoreRender)
  );

  drawTableOfContentsPage(doc, book);

  for (const pageAssetsPromise of pageAssetPromises) {
    drawBookPage(doc, book, await pageAssetsPromise);
  }

  doc.end();
  return finished;
}

async function renderFullBookPdf(book) {
  const cacheKey = getPdfCacheKey(book, book.pages, "book");
  const cached = await readPdfCache(cacheKey);

  if (cached) {
    return { pdf: cached, cacheStatus: "HIT" };
  }

  const pdf = await renderFullBookPdfFresh(book);
  await writePdfCache(cacheKey, pdf);
  return { pdf, cacheStatus: "MISS" };
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      if (req.query.format === "pdf" && req.query.sample) {
        const { pdf, cacheStatus } = await renderSamplePdf(req.query.sample);
        sendPdfResponse(
          res,
          pdf,
          `sample-${req.query.sample}.pdf`,
          "inline",
          cacheStatus
        );
        return;
      }

      const book = await loadBook();
      if (req.query.format === "pdf") {
        if (req.query.scope === "book") {
          const { pdf, cacheStatus } = await renderFullBookPdf(book);
          const disposition = req.query.inline === "1" ? "inline" : "attachment";
          sendPdfResponse(res, pdf, `${BOOK_SLUG}.pdf`, disposition, cacheStatus);
          return;
        }

        const pageNumber = Number(req.query.page || 1);
        const { pdf, cacheStatus } = await renderPagePdf(book, pageNumber);

        const disposition = req.query.inline === "1" ? "inline" : "attachment";
        sendPdfResponse(
          res,
          pdf,
          `${BOOK_SLUG}-page-${String(pageNumber).padStart(2, "0")}.pdf`,
          disposition,
          cacheStatus
        );
        return;
      }

      setNoStoreHeaders(res);
      res.status(200).json({
        book: req.query.includeScores === "1" ? book : createManifest(book),
      });
      return;
    }

    if (req.method === "POST") {
      if (req.query.format === "pdf") {
        setNoStoreHeaders(res);
        res.status(404).json({
          error: "POST PDF generation is not available from the web. Run the local generation and PDF scripts instead.",
        });
        return;
      }

      const book = await saveBook(req.body.book, {
        clearedLines: req.body.clearedLines,
      });
      setNoStoreHeaders(res);
      res.status(200).json({ book });
      return;
    }

    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};
