import fs from "fs/promises";
import path from "path";
import process from "process";
import {
  BOOK_SLUG,
  createDefaultBook,
  normalizeBook,
} from "../components/book-builder/book-data";

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
    book: book.book,
    slug: book.slug,
    title: book.title,
    edition: book.edition,
    contentVersion: book.contentVersion,
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

export async function loadBook() {
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

export async function saveBook(rawBook) {
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
