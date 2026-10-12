#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { gzipSync } = require("zlib");
const { BOOK_VOLUMES, getBookVolume } = require("../src/lib/book-volumes");

// Snapshot the actual printed exercises. Regenerating them during deployment
// would change the rhythms used by practice pages and ownership verification.
function packageBookData(volume, projectRoot = path.resolve(__dirname, "..")) {
  const definition = getBookVolume(volume);
  const source = path.join(projectRoot, "data", "book-builder", definition.slug, "book.json");
  const bytes = fs.readFileSync(source);
  const book = JSON.parse(bytes.toString("utf8"));
  const pages = book.sections?.flatMap((section) => section.pages) || book.pages || [];
  if (book.book !== `true-chops-volume-${definition.number}` || !book.edition || !book.contentVersion) {
    throw new Error(`Invalid book identity: ${source}`);
  }
  if (!pages.length || new Set(pages.map((page) => page.pageNumber)).size !== pages.length
    || pages.some((page) => !Number.isInteger(page.pageNumber) || page.pageNumber < 1
      || !page.lines?.length || page.lines.some((line) => !line.score?.measures?.length))) {
    throw new Error(`Every published page must have a unique number and inline exercise scores: ${source}`);
  }
  const destination = path.join(projectRoot, "data", "published-books", definition.slug);
  const archive = gzipSync(bytes, { level: 9 });
  const index = {
    book: book.book,
    edition: book.edition,
    contentVersion: book.contentVersion,
    pages: pages.map(({ pageNumber, title }) => ({ pageNumber, title })),
  };
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(destination, "book.json.gz"), archive);
  fs.writeFileSync(path.join(destination, "qr-index.json"), `${JSON.stringify(index)}\n`);
  return { volume: definition.number, pages: pages.length, bytes: archive.length };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== "--volume")) {
    throw new Error("Usage: npm run book:package -- [--volume <1-6|all>]");
  }
  const volumes = !args.length || args[1] === "all" ? BOOK_VOLUMES : [getBookVolume(args[1])];
  for (const volume of volumes) {
    const result = packageBookData(volume.number);
    console.log(`Packaged Book ${result.volume}: ${result.pages} pages (${result.bytes} compressed bytes)`);
  }
}

module.exports = { packageBookData };
