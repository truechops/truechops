import { INSTRUMENTS, DIFFICULTIES } from "./config";
import { noteQuarterDuration } from "../book-practice-score";
import * as automataTypes from "../../consts/raTypes";

export class SocialError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function fail(status, message) { throw new SocialError(status, message); }
export function string(value, max, label, required = false) {
  if (value == null && !required) return "";
  if (typeof value !== "string" || value.trim().length > max || (required && !value.trim())) fail(400, `Enter a valid ${label} (up to ${max} characters).`);
  return value.trim();
}
export function enumValue(value, allowed, label) {
  if (!allowed.includes(value)) fail(400, `Choose a valid ${label}.`);
  return value;
}
export function normalizeProfile(body) {
  const handle = string(body.handle, 24, "handle", true).toLowerCase();
  if (!/^[a-z0-9][a-z0-9_]{2,23}$/.test(handle) || ["admin", "truechops", "support", "account", "api"].includes(handle)) fail(400, "Use 3-24 letters, numbers or underscores for your handle. This handle may be reserved.");
  if (!Array.isArray(body.instruments) || body.instruments.length > 5) fail(400, "Choose your instruments.");
  return { handle, displayName: string(body.displayName, 60, "display name", true), bio: string(body.bio, 360, "bio"),
    instruments: [...new Set(body.instruments.map((value) => enumValue(value, INSTRUMENTS, "instrument")))] };
}
export function normalizeMetadata(body) {
  const rawTags = typeof body.tags === "string" ? body.tags.split(",").filter((tag) => tag.trim()) : body.tags || [];
  if (!Array.isArray(rawTags) || rawTags.length > 8) fail(400, "Use up to eight tags.");
  const tags = [...new Set(rawTags.map((tag) => string(tag, 24, "tag", true).toLowerCase()))];
  const tempo = body.tempo ?? 90;
  if (!Number.isFinite(tempo) || tempo < 20 || tempo > 300) fail(400, "Tempo must be between 20 and 300 BPM.");
  return { name: string(body.name, 100, "rhythm title", true), description: string(body.description, 1000, "description"), tags,
    tempo, difficulty: enumValue(body.difficulty || "beginner", DIFFICULTIES, "difficulty"),
    visibility: enumValue(body.visibility || "private", ["private", "public"], "visibility") };
}
export function validateScore(score) {
  if (!score || !Array.isArray(score.measures) || !score.measures.length || score.measures.length > 64) fail(400, "A rhythm needs 1-64 measures.");
  const instruments = new Set();
  const measures = score.measures.map((measure) => {
    const num = measure?.timeSig?.num, type = measure?.timeSig?.type;
    if (!Number.isInteger(num) || num < 1 || num > 32 || ![1,2,4,8,16,32].includes(type)) fail(400, "Invalid time signature.");
    if (!Array.isArray(measure.parts) || !measure.parts.length || measure.parts.length > 5) fail(400, "Invalid score parts.");
    const seen = new Set();
    const parts = measure.parts.map((part) => {
      const instrument = enumValue(part.instrument, INSTRUMENTS, "instrument");
      if (seen.has(instrument)) fail(400, "A measure cannot repeat an instrument part.");
      seen.add(instrument); instruments.add(instrument);
      if (!Array.isArray(part.voices) || !part.voices.length || part.voices.length > 4) fail(400, "Invalid voices.");
      return { instrument, voices: part.voices.map((voice) => {
        if (!Array.isArray(voice.notes) || !voice.notes.length || voice.notes.length > 256) fail(400, "Invalid notes.");
        const notes = voice.notes.map((note) => {
          if (!Array.isArray(note.notes) || note.notes.length > 8 || note.notes.some((pitch) => typeof pitch !== "string" || !/^[A-G][#b]?-?\d$/.test(pitch)) ||
            ![1,2,4,8,16,32,64,128].includes(note.duration) || ![0,1,2,3].includes(note.dots || 0) ||
            (note.velocity != null && (!Number.isFinite(note.velocity) || note.velocity < 0 || note.velocity > 1))) fail(400, "Invalid note values.");
          const ornaments = string(note.ornaments, 16, "ornaments");
          if (!/^[afdcblr]*$/.test(ornaments)) fail(400, "Invalid ornaments.");
          const head = note.head || "";
          if (head && !["d1","d3","t1","t3","x1","x2","x3","n"].includes(head)) fail(400, "Invalid note head.");
          return { notes: [...note.notes], duration: note.duration, dots: note.dots || 0, ornaments, velocity: note.velocity ?? 0.5, ...(head ? { head } : {}) };
        });
        if (voice.tuplets != null && (!Array.isArray(voice.tuplets) || voice.tuplets.length > 64)) fail(400, "Invalid tuplets.");
        const tuplets = (voice.tuplets || []).map(({ actual, normal, start, end }) => {
          if (![actual,normal,start,end].every(Number.isInteger) || actual < 2 || actual > 32 || normal < 1 || normal > 32 || start < 0 || end <= start || end > notes.length) fail(400, "Invalid tuplet values.");
          return { actual, normal, start, end };
        });
        const duration = notes.reduce((sum,n,i) => sum + noteQuarterDuration(n,i,tuplets),0);
        if (Math.abs(duration - num*4/type) > 0.00001) fail(400, "Every voice must fill its measure before saving.");
        return { notes, tuplets };
      }) };
    });
    return { timeSig: { num, type }, parts };
  });
  return { score: { parts: Object.fromEntries([...instruments].map((name) => [name, { enabled: score.parts?.[name]?.enabled !== false }])), measures }, instruments: [...instruments] };
}
export function normalizeMutations(value = []) {
  if (!Array.isArray(value) || value.length > 1) fail(400, "Invalid dynamic rhythm settings.");
  return value.map((entry) => {
    const config = typeof entry.config === "string" ? entry.config : JSON.stringify(entry.config || {});
    if (config.length > 12000) fail(400, "Dynamic rhythm settings are too large.");
    let parsed;
    try { parsed = JSON.parse(config); } catch { fail(400, "Invalid dynamic rhythm settings."); }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || (parsed.probability != null && (!Number.isFinite(parsed.probability) || parsed.probability < 0 || parsed.probability > 1))) fail(400,"Invalid dynamic rhythm settings.");
    if (![1,2,4,8,16,32,64,128].includes(entry.grid)) fail(400, "Invalid dynamic rhythm grid.");
    const type = enumValue(entry.type,["swap","shuffle","reverse",...Object.values(automataTypes)],"mutation type");
    const context = string(entry.context,60,"mutation context",true);
    if (context !== "All" && !/^[A-G][#b]?-?\d$/.test(context)) fail(400,"Invalid mutation context.");
    return { type, context, grid: entry.grid, config };
  });
}
export function searchOptions(query = {}) {
  const type = enumValue(query.type || "rhythms", ["rhythms", "users"], "search type");
  const raw = string(query.q, 100, "search");
  const q = type === "users" ? raw.replace(/^@/, "").trim() : raw;
  if (Array.isArray(query.page) || typeof query.page === "object") fail(400,"Invalid result page.");
  const page = Number(query.page || 1);
  if (!Number.isInteger(page) || page < 1 || page > 100) fail(400, "Invalid result page.");
  const instrument = query.instrument ? enumValue(query.instrument, INSTRUMENTS, "instrument") : "";
  const difficulty = query.difficulty ? enumValue(query.difficulty, DIFFICULTIES, "difficulty") : "";
  return { q, type, page, instrument, difficulty, limit: 12 };
}
