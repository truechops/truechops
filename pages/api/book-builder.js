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
  createBlankPage,
  createDefaultBook,
  getLinesPerPage,
  getPagePdfSettings,
  normalizeBook,
  normalizePdfSettings,
} from "../../src/components/book-builder/book-data";
import { getBookPageQrUrl } from "../../src/lib/book-qr";

const BOOK_ROOT = path.join(process.cwd(), "data", "book-builder", BOOK_SLUG);
const MANIFEST_PATH = path.join(BOOK_ROOT, "book.json");
const LINE_NUMBER_CENTER_OFFSET = 1.25;
const PDF_CACHE_ROOT = process.env.BOOK_PDF_CACHE_DIR || path.join(process.cwd(), ".next", "cache", "book-builder-pdf");
const SCORE_SVG_CACHE_VERSION = "score-svg-v1";
const PDF_FILE_CACHE_VERSION = "pdf-v2";
const SCORE_SVG_MEMORY_CACHE_LIMIT = Number(process.env.BOOK_PDF_SVG_MEMORY_CACHE_LIMIT || 800);
const DEFAULT_AI_LINE_BATCH_SIZE = 12;
const DEFAULT_AI_REQUEST_TIMEOUT_MS = 180000;
const NUMBER_WORDS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

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
    pdfSettings: book.pdfSettings,
    sections: book.sections.map((section) => ({
      id: section.id,
      title: section.title,
      prompt: section.prompt,
      sampleJson: section.sampleJson,
      pdfSettings: section.pdfSettings,
      pages: section.pages.map(createPageManifest),
    })),
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

async function saveBook(rawBook) {
  const now = new Date().toISOString();
  const book = normalizeBook({
    ...rawBook,
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

function getAiLineBatchSize() {
  return getPositiveInteger(process.env.BOOK_AI_LINE_BATCH_SIZE, DEFAULT_AI_LINE_BATCH_SIZE);
}

function getAiRequestTimeoutMs() {
  return getPositiveInteger(process.env.BOOK_AI_REQUEST_TIMEOUT_MS, DEFAULT_AI_REQUEST_TIMEOUT_MS);
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

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
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
      pages: section.pages.map((page) => page.pageNumber),
    })),
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

async function renderScoreSvgFresh(line, renderKey, pdfSettings) {
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
        width: pdfSettings.noteRenderWidth,
        scale: 1,
        hResize: 1,
        vResize: 1,
        justifyLastRow: true,
        measureNoteStartPadding: pdfSettings.noteStartPadding,
        measureNoteEndPadding: pdfSettings.noteEndPadding,
        hideTimeSignature: true,
        maxMeasureWidth: pdfSettings.noteRenderWidth,
      },
      { start: 0, end: 0 }
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

    rendered.staffCenterY = getMeasureCenterY(rendered);
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

    const rendered = await renderScoreSvgFresh(line, renderKey, pdfSettings);
    writeScoreSvgCache(cacheKey, rendered);
    return rendered;
  })().finally(() => {
    scoreSvgInflight.delete(cacheKey);
  });

  scoreSvgInflight.set(cacheKey, renderPromise);
  return renderPromise;
}

