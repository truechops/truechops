import fs from "fs/promises";
import path from "path";
import process from "process";
import { Buffer } from "buffer";
import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import QRCode from "qrcode";
import { JSDOM } from "jsdom";
import {
  BOOK_SLUG,
  BOOK_TITLE,
  DEFAULT_PDF_SETTINGS,
  createBlankLineScore,
  createDefaultBook,
  getLinesPerPage,
  getPagePdfSettings,
  normalizeBook,
  normalizePdfSettings,
} from "../../src/components/book-builder/book-data";

const BOOK_ROOT = path.join(process.cwd(), "data", "book-builder", BOOK_SLUG);
const MANIFEST_PATH = path.join(BOOK_ROOT, "book.json");
const LINE_NUMBER_CENTER_OFFSET = 1.25;

// Module-level flag so setupDom re-runs after a hot-reload (globalThis persists
// across hot-reloads but module scope resets, clearing this flag).
let domSetup = false;

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
  return {
    slug: book.slug,
    title: book.title,
    updatedAt: book.updatedAt,
    pdfSettings: book.pdfSettings,
    pages: book.pages.map((page) => ({
      pageNumber: page.pageNumber,
      title: page.title,
      pdfSettings: page.pdfSettings,
      lines: page.lines.map((line) => ({
        pageNumber: line.pageNumber,
        lineNumber: line.lineNumber,
        title: line.title,
        notes: line.notes,
        tempo: line.tempo,
        hasScore: Boolean(line.score),
        updatedAt: line.updatedAt,
      })),
    })),
  };
}

async function loadBook() {
  const manifest = (await readJson(MANIFEST_PATH)) || createDefaultBook();
  const manifestPages = Array.isArray(manifest.pages) && manifest.pages.length
    ? manifest.pages
    : createDefaultBook().pages;

  const pages = await Promise.all(
    manifestPages.map(async (page, pageIndex) => ({
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
    }))
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

async function renderScoreSvg(line, index, pdfSettings) {
  setupDom();

  const { initialize, drawScore } = await import("../../src/lib/vexflow");
  const id = `book-pdf-slot-${index}`;
  const container = globalThis.document.createElement("div");
  container.id = id;
  globalThis.document.body.appendChild(container);

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
    container.remove();
    throw new Error(`Unable to render page ${line.pageNumber}, slot ${line.lineNumber}`);
  }

  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("version", "1.1");

  const rendered = {
    source: svg.outerHTML,
    width: Number.parseFloat(svg.getAttribute("width")),
    height: Number.parseFloat(svg.getAttribute("height")),
  };

  container.remove();
  return rendered;
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
  const staffCenterInSvg = getMeasureCenterY(svg);
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

  // Clip to the slot so that any SVG overflow above/below is hidden.
  doc.save();
  doc.rect(notationX, y, notationWidth, height).clip();
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
    "eighth-notes": Array.from({ length: 8 }, () => ({ notes: ["c/5"], duration: 8, dots: 0, velocity })),
    "quarter-notes": Array.from({ length: 4 }, () => ({ notes: ["c/5"], duration: 4, dots: 0, velocity })),
    "sixteenth-notes": Array.from({ length: 16 }, () => ({ notes: ["c/5"], duration: 16, dots: 0, velocity })),
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
  return renderPagePdf(sampleBook, 1);
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

async function drawBookPage(doc, book, page, bookPdfSettings) {
  const pdfSettings = getPagePdfSettings(page, bookPdfSettings);
  const linesPerPage = getLinesPerPage(pdfSettings);
  const pageLines = page.lines.slice(0, linesPerPage);
  const svgs = await Promise.all(pageLines.map((line, index) => renderScoreSvg(line, index, pdfSettings)));
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

  const practiceUrl = `https://truechops.com/book/page/${page.pageNumber}`;
  const qrSvg = await QRCode.toString(practiceUrl, { type: "svg", margin: 1 });
  const contentBottom = margin + headerHeight + rowHeight * pdfSettings.rows;
  const qrSize = 36;
  const qrX = pageWidth - margin - qrSize;
  const qrY = contentBottom + 5;
  SVGtoPDF(doc, qrSvg, qrX, qrY, { width: qrSize, height: qrSize });
}

async function renderPagePdf(book, pageNumber) {
  const bookPdfSettings = normalizePdfSettings({
    ...DEFAULT_PDF_SETTINGS,
    ...(book.pdfSettings || {}),
  });
  const page = book.pages.find((candidate) => candidate.pageNumber === pageNumber) || book.pages[0];
  const doc = createBookPdfDocument(book, `${book.title || BOOK_TITLE} Page ${page.pageNumber}`);
  const finished = getPdfBuffer(doc);
  await drawBookPage(doc, book, page, bookPdfSettings);

  doc.end();
  return finished;
}

async function renderFullBookPdf(book) {
  const bookPdfSettings = normalizePdfSettings({
    ...DEFAULT_PDF_SETTINGS,
    ...(book.pdfSettings || {}),
  });
  const doc = createBookPdfDocument(book, book.title || BOOK_TITLE);
  const finished = getPdfBuffer(doc);

  for (const page of book.pages) {
    await drawBookPage(doc, book, page, bookPdfSettings);
  }

  doc.end();
  return finished;
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      if (req.query.format === "pdf" && req.query.sample) {
        const pdf = await renderSamplePdf(req.query.sample);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="sample-${req.query.sample}.pdf"`);
        res.status(200).send(pdf);
        return;
      }

      const book = await loadBook();
      if (req.query.format === "pdf") {
        if (req.query.scope === "book") {
          const pdf = await renderFullBookPdf(book);
          const disposition = req.query.inline === "1" ? "inline" : "attachment";

          res.setHeader("Content-Type", "application/pdf");
          res.setHeader(
            "Content-Disposition",
            `${disposition}; filename="${BOOK_SLUG}.pdf"`
          );
          res.status(200).send(pdf);
          return;
        }

        const pageNumber = Number(req.query.page || 1);
        const pdf = await renderPagePdf(book, pageNumber);

        const disposition = req.query.inline === "1" ? "inline" : "attachment";
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `${disposition}; filename="${BOOK_SLUG}-page-${String(pageNumber).padStart(2, "0")}.pdf"`
        );
        res.status(200).send(pdf);
        return;
      }

      res.status(200).json({ book });
      return;
    }

    if (req.method === "POST") {
      const book = await saveBook(req.body.book);
      res.status(200).json({ book });
      return;
    }

    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
