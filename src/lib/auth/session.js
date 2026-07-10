import crypto from "crypto";
import { MongoClient } from "mongodb";

const SESSION_COOKIE = "tc_session";
const OAUTH_STATE_COOKIE = "tc_oauth_state";
const OAUTH_RETURN_COOKIE = "tc_oauth_return_to";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const OAUTH_MAX_AGE_SECONDS = 60 * 10;
const DEFAULT_MONGODB_URI = "mongodb+srv://jared:admin@cluster0.9ibeh.mongodb.net/drumtoolz";

let mongoClientPromise;

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("Missing AUTH_SECRET for session signing.");
  }

  return secret || "truechops-dev-auth-secret";
}

function getMongoClientPromise() {
  if (!mongoClientPromise) {
    const uri = process.env.MONGODB_URI || DEFAULT_MONGODB_URI;
    mongoClientPromise = new MongoClient(uri).connect();
  }

  return mongoClientPromise;
}

export async function getMongoDb() {
  const client = await getMongoClientPromise();
  return client.db(process.env.MONGODB_DB || "drumtoolz");
}

function toBase64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromBase64Url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function sign(value) {
  return toBase64Url(crypto.createHmac("sha256", getAuthSecret()).update(value).digest());
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function createSignedToken(payload) {
  const body = toBase64Url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

function verifySignedToken(token) {
  if (!token || typeof token !== "string") {
    return null;
  }

  const [body, signature] = token.split(".");
  if (!body || !signature || !safeEqual(signature, sign(body))) {
    return null;
  }

  const payload = JSON.parse(fromBase64Url(body));
  if (payload.expiresAt && payload.expiresAt < Date.now()) {
    return null;
  }

  return payload;
}

export function randomToken() {
  return toBase64Url(crypto.randomBytes(24));
}

export function parseCookies(req) {
  const cookieHeader = req.headers.cookie || "";

  return cookieHeader.split(";").reduce((cookies, pair) => {
    const index = pair.indexOf("=");
    if (index === -1) {
      return cookies;
    }

    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();

    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }

    return cookies;
  }, {});
}

export function serializeCookie(name, value, options = {}) {
  const {
    httpOnly = true,
    maxAge,
    path = "/",
    sameSite = "Lax",
    secure = process.env.NODE_ENV === "production",
  } = options;
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, `SameSite=${sameSite}`];

  if (typeof maxAge === "number") {
    parts.push(`Max-Age=${maxAge}`);
  }

  if (httpOnly) {
    parts.push("HttpOnly");
  }

  if (secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function clearCookie(name) {
  return serializeCookie(name, "", { maxAge: 0 });
}

export function createSessionCookie(user) {
  const token = createSignedToken({
    user,
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  });

  return serializeCookie(SESSION_COOKIE, token, { maxAge: SESSION_MAX_AGE_SECONDS });
}

export function clearSessionCookie() {
  return clearCookie(SESSION_COOKIE);
}

export function getSessionUser(req) {
  const cookies = parseCookies(req);
  const payload = verifySignedToken(cookies[SESSION_COOKIE]);
  return payload?.user || null;
}

export function createOAuthCookies(state, returnTo) {
  return [
    serializeCookie(OAUTH_STATE_COOKIE, state, { maxAge: OAUTH_MAX_AGE_SECONDS }),
    serializeCookie(OAUTH_RETURN_COOKIE, returnTo, { maxAge: OAUTH_MAX_AGE_SECONDS }),
  ];
}

export function clearOAuthCookies() {
  return [clearCookie(OAUTH_STATE_COOKIE), clearCookie(OAUTH_RETURN_COOKIE)];
}

export function getOAuthCookies(req) {
  const cookies = parseCookies(req);
  return {
    returnTo: cookies[OAUTH_RETURN_COOKIE],
    state: cookies[OAUTH_STATE_COOKIE],
  };
}

export function getBaseUrl(req) {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  const host = (req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0];
  const forwardedProto = (req.headers["x-forwarded-proto"] || "").split(",")[0];
  const proto = forwardedProto || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export function sanitizeReturnTo(returnTo) {
  const value = Array.isArray(returnTo) ? returnTo[0] : returnTo;

  if (!value || typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

export function getGoogleOAuthConfig() {
  const clientId =
    process.env.GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_OAUTH_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local, then restart the dev server."
    );
  }

  return { clientId, clientSecret };
}

export async function upsertGoogleUser(profile) {
  const db = await getMongoDb();
  const users = db.collection("users");
  const authUserId = `google:${profile.sub}`;
  const existingUser = await users.findOne({ _id: authUserId });
  const now = new Date();

  await users.updateOne(
    { _id: authUserId },
    {
      $set: {
        email: profile.email,
        emailVerified: profile.email_verified === true || profile.email_verified === "true",
        googleId: profile.sub,
        name: profile.name || "",
        picture: profile.picture || "",
        provider: "google",
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
        rhythmUserId: authUserId,
      },
    },
    { upsert: true }
  );

  return {
    accessToken: null,
    authUserId,
    email: profile.email,
    id: existingUser?.rhythmUserId || authUserId,
    name: profile.name || profile.email,
    picture: profile.picture || "",
    provider: "google",
  };
}