function drawSlotSvg(doc, line, svg, x, y, width, height) {
  const numberWidth = 18;
  const notationX = x + numberWidth + 2;
  const notationWidth = width - numberWidth - 2;

  // Always scale to fill the full column width so the right side of each
  // measure aligns with the column edge (prevents empty right-margin space).
  const scale = notationWidth / svg.width;
  const svgWidth = notationWidth;
  const svgHeight = svg.height * scale;

  // Center the SVG on the staff midpoint rather than the SVG bounding box,
  // since VexFlow adds significant whitespace above the staff.
  const staffCenterInSvg = svg.staffCenterY ?? getMeasureCenterY(svg);
  const slotCenterY = y + height / 2;
  const svgY = slotCenterY - staffCenterInSvg * scale;
  const measureCenterY = slotCenterY;

  const fontSize = 13;
  const lineNumber = String(line.lineNumber);
  doc
    .font("Times-Roman")
    .fontSize(fontSize)
    .fillColor("#111111");

  const numberHeight = doc.currentLineHeight();

  doc.text(lineNumber, x, measureCenterY - numberHeight / 2 + LINE_NUMBER_CENTER_OFFSET, {
    width: numberWidth,
    align: "right",
    lineBreak: false,
  });

  // Keep the horizontal crop tight, but allow a little vertical bleed so
  // articulations above the staff (especially accents) are not sliced off.
  const verticalBleed = Math.min(18, height * 0.28);
  doc.save();
  doc.rect(notationX, y - verticalBleed, notationWidth, height + verticalBleed * 2).clip();
  SVGtoPDF(doc, svg.source, notationX, svgY, {
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

function getMeasureCenterY(svg) {
  const staffLineYs = [...svg.source.matchAll(/M[\d.]+ ([\d.]+)L[\d.]+ \1/g)]
    .map((match) => Number(match[1]))
    .filter(Number.isFinite)
    .slice(0, 5);

  if (!staffLineYs.length) {
    return svg.height / 2;
  }

  return (Math.min(...staffLineYs) + Math.max(...staffLineYs)) / 2;
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

function parseJsonLoose(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "object") {
    return value;
  }

  const text = String(value)
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(text);
  } catch {
    const objectStart = text.indexOf("{");
    const objectEnd = text.lastIndexOf("}");
    const arrayStart = text.indexOf("[");
    const arrayEnd = text.lastIndexOf("]");
    const hasObject = objectStart >= 0 && objectEnd > objectStart;
    const hasArray = arrayStart >= 0 && arrayEnd > arrayStart;

    if (!hasObject && !hasArray) {
      return null;
    }

    const jsonText = hasArray && (!hasObject || arrayStart < objectStart)
      ? text.slice(arrayStart, arrayEnd + 1)
      : text.slice(objectStart, objectEnd + 1);

    try {
      return JSON.parse(jsonText);
    } catch {
      return null;
    }
  }
}

function getSamplePayload(section) {
  return parseJsonLoose(section.sampleJson) || {};
}

function getSampleScore(samplePayload) {
  if (samplePayload?.score?.measures) {
    return samplePayload.score;
  }

  if (samplePayload?.measures) {
    return samplePayload;
  }

  return createBlankLineScore();
}

function getSampleNotes(samplePayload) {
  const score = getSampleScore(samplePayload);
  const measure = score.measures?.[0];
  const part = measure?.parts?.find((candidate) => candidate.instrument === "snare") || measure?.parts?.[0];
  const voice = part?.voices?.[0];
  return Array.isArray(voice?.notes) ? voice.notes : [];
}

function getSampleTempo(samplePayload) {
  return getPositiveInteger(samplePayload?.tempo, 90);
}

function normalizePitch(value) {
  const pitch = String(value || "C5").replace("/", "").toUpperCase();
  return /^[A-G][0-9]$/.test(pitch) ? pitch : "C5";
}

function getNoteQuarterUnits(note) {
  const duration = Number(note.duration || 4);
  const dotMultiplier = note.dots ? 1.5 : 1;
  return (4 / duration) * dotMultiplier;
}

function getNotesQuarterUnits(notes) {
  return notes.reduce((total, note) => total + getNoteQuarterUnits(note), 0);
}

function normalizeGeneratedNote(note, fallbackNote = {}) {
  const fallbackDuration = [1, 2, 4, 8, 16, 32].includes(Number(fallbackNote.duration))
    ? Number(fallbackNote.duration)
    : 8;
  const duration = [1, 2, 4, 8, 16, 32].includes(Number(note?.duration))
    ? Number(note.duration)
    : fallbackDuration;
  const notes = Array.isArray(note?.notes)
    ? note.notes.map(normalizePitch)
    : Array.isArray(fallbackNote.notes)
      ? fallbackNote.notes.map(normalizePitch)
      : ["C5"];

  return {
    notes,
    duration,
    dots: Number(note?.dots || 0),
    velocity: Number(note?.velocity || fallbackNote.velocity || 0.5),
    ...(note?.ornaments != null || fallbackNote.ornaments != null
      ? { ornaments: String(note?.ornaments ?? fallbackNote.ornaments ?? "") }
      : {}),
  };
}

function normalizeGeneratedScore(value, fallbackScore = createBlankLineScore()) {
  const source = value?.score?.measures ? value.score : value;
  const fallbackMeasure = fallbackScore.measures?.[0] || createBlankLineScore().measures[0];
  const fallbackPart = fallbackMeasure.parts?.find((candidate) => candidate.instrument === "snare") || fallbackMeasure.parts?.[0];
  const fallbackVoice = fallbackPart?.voices?.[0] || { notes: [], tuplets: [] };
  const measure = source?.measures?.[0];
  const part = measure?.parts?.find((candidate) => candidate.instrument === "snare") || measure?.parts?.[0];
  const voice = part?.voices?.[0];
  const rawNotes = Array.isArray(voice?.notes) ? voice.notes : [];

  if (!rawNotes.length) {
    return cloneJson(fallbackScore);
  }

  const notes = rawNotes.map((note, index) =>
    normalizeGeneratedNote(note, fallbackVoice.notes?.[index] || fallbackVoice.notes?.[0])
  );
  const totalUnits = getNotesQuarterUnits(notes);

  if (Math.abs(totalUnits - 4) > 0.001) {
    return cloneJson(fallbackScore);
  }

  return {
    parts: { snare: { enabled: true } },
    measures: [{
      timeSig: {
        num: Number(measure?.timeSig?.num || fallbackMeasure.timeSig?.num || 4),
        type: Number(measure?.timeSig?.type || fallbackMeasure.timeSig?.type || 4),
      },
      parts: [{
        instrument: "snare",
        voices: [{
          notes,
          tuplets: Array.isArray(voice?.tuplets) ? voice.tuplets : [],
        }],
      }],
    }],
  };
}

function extractGeneratedLineInputs(payload) {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload.sections)) {
    return payload.sections.flatMap(extractGeneratedLineInputs);
  }

  if (Array.isArray(payload.pages)) {
    return payload.pages.flatMap((page) =>
      page.lines || page.examples || page.rhythms || []
    );
  }

  return payload.lines || payload.examples || payload.rhythms || payload.exercises || [];
}

