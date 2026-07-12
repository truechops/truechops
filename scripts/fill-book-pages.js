#!/usr/bin/env node

/**
 * Fills the snare drum book to 200 pages by cycling through the eighth-note
 * source pages (3–7). Safe to re-run — skips pages that already exist.
 */

const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const BOOK_ROOT = path.join(PROJECT_ROOT, "data", "book-builder", "snare-drum-book");
const MANIFEST_PATH = path.join(BOOK_ROOT, "book.json");
const PAGES_DIR = path.join(BOOK_ROOT, "pages");

const TARGET_PAGES = 200;
const SOURCE_START = 3; // first eighth-note page
const SOURCE_END = 7;   // last eighth-note page
const SOURCE_COUNT = SOURCE_END - SOURCE_START + 1;

function pageDirPath(n) {
  return path.join(PAGES_DIR, `page-${String(n).padStart(2, "0")}`);
}

function lineFilePath(pageNumber, lineNumber) {
  return path.join(
    pageDirPath(pageNumber),
    `line-${String(lineNumber).padStart(2, "0")}.json`
  );
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const now = new Date().toISOString();

  const existingCount = manifest.pages.length;
  if (existingCount >= TARGET_PAGES) {
    console.log(`Book already has ${existingCount} pages — nothing to do.`);
    return;
  }

  // Load source pages from the manifest
  const sourceManifestPages = manifest.pages.filter(
    (p) => p.pageNumber >= SOURCE_START && p.pageNumber <= SOURCE_END
  );

  if (sourceManifestPages.length === 0) {
    console.error(`No source pages found (pages ${SOURCE_START}–${SOURCE_END}).`);
    process.exit(1);
  }

  // Load all line JSON files for source pages upfront
  const sourceLines = {};
  for (const page of sourceManifestPages) {
    sourceLines[page.pageNumber] = {};
    for (const line of page.lines) {
      try {
        sourceLines[page.pageNumber][line.lineNumber] = JSON.parse(
          fs.readFileSync(lineFilePath(page.pageNumber, line.lineNumber), "utf8")
        );
      } catch {
        // missing line file — leave undefined, will be skipped
      }
    }
  }

  const pagesToAdd = TARGET_PAGES - existingCount;
  console.log(
    `Pages: ${existingCount} → ${TARGET_PAGES} (+${pagesToAdd}, cycling pages ${SOURCE_START}–${SOURCE_END})`
  );

  for (let i = 0; i < pagesToAdd; i++) {
    const newPageNum = existingCount + 1 + i;
    const srcPageNum = SOURCE_START + ((newPageNum - SOURCE_START) % SOURCE_COUNT);
    const srcPage = sourceManifestPages.find((p) => p.pageNumber === srcPageNum);

    fs.mkdirSync(pageDirPath(newPageNum), { recursive: true });

    // Write individual line files
    for (const srcLine of srcPage.lines) {
      const srcData = sourceLines[srcPageNum][srcLine.lineNumber];
      if (!srcData) continue;
      const newLine = {
        ...srcData,
        pageNumber: newPageNum,
        lineNumber: srcLine.lineNumber,
        title: `Page ${newPageNum}, Line ${srcLine.lineNumber}`,
        updatedAt: now,
      };
      fs.writeFileSync(
        lineFilePath(newPageNum, srcLine.lineNumber),
        `${JSON.stringify(newLine, null, 2)}\n`
      );
    }

    // Add page entry to manifest
    manifest.pages.push({
      pageNumber: newPageNum,
      title: srcPage.title,
      pdfSettings: srcPage.pdfSettings,
      lines: srcPage.lines.map((line) => ({
        pageNumber: newPageNum,
        lineNumber: line.lineNumber,
        title: `Page ${newPageNum}, Line ${line.lineNumber}`,
        notes: line.notes || "",
        tempo: line.tempo,
        hasScore: line.hasScore,
        updatedAt: now,
      })),
    });

    if ((i + 1) % 10 === 0 || i + 1 === pagesToAdd) {
      process.stdout.write(`\r  Created page ${newPageNum} / ${TARGET_PAGES}…`);
    }
  }

  manifest.updatedAt = now;
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\nDone — book now has ${manifest.pages.length} pages.`);
}

main();
