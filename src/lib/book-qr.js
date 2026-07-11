import { createHash } from "crypto";
import {
  BOOK_CONTENT_VERSION,
  BOOK_EDITION,
  BOOK_KEY,
} from "../components/book-builder/book-data";

const QR_TOKEN_NAMESPACE = "truechops:first-edition:practice-qrs:v1";
const QR_TOKEN_LENGTH = 12;

function toBase64Url(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function getBookPageIdentity(pageNumber, book = {}) {
  return {
    book: book.book || BOOK_KEY,
    edition: Number(book.edition || BOOK_EDITION),
    page: Number(pageNumber),
    contentVersion: Number(book.contentVersion || BOOK_CONTENT_VERSION),
  };
}

export function getBookPageQrToken(identity) {
  const payload = [
    QR_TOKEN_NAMESPACE,
    identity.book,
    identity.edition,
    identity.page,
    identity.contentVersion,
  ].join(":");

  return toBase64Url(createHash("sha256").update(payload).digest()).slice(
    0,
    QR_TOKEN_LENGTH
  );
}

export function getBookPageQrPath(pageNumber, book = {}) {
  const identity = getBookPageIdentity(pageNumber, book);
  return `/q/${getBookPageQrToken(identity)}`;
}

export function getBookPageQrUrl(pageNumber, book = {}, origin = "https://truechops.com") {
  return `${origin.replace(/\/$/g, "")}${getBookPageQrPath(pageNumber, book)}`;
}

export function getBookQrPageRef(book, page) {
  const identity = getBookPageIdentity(page.pageNumber, book);
  return {
    ...identity,
    token: getBookPageQrToken(identity),
    title: page.title || `Page ${page.pageNumber}`,
  };
}

export function buildBookQrIndex(book) {
  const pages = Array.isArray(book?.pages) ? book.pages : [];
  return pages.map((page) => getBookQrPageRef(book, page));
}

export function findBookQrPage(book, token) {
  const pageRefs = buildBookQrIndex(book);
  const pageRef = pageRefs.find((candidate) => candidate.token === token);

  if (!pageRef) {
    return null;
  }

  const page = book.pages.find(
    (candidate) => Number(candidate.pageNumber) === Number(pageRef.page)
  );

  if (!page) {
    return null;
  }

  return { pageRef, page };
}