function getPromptText(section) {
  return `${section.title || ""}\n${section.prompt || ""}`.toLowerCase();
}

function sampleHasOrnament(sampleNotes, ornament) {
  return sampleNotes.some((note) => String(note?.ornaments || "").includes(ornament));
}

function getSectionPageTarget(section) {
  const prompt = getPromptText(section);
  const maxPages = getPositiveInteger(process.env.BOOK_AI_MAX_SECTION_PAGES, 50);
  const numericMatch = prompt.match(/(\d+)\s+pages?/);
  const wordMatch = prompt.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+pages?\b/
  );
  const requested = numericMatch
    ? Number(numericMatch[1])
    : wordMatch
      ? NUMBER_WORDS[wordMatch[1]]
      : section.pages?.length || 1;

  return Math.max(1, Math.min(requested, maxPages));
}

function createFallbackGeneratedScore(section, samplePayload, lineIndex) {
  const prompt = getPromptText(section);
  const sampleNotes = getSampleNotes(samplePayload);
  const sampleDurations = new Set(sampleNotes.map((note) => Number(note.duration)).filter(Boolean));
  const allowQuarter = prompt.includes("quarter") || sampleDurations.has(4);
  const noAccents = /no\s+accents?/.test(prompt);
  const noFlams = /no\s+flams?/.test(prompt) || /no\s+accents?\s+or\s+flams?/.test(prompt);
  const allowAccents = !noAccents && (
    prompt.includes("accent") ||
    samplePayload.accents === true ||
    sampleHasOrnament(sampleNotes, "a")
  );
  const allowFlams = !noFlams && (
    prompt.includes("flam") ||
    sampleHasOrnament(sampleNotes, "f")
  );
  const allowSticking = prompt.includes("stick") ||
    sampleHasOrnament(sampleNotes, "l") ||
    sampleHasOrnament(sampleNotes, "r");
  const notes = [];
  let noteCount = 0;

  for (let beat = 0; beat < 4; beat += 1) {
    const seed = lineIndex * 7 + beat * 11 + section.id.length;
    const useQuarter = allowQuarter && seed % 5 === 0;
    const quarterRest = allowQuarter && seed % 11 === 0;

    if (useQuarter || quarterRest) {
      const isRest = quarterRest || seed % 13 === 0;
      const ornaments = !isRest && allowAccents && seed % 3 === 0 ? "a" : "";
      notes.push({
        notes: isRest ? [] : ["C5"],
        duration: 4,
        dots: 0,
        velocity: ornaments.includes("a") ? 1 : 0.5,
        ...(ornaments ? { ornaments } : {}),
      });
      noteCount += isRest ? 0 : 1;
      continue;
    }

    for (let subdivision = 0; subdivision < 2; subdivision += 1) {
      const subSeed = seed + subdivision * 5;
      const isRest = subSeed % 7 === 0 || (subSeed % 17 === 0 && notes.length > 0);
      let ornaments = "";

      if (!isRest && allowFlams && subSeed % 6 === 1) {
        ornaments += "f";
      }

      if (!isRest && allowAccents && subSeed % 4 === 0) {
        ornaments += "a";
      }

      if (!isRest && allowSticking) {
        ornaments += noteCount % 2 === 0 ? "r" : "l";
      }

      notes.push({
        notes: isRest ? [] : ["C5"],
        duration: 8,
        dots: 0,
        velocity: ornaments.includes("a") ? 1 : 0.5,
        ...(ornaments ? { ornaments } : {}),
      });
      noteCount += isRest ? 0 : 1;
    }
  }

  return {
    parts: { snare: { enabled: true } },
    measures: [{
      timeSig: { num: 4, type: 4 },
      parts: [{
        instrument: "snare",
        voices: [{ notes, tuplets: [] }],
      }],
    }],
  };
}

