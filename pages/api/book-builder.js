import fs from "fs/promises";
import path from "path";
import process from "process";
import { Buffer } from "buffer";
import PDFDocument from "pdfkit";
import {
  BOOK_SLUG,
  BOOK_TITLE,
  LINES_PER_PAGE,
  createBlankLineScore,
  createDefaultBook,
  normalizeBook,
} from "../../src/components/book-builder/book-data";
import { getTCDurationSingle } from "../../src/helpers/score";

const BOOK_ROOT = path.join(process.cwd(), "data", "book-builder", BOOK_SLUG);
const MANIFEST_PATH = path.join(BOOK_ROOT, "book.json");

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
    pages: book.pages.map((page) => ({
      pageNumber: page.pageNumber,
      title: page.title,
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
  const normalizedManifest = normalizeBook(manifest);

  const pages = await Promise.all(
    normalizedManifest.pages.map(async (page) => ({
      ...page,
      lines: await Promise.all(
        page.lines.map(async (line) => {
          const lineFile = await readJson(linePath(page.pageNumber, line.lineNumber));
          return {
            ...line,
            ...(lineFile || {}),
            pageNumber: page.pageNumber,
            lineNumber: line.lineNumber,
          };
        })
      ),
    }))
  );

  return normalizeBook({
    ...normalizedManifest,
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

function drawStaff(doc, x, y, width) {
  const spacing = 4;

  doc.save();
  doc.strokeColor("#111111").lineWidth(0.45);
  for (let index = 0; index < 5; index += 1) {
    const lineY = y + index * spacing;
    doc.moveTo(x, lineY).lineTo(x + width, lineY).stroke();
  }

  [0, width / 2, width].forEach((barX) => {
    doc.moveTo(x + barX, y).lineTo(x + barX, y + spacing * 4).stroke();
  });
  doc.restore();
}

function drawNote(doc, note, x, staffY) {
  const ornaments = note.ornaments || "";
  const noteY = staffY + 8;

  if (!note.notes || note.notes.length === 0) {
    doc.save();
    doc.strokeColor("#222222").lineWidth(0.8);
    doc.moveTo(x - 3, staffY + 7).lineTo(x + 3, staffY + 11).stroke();
    doc.restore();
    return;
  }

  doc.save();
  doc.fillColor("#111111");
  doc.ellipse(x, noteY, 3.4, 2.5).fill();

  if (note.duration >= 8) {
    doc.strokeColor("#111111").lineWidth(0.7);
    doc.moveTo(x + 3.2, noteY).lineTo(x + 3.2, staffY - 10).stroke();
  }

  if (ornaments.includes("a")) {
    doc.fontSize(7).text(">", x - 4, staffY - 16, { width: 12, align: "center" });
  }

  if (ornaments.includes("r") || ornaments.includes("l")) {
    doc
      .fontSize(6)
      .text(ornaments.includes("r") ? "R" : "L", x - 5, staffY + 18, {
        width: 10,
        align: "center",
      });
  }

  if (ornaments.includes("d") || ornaments.includes("b")) {
    doc.strokeColor("#111111").lineWidth(0.7);
    doc.moveTo(x - 5, staffY + 1).lineTo(x + 5, staffY - 3).stroke();
  }

  doc.restore();
}

function drawMeasure(doc, measure, x, y, width) {
  const part = measure.parts && measure.parts[0];
  const voice = part && part.voices && part.voices[0];
  const notes = voice ? voice.notes || [] : [];
  let elapsed = 0;
  const totalDuration = 32;

  notes.forEach((note) => {
    const noteDuration = getTCDurationSingle(note.duration, note.dots);
    if (elapsed >= totalDuration) {
      return;
    }

    const center = x + ((elapsed + Math.min(noteDuration, totalDuration - elapsed) / 2) / totalDuration) * width;
    drawNote(doc, note, center, y);
    elapsed += noteDuration;
  });
}

function drawLine(doc, line, x, y, width, height) {
  const score = line.score || createBlankLineScore();
  const measures = score.measures.slice(0, 2);
  const staffX = x + 64;
  const staffY = y + 28;
  const staffWidth = width - 78;
  const measureWidth = staffWidth / 2;

  doc.save();
  doc.strokeColor("#e4e7e0").lineWidth(0.45);
  doc.moveTo(x, y + height - 3).lineTo(x + width, y + height - 3).stroke();

  doc.fillColor("#111111").fontSize(8).text(String(line.lineNumber).padStart(2, "0"), x, y + 22, {
    width: 24,
    align: "right",
  });
  doc.fontSize(7.5).fillColor("#555f55").text(line.title || "Blank", x + 32, y + 8, {
    width: Math.max(staffX - x - 38, 1),
    lineBreak: false,
    ellipsis: true,
  });

  drawStaff(doc, staffX, staffY, staffWidth);
  measures.forEach((measure, measureIndex) => {
    drawMeasure(doc, measure, staffX + measureIndex * measureWidth, staffY, measureWidth);
  });
  doc.restore();
}

async function renderPagePdf(book, pageNumber) {
  const page = book.pages.find((candidate) => candidate.pageNumber === pageNumber) || book.pages[0];
  const doc = new PDFDocument({
    autoFirstPage: false,
    margin: 0,
    size: "LETTER",
    info: {
      Title: `${BOOK_TITLE} Page ${page.pageNumber}`,
      Creator: "TrueChops Book Builder",
    },
  });
  const finished = getPdfBuffer(doc);
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 42;
  const headerHeight = 44;
  const footerHeight = 22;
  const lineHeight = (pageHeight - margin * 2 - headerHeight - footerHeight) / LINES_PER_PAGE;

  doc.addPage();
  doc.fillColor("#111111").fontSize(18).text(book.title || BOOK_TITLE, margin, margin - 8, {
    lineBreak: false,
  });
  doc.fillColor("#960909").fontSize(9).text(`Page ${page.pageNumber}`, margin, margin + 18, {
    lineBreak: false,
  });

  page.lines.forEach((line, lineIndex) => {
    drawLine(
      doc,
      line,
      margin,
      margin + headerHeight + lineIndex * lineHeight,
      pageWidth - margin * 2,
      lineHeight
    );
  });

  doc.fillColor("#647064").fontSize(8).text(book.title || BOOK_TITLE, margin, pageHeight - margin + 12);
  doc.fillColor("#111111").fontSize(8).text(String(page.pageNumber), pageWidth - margin - 24, pageHeight - margin + 12, {
    width: 24,
    align: "right",
  });

  doc.end();
  return finished;
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const book = await loadBook();
      if (req.query.format === "pdf") {
        const pageNumber = Number(req.query.page || 1);
        const pdf = await renderPagePdf(book, pageNumber);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${BOOK_SLUG}-page-${String(pageNumber).padStart(2, "0")}.pdf"`
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
