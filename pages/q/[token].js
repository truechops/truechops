import { findStoredBookQrPage } from "../../src/lib/book-builder-storage";
import { createBookScanCookie } from "../../src/lib/auth/session";

export default function QrPage() { return null; }

export async function getServerSideProps({ params, res }) {
  res.setHeader("Cache-Control", "private, no-store, no-cache, max-age=0, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const token = String(params.token || "").trim();

  if (!/^[\w-]{12}$/.test(token) || !await findStoredBookQrPage(token)) {
    return { notFound: true };
  }

  res.setHeader("Set-Cookie", createBookScanCookie(token));
  return { redirect: { destination: `/book?token=${encodeURIComponent(token)}`, permanent: false } };
}