function createFallbackGeneratedLine(section, samplePayload, index) {
  return {
    title: `${section.title || "Section"} ${index + 1}`,
    notes: "Generated from section prompt and sample JSON.",
    tempo: getSampleTempo(samplePayload),
    score: createFallbackGeneratedScore(section, samplePayload, index),
  };
}

function normalizeGeneratedLine(input, section, samplePayload, index) {
  const fallbackLine = createFallbackGeneratedLine(section, samplePayload, index);
  const fallbackScore = getSampleScore(samplePayload);
  const scoreSource = input?.score?.measures || input?.measures
    ? (input.score || input)
    : null;

  return {
    title: input?.title || fallbackLine.title,
    notes: input?.notes || "",
    tempo: getPositiveInteger(input?.tempo, fallbackLine.tempo),
    score: scoreSource
      ? normalizeGeneratedScore(scoreSource, fallbackScore)
      : fallbackLine.score,
  };
}

function createAiSectionPrompt(section, samplePayload, count, offset, linesPerPage) {
  return [
    "Generate TrueChops snare drum book content as strict JSON only.",
    `Section title: ${section.title || "Untitled section"}`,
    `Section instructions: ${section.prompt || "Generate readable one-measure snare drum exercises."}`,
    `Return exactly ${count} lines. These begin at section line ${offset + 1}.`,
    `The section has ${linesPerPage} lines per PDF page.`,
    "Each line must contain title, tempo, and score.",
    "Each score must use this shape: { parts: { snare: { enabled: true } }, measures: [{ timeSig: { num: 4, type: 4 }, parts: [{ instrument: \"snare\", voices: [{ notes, tuplets: [] }] }] }] }.",
    "Use note pitches like C5. Use [] for rests. Durations are VexFlow values: 4 for quarter notes, 8 for eighth notes, 16 for sixteenth notes.",
    "Every generated score must be exactly one 4/4 measure.",
    "Return this JSON object and nothing else: { \"lines\": [{ \"title\": \"\", \"tempo\": 90, \"score\": {} }] }.",
    `Sample JSON:\n${JSON.stringify(samplePayload, null, 2)}`,
  ].join("\n\n");
}

async function requestAiGeneratedLines(section, samplePayload, count, offset, linesPerPage) {
  if (process.env.BOOK_AI_DISABLE === "1" || typeof fetch !== "function") {
    return null;
  }

  const endpoint = process.env.BOOK_AI_ENDPOINT || process.env.OLLAMA_ENDPOINT || "http://127.0.0.1:11434/api/generate";
  const model = process.env.BOOK_AI_MODEL || process.env.OLLAMA_MODEL || "llama3.1";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getAiRequestTimeoutMs());

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: createAiSectionPrompt(section, samplePayload, count, offset, linesPerPage),
        stream: false,
        format: "json",
        options: {
          temperature: Number(process.env.BOOK_AI_TEMPERATURE || 0.8),
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`AI request failed with HTTP ${response.status}`);
    }

    const payload = await response.json();
    const resultText = payload.response || payload.message?.content || JSON.stringify(payload);
    return extractGeneratedLineInputs(parseJsonLoose(resultText));
  } finally {
    clearTimeout(timeout);
  }
}

