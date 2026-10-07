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
      res.status(400).json({ error: "Missing QR token." });
      return;
    }

    // Tokens come from page numbers, so no exercise files are needed.
    const resolved = await findStoredBookQrPage(token);

    if (!resolved) {
      res.status(404).json({ error: "QR code not recognized." });
      return;
    }

    res.status(200).json({ pageRef: resolved.pageRef });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
