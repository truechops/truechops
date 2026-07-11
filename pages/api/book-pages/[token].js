import { loadBook } from "../../../src/lib/book-builder-storage";
import { findBookQrPage } from "../../../src/lib/book-qr";

function setNoStoreHeaders(res) {
  res.setHeader("Cache-Control", "private, no-store, no-cache, max-age=0, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

function parseActiveTokens(req) {
  const headerValue = req.headers["x-practice-set-tokens"];
  const queryValue = req.query.activeTokens;
  const rawValue = Array.isArray(headerValue)
    ? headerValue.join(",")
    : headerValue || (Array.isArray(queryValue) ? queryValue.join(",") : queryValue) || "";

  return [...new Set(
    String(rawValue)
      .split(",")
      .map((token) => token.trim())
      .filter(Boolean)
  )];
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
    const activeTokens = parseActiveTokens(req);

    if (!token) {
      res.status(400).json({ error: "Missing page token." });
      return;
    }

    if (activeTokens.length > 3 || !activeTokens.includes(token)) {
      res.status(403).json({
        error: "That page is not in this device's Practice Set.",
      });
      return;
    }

    const book = await loadBook();
    const resolved = findBookQrPage(book, token);

    if (!resolved) {
      res.status(404).json({ error: "Page not found." });
      return;
    }

    const knownActiveTokens = activeTokens.filter((activeToken) =>
      Boolean(findBookQrPage(book, activeToken))
    );

    if (knownActiveTokens.length > 3 || !knownActiveTokens.includes(token)) {
      res.status(403).json({
        error: "That page is not in this device's Practice Set.",
      });
      return;
    }

    res.status(200).json({
      pageRef: resolved.pageRef,
      page: resolved.page,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