async function generateSectionLines(section, lineCount, sectionIndex) {
  const samplePayload = getSamplePayload(section);
  const pdfSettings = normalizePdfSettings(section.pdfSettings);
  const linesPerPage = getLinesPerPage(pdfSettings);
  const batchSize = getAiLineBatchSize();
  const lines = [];

  for (let offset = 0; offset < lineCount; offset += batchSize) {
    const count = Math.min(batchSize, lineCount - offset);
    let aiLines = null;

    try {
      aiLines = await requestAiGeneratedLines(section, samplePayload, count, offset, linesPerPage);
    } catch {
      aiLines = null;
    }

    for (let batchIndex = 0; batchIndex < count; batchIndex += 1) {
      const index = offset + batchIndex;
      const input = Array.isArray(aiLines) ? aiLines[batchIndex] : null;
      lines.push(normalizeGeneratedLine(input, section, samplePayload, index));
    }
  }

  return lines;
}

function createGeneratedPagesForSection(section, generatedLines, sectionPdfSettings) {
  const pageCount = Math.max(1, Math.ceil(generatedLines.length / getLinesPerPage(sectionPdfSettings)));
  const now = new Date().toISOString();

  return Array.from({ length: pageCount }, (_, pageIndex) => {
    const page = createBlankPage(pageIndex + 1, sectionPdfSettings);
    return {
      ...page,
      title: `${section.title || "Section"} ${pageIndex + 1}`,
      lines: page.lines.map((line, lineIndex) => {
        const generatedLine = generatedLines[pageIndex * page.lines.length + lineIndex];
        return generatedLine
          ? {
              ...line,
              title: generatedLine.title,
              notes: generatedLine.notes || "",
              tempo: generatedLine.tempo,
              score: generatedLine.score,
              updatedAt: now,
            }
          : line;
      }),
    };
  });
}

async function generateAiBook(rawBook) {
  const sourceBook = normalizeBook(rawBook);
  const bookPdfSettings = normalizePdfSettings(sourceBook.pdfSettings);
  const sections = [];

  for (let sectionIndex = 0; sectionIndex < sourceBook.sections.length; sectionIndex += 1) {
    const section = sourceBook.sections[sectionIndex];
    const sectionPdfSettings = normalizePdfSettings({
      ...bookPdfSettings,
      ...(section.pdfSettings || {}),
    });
    const pageTarget = getSectionPageTarget(section);
    const lineTarget = pageTarget * getLinesPerPage(sectionPdfSettings);
    const generatedLines = await generateSectionLines(
      { ...section, pdfSettings: sectionPdfSettings },
      lineTarget,
      sectionIndex
    );

    sections.push({
      ...section,
      pdfSettings: sectionPdfSettings,
      pages: createGeneratedPagesForSection(section, generatedLines, sectionPdfSettings),
    });
  }

  return normalizeBook({
    ...sourceBook,
    sections,
  });
}

