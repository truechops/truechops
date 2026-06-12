import fs from "fs/promises";
import path from "path";
import process from "process";
import {
  BOOK_SLUG,
  createDefaultBook,
  normalizeBook,
} from "../../src/components/book-builder/book-data";

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

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const book = await loadBook();
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
