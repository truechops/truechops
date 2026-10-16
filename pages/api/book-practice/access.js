export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(410).json({ error: "Book verification has been removed. Open your book's QR practice page to start practicing." });
}