async function getAiSourceBookFromRequest(req) {
  const baseBook = await loadBook();

  if (!Array.isArray(req.body?.sections)) {
    return req.body?.book ? normalizeBook(req.body.book) : baseBook;
  }

  const bookOverrides = req.body.book || {};
  const sections = req.body.sections.map((sectionInput, sectionIndex) => {
    const baseSection = baseBook.sections.find((section) => section.id === sectionInput.id) ||
      baseBook.sections[sectionIndex] ||
      {};
    const sectionPdfSettings = normalizePdfSettings({
      ...baseBook.pdfSettings,
      ...(baseSection.pdfSettings || {}),
      ...(sectionInput.pdfSettings || {}),
    });
    const pageCount = getPositiveInteger(
      sectionInput.pageCount,
      baseSection.pages?.length || 1
    );

    return {
      ...baseSection,
      id: sectionInput.id || baseSection.id,
      title: sectionInput.title || baseSection.title,
      prompt: sectionInput.prompt ?? baseSection.prompt ?? "",
      sampleJson: sectionInput.sampleJson ?? baseSection.sampleJson ?? "",
      pdfSettings: sectionPdfSettings,
      pages: Array.from({ length: pageCount }, (_, pageIndex) =>
        createBlankPage(pageIndex + 1, sectionPdfSettings)
      ),
    };
  });

  return normalizeBook({
    ...baseBook,
    ...bookOverrides,
    sections,
  });
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

async function renderBookPageAssets(book, page, bookPdfSettings, limitScoreRender) {
  const pdfSettings = getPagePdfSettings(page, bookPdfSettings);
  const linesPerPage = getLinesPerPage(pdfSettings);
  const pageLines = page.lines.slice(0, linesPerPage);

  const [svgs, qrSvg] = await Promise.all([
    Promise.all(
      pageLines.map((line, index) =>
        limitScoreRender(() =>
          renderScoreSvg(
            line,
            `${page.pageNumber}-${line.lineNumber}-${index}`,
            pdfSettings
          )
        )
      )
    ),
    getPracticeQrSvg(book, page),
  ]);

  return {
    page,
    pdfSettings,
    pageLines,
    svgs,
    qrSvg,
  };
}

function drawBookPage(doc, book, pageAssets) {
  const { page, pdfSettings, pageLines, svgs, qrSvg } = pageAssets;
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 24;
  const headerHeight = 34;
  const footerHeight = 46;
  const columnGap = 20;
  const usableWidth = pageWidth - margin * 2 - columnGap * (pdfSettings.columns - 1);
  const columnWidth = usableWidth / pdfSettings.columns;
  const rowHeight = (pageHeight - margin * 2 - headerHeight - footerHeight) / pdfSettings.rows;

  doc.addPage();
  doc.font("Times-Roman").fillColor("#111111").fontSize(15).text(book.title || BOOK_TITLE, margin, 7, {
    width: pageWidth - margin * 2,
    align: "center",
    lineBreak: false,
  });
  doc.font("Times-Bold").fontSize(10).text(String(page.pageNumber), pageWidth - margin - 18, 8, {
    width: 18,
    align: "right",
    lineBreak: false,
  });
  doc.font("Times-Italic").fontSize(7.5).text("Read downward", margin - 7, margin + 8, {
    width: 80,
    lineBreak: false,
  });

  pageLines.forEach((line, index) => {
    const column = Math.floor(index / pdfSettings.rows);
    const row = index % pdfSettings.rows;
    const x = margin + column * (columnWidth + columnGap);
    const y = margin + headerHeight + row * rowHeight;

    drawSlotSvg(
      doc,
      line,
      svgs[index],
      x,
      y,
      columnWidth,
      rowHeight
    );
  });

  doc.font("Times-Roman").fillColor("#111111").fontSize(9).text("*  R = right stick", margin + 18, pageHeight - margin - 2, {
    lineBreak: false,
  });
  doc.fontSize(9).text("L  = left stick", margin + 26, pageHeight - margin + 10, {
    lineBreak: false,
  });
  doc.fontSize(10).text("Repeat each exercise 20 times.", margin, pageHeight - margin + 9, {
    width: pageWidth - margin * 2,
    align: "center",
    lineBreak: false,
  });

  const contentBottom = margin + headerHeight + rowHeight * pdfSettings.rows;
  const qrSize = 36;
  const qrX = pageWidth - margin - qrSize;
  const qrY = contentBottom + 5;
  SVGtoPDF(doc, qrSvg, qrX, qrY, { width: qrSize, height: qrSize });
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
      if (req.query.format === "pdf" && req.query.scope === "ai-book") {
        const sourceBook = await getAiSourceBookFromRequest(req);
        const generatedBook = await generateAiBook(sourceBook);
        const savedBook = await saveBook(generatedBook);
        const { pdf, cacheStatus } = await renderFullBookPdf(savedBook);
        const disposition = req.query.inline === "1" ? "inline" : "attachment";

        sendPdfResponse(
          res,
          pdf,
          `${BOOK_SLUG}-ai.pdf`,
          disposition,
          cacheStatus
        );
        return;
      }

      const book = await saveBook(req.body.book);
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
