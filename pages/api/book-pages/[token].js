import { findStoredBookQrPage } from "../../../src/lib/book-builder-storage";

function setNoStoreHeaders(res) {
  res.setHeader("Cache-Control", "private, no-store, no-cache, max-age=0, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

export default async function handler(req, res) {
  setNoStoreHeaders(res);

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const token = String(req.query.token || "").trim();
    if (!token) {
      res.status(400).json({ error: "Missing page token." });
      return;
    }

    // Find the page from the manifest, then read only that page's exercises.
    const resolved = await findStoredBookQrPage(token, { includeScores: true });

    if (!resolved) {
      res.status(404).json({ error: "Page not found." });
      return;
    }

    res.status(200).json({
      pageRef: resolved.pageRef,
      bookTitle: resolved.bookTitle,
      page: {
        pageNumber: resolved.page.pageNumber,
        title: resolved.page.title,
        sectionTitle: resolved.page.sectionTitle,
        lines: resolved.page.lines.map(({ lineNumber, score, tempo }) => ({ lineNumber, score, tempo })),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
