#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DEFAULT_CONFIG_PATH = path.join(
  PROJECT_ROOT,
  "data",
  "book-builder",
  "snare-drum-book",
  "book-generation.json"
);
const DEFAULT_BOOK_PATH = path.join(
  PROJECT_ROOT,
  "data",
  "book-builder",
  "snare-drum-book",
  "book.json"
);

const DEFAULT_PDF_SETTINGS = {
  columns: 2,
  rows: 12,
  noteRenderWidth: 420,
  noteStartPadding: 25,
  noteEndPadding: 25,
};

const NUMBER_WORDS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

const args = process.argv.slice(2);

function getArg(name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] || fallback : fallback;
}

function getFlag(name) {
  return args.includes(name);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function getPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizePdfSettings(pdfSettings = {}) {
  const columns = [2, 3].includes(Number(pdfSettings.columns))
    ? Number(pdfSettings.columns)
    : DEFAULT_PDF_SETTINGS.columns;

  return {
    ...DEFAULT_PDF_SETTINGS,
    ...pdfSettings,
    columns,
    rows: DEFAULT_PDF_SETTINGS.rows,
  };
}

function getLinesPerPage(pdfSettings) {
  const normalized = normalizePdfSettings(pdfSettings);
  return normalized.columns * normalized.rows;
}

function createBlankLine(pageNumber, lineNumber) {
  return {
    pageNumber,
    lineNumber,
    title: "",
    notes: "",
    tempo: 90,
    score: null,
    updatedAt: null,
  };
}

function createBlankPage(pageNumber, pdfSettings) {
  const normalizedSettings = normalizePdfSettings(pdfSettings);
  const linesPerPage = getLinesPerPage(normalizedSettings);

  return {
    pageNumber,
    title: `Page ${pageNumber}`,
    pdfSettings: normalizedSettings,
    lines: Array.from({ length: linesPerPage }, (_, index) =>
      createBlankLine(pageNumber, index + 1)
    ),
  };
}

function createBlankLineScore() {
  return {
    parts: {
      snare: {
        enabled: true,
      },
    },
    measures: [{
      timeSig: {
        num: 4,
        type: 4,
      },
      parts: [{
        instrument: "snare",
        voices: [{
          notes: [
            { notes: [], duration: 4, dots: 0, velocity: 0.5 },
            { notes: [], duration: 4, dots: 0, velocity: 0.5 },
            { notes: [], duration: 4, dots: 0, velocity: 0.5 },
            { notes: [], duration: 4, dots: 0, velocity: 0.5 },
          ],
          tuplets: [],
        }],
      }],
    }],
  };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseJsonLoose(value) {
  if (!value) return null;
  if (typeof value === "object") return value;

  const text = String(value)
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(text);
  } catch {
    const objectStart = text.indexOf("{");
    const objectEnd = text.lastIndexOf("}");
    const arrayStart = text.indexOf("[");
    const arrayEnd = text.lastIndexOf("]");
    const hasObject = objectStart >= 0 && objectEnd > objectStart;
    const hasArray = arrayStart >= 0 && arrayEnd > arrayStart;

    if (!hasObject && !hasArray) return null;

    const jsonText = hasArray && (!hasObject || arrayStart < objectStart)
      ? text.slice(arrayStart, arrayEnd + 1)
      : text.slice(objectStart, objectEnd + 1);

    try {
      return JSON.parse(jsonText);
    } catch {
      return null;
    }
  }
}

function getSamplePayload(section) {
  return parseJsonLoose(section.sampleJson) || {};
}

function getSampleScore(samplePayload) {
  if (samplePayload && samplePayload.score && samplePayload.score.measures) {
    return samplePayload.score;
  }

  if (samplePayload && samplePayload.measures) {
    return samplePayload;
  }

  return createBlankLineScore();
}

function getSampleNotes(samplePayload) {
  const score = getSampleScore(samplePayload);
  const measure = score.measures && score.measures[0];
  const part = measure && Array.isArray(measure.parts)
    ? measure.parts.find((candidate) => candidate.instrument === "snare") || measure.parts[0]
    : null;
  const voice = part && part.voices && part.voices[0];
  return Array.isArray(voice && voice.notes) ? voice.notes : [];
}

function normalizePitch(value) {
  const pitch = String(value || "C5").replace("/", "").toUpperCase();
  return /^[A-G][0-9]$/.test(pitch) ? pitch : "C5";
}

function getNoteQuarterUnits(note) {
  const duration = Number(note.duration || 4);
  const dotMultiplier = note.dots ? 1.5 : 1;
  return (4 / duration) * dotMultiplier;
}

function getNotesQuarterUnits(notes) {
  return notes.reduce((total, note) => total + getNoteQuarterUnits(note), 0);
}

function isRest(note) {
  return !Array.isArray(note && note.notes) || note.notes.length === 0;
}

function isPlainEighth(note) {
  return Number(note && note.duration) === 8 && Number((note && note.dots) || 0) === 0;
}

function createQuarterRestFrom(note) {
  return {
    notes: [],
    duration: 4,
    dots: 0,
    velocity: Number((note && note.velocity) || 0.5),
  };
}

function createQuarterNoteFrom(note) {
  return {
    ...note,
    duration: 4,
    dots: 0,
  };
}

function preferQuarterValues(notes) {
  const simplified = [];

  for (let index = 0; index < notes.length; index += 1) {
    const note = notes[index];
    const next = notes[index + 1];

    if (next && isPlainEighth(note) && isPlainEighth(next)) {
      const noteIsRest = isRest(note);
      const nextIsRest = isRest(next);

      if (noteIsRest && nextIsRest) {
        simplified.push(createQuarterRestFrom(note));
        index += 1;
        continue;
      }

      if (!noteIsRest && nextIsRest) {
        simplified.push(createQuarterNoteFrom(note));
        index += 1;
        continue;
      }
    }

    simplified.push(note);
  }

  return simplified;
}

function normalizeGeneratedNote(note, fallbackNote = {}) {
  const fallbackDuration = [1, 2, 4, 8, 16, 32].includes(Number(fallbackNote.duration))
    ? Number(fallbackNote.duration)
    : 8;
  const duration = [1, 2, 4, 8, 16, 32].includes(Number(note && note.duration))
    ? Number(note.duration)
    : fallbackDuration;
  const notes = Array.isArray(note && note.notes)
    ? note.notes.map(normalizePitch)
    : Array.isArray(fallbackNote.notes)
      ? fallbackNote.notes.map(normalizePitch)
      : ["C5"];

  return {
    notes,
    duration,
    dots: Number((note && note.dots) || 0),
    velocity: Number((note && note.velocity) || fallbackNote.velocity || 0.5),
    ...((note && note.ornaments != null) || fallbackNote.ornaments != null
      ? { ornaments: String((note && note.ornaments) != null ? note.ornaments : fallbackNote.ornaments || "") }
      : {}),
  };
}

function normalizeGeneratedScore(value, fallbackScore = createBlankLineScore()) {
  const source = value && value.score && value.score.measures ? value.score : value;
  const fallbackMeasure = fallbackScore.measures && fallbackScore.measures[0]
    ? fallbackScore.measures[0]
    : createBlankLineScore().measures[0];
  const fallbackParts = Array.isArray(fallbackMeasure.parts)
    ? fallbackMeasure.parts
    : createBlankLineScore().measures[0].parts;
  const fallbackPart = fallbackParts.find((candidate) => candidate.instrument === "snare") ||
    fallbackParts[0];
  const fallbackVoice = fallbackPart && fallbackPart.voices && fallbackPart.voices[0]
    ? fallbackPart.voices[0]
    : { notes: [], tuplets: [] };
  const measure = source && source.measures && source.measures[0];
  const part = measure && Array.isArray(measure.parts)
    ? measure.parts.find((candidate) => candidate.instrument === "snare") || measure.parts[0]
    : null;
  const voice = part && part.voices && part.voices[0];
  const rawNotes = Array.isArray(voice && voice.notes) ? voice.notes : [];

  if (!rawNotes.length) {
    return cloneJson(fallbackScore);
  }

  const notes = rawNotes.map((note, index) =>
    normalizeGeneratedNote(note, (fallbackVoice.notes || [])[index] || (fallbackVoice.notes || [])[0])
  );
  const totalUnits = getNotesQuarterUnits(notes);

  if (Math.abs(totalUnits - 4) > 0.001) {
    return cloneJson(fallbackScore);
  }

  const simplifiedNotes = preferQuarterValues(notes);

  return {
    parts: { snare: { enabled: true } },
    measures: [{
      timeSig: {
        num: Number((measure && measure.timeSig && measure.timeSig.num) || fallbackMeasure.timeSig.num || 4),
        type: Number((measure && measure.timeSig && measure.timeSig.type) || fallbackMeasure.timeSig.type || 4),
      },
      parts: [{
        instrument: "snare",
        voices: [{
          notes: simplifiedNotes,
          tuplets: Array.isArray(voice && voice.tuplets) ? voice.tuplets : [],
        }],
      }],
    }],
  };
}

function extractGeneratedLineInputs(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;

  if (Array.isArray(payload.sections)) {
    return payload.sections.flatMap(extractGeneratedLineInputs);
  }

  if (Array.isArray(payload.pages)) {
    return payload.pages.flatMap((page) =>
      page.lines || page.examples || page.rhythms || []
    );
  }

  return payload.lines || payload.examples || payload.rhythms || payload.exercises || [];
}

function getSectionInstructionText(section) {
  return `${section.title || ""}\n${section.instructions || section.prompt || ""}`.toLowerCase();
}

function getSectionOrnamentPolicy(section) {
  const prompt = getSectionInstructionText(section);

  return {
    stripAllOrnaments: /no\s+ornaments?/.test(prompt) || /notes?\s+only/.test(prompt),
    stripAccents: /no\s+accents?/.test(prompt) || /without\s+accents?/.test(prompt),
    stripFlams: /no\s+(?:accents?\s+or\s+)?flams?/.test(prompt) || /without\s+flams?/.test(prompt),
  };
}

function applySectionOrnamentPolicy(section, score) {
  const policy = getSectionOrnamentPolicy(section);

  if (!policy.stripAllOrnaments && !policy.stripAccents && !policy.stripFlams) {
    return score;
  }

  return {
    ...score,
    measures: (score.measures || []).map((measure) => ({
      ...measure,
      parts: (measure.parts || []).map((part) => ({
        ...part,
        voices: (part.voices || []).map((voice) => ({
          ...voice,
          notes: (voice.notes || []).map((note) => {
            if (note.ornaments == null) {
              return note;
            }

            let ornaments = String(note.ornaments);

            if (policy.stripAllOrnaments) {
              ornaments = "";
            }

            if (policy.stripAccents) {
              ornaments = ornaments.replace(/a/g, "");
            }

            if (policy.stripFlams) {
              ornaments = ornaments.replace(/f/g, "");
            }

            if (!ornaments) {
              const { ornaments: _ornaments, ...rest } = note;
              return rest;
            }

            return {
              ...note,
              ornaments,
            };
          }),
        })),
      })),
    })),
  };
}

function createFallbackGeneratedScore(section, samplePayload, lineIndex) {
  const prompt = getSectionInstructionText(section);
  const sampleNotes = getSampleNotes(samplePayload);
  const sampleDurations = new Set(sampleNotes.map((note) => Number(note.duration)).filter(Boolean));
  const allowSixteenth = prompt.includes("sixteenth") || sampleDurations.has(16);
  const allowQuarter = prompt.includes("quarter") || sampleDurations.has(4);
  const noOrnaments = /no\s+ornaments?/.test(prompt) || /notes?\s+only/.test(prompt);
  const noAccents = /no\s+accents?/.test(prompt);
  const noFlams = /no\s+flams?/.test(prompt) || /no\s+accents?\s+or\s+flams?/.test(prompt);
  const allowAccents = !noOrnaments && !noAccents && (
    prompt.includes("accent") ||
    samplePayload.accents === true
  );
  const allowFlams = !noOrnaments && !noFlams && (
    prompt.includes("flam")
  );
  const allowSticking = !noOrnaments && (
    prompt.includes("sticking")
  );
  const allowDiddles = !noOrnaments && (
    prompt.includes("diddle")
  );
  const allowCheese = !noOrnaments && (
    prompt.includes("cheese")
  );
  const notes = [];

  if (allowSixteenth) {
    const patterns = [
      [1, 1, 2, 2, 1, 1, 3, 1, 4],
      [1, 1, 1, 1, 2, 2, 1, 1, 2, 2, 2],
      [2, 1, 1, 4, 1, 1, 2, 2, 2],
      [1, 1, 1, 1, 1, 1, 1, 1, 4, 2, 2],
      [3, 1, 2, 2, 1, 1, 1, 1, 4],
    ];
    const pattern = patterns[lineIndex % patterns.length];
    let noteCount = 0;

    pattern.forEach((units, patternIndex) => {
      const seed = lineIndex * 13 + patternIndex * 7 + String(section.id || "").length;
      const isRest = seed % 11 === 0 || (units >= 4 && seed % 5 === 0);
      const nextSeed = lineIndex * 13 + (patternIndex + 1) * 7 + String(section.id || "").length;
      const nextCouldFlam = allowFlams && patternIndex < pattern.length - 1 && nextSeed % 6 === 1;
      let ornaments = "";

      if (!isRest && allowSticking) {
        ornaments += noteCount % 2 === 0 ? "r" : "l";
      }

      if (!isRest && allowFlams && seed % 6 === 1) {
        ornaments += "f";
      }

      if (!isRest && allowAccents && seed % 4 === 0) {
        ornaments += "a";
      }

      if (!isRest && allowDiddles && !nextCouldFlam && !ornaments.includes("f") && seed % 8 === 2) {
        ornaments += "d";
      }

      if (!isRest && allowCheese && !nextCouldFlam && !ornaments.includes("f") && !String(notes[notes.length - 1]?.ornaments || "").includes("c") && seed % 10 === 3) {
        ornaments += "c";
      }

      const durationByUnits = {
        1: { duration: 16, dots: 0 },
        2: { duration: 8, dots: 0 },
        3: { duration: 8, dots: 1 },
        4: { duration: 4, dots: 0 },
      }[units] || { duration: 16, dots: 0 };

      notes.push({
        notes: isRest ? [] : ["C5"],
        ...durationByUnits,
        velocity: ornaments.includes("a") ? 1 : 0.5,
        ...(ornaments ? { ornaments } : {}),
      });
      noteCount += isRest ? 0 : 1;
    });

    const simplifiedNotes = preferQuarterValues(notes);

    return {
      parts: { snare: { enabled: true } },
      measures: [{
        timeSig: { num: 4, type: 4 },
        parts: [{
          instrument: "snare",
          voices: [{ notes: simplifiedNotes, tuplets: [] }],
        }],
      }],
    };
  }

  for (let beat = 0; beat < 4; beat += 1) {
    const seed = lineIndex * 7 + beat * 11 + String(section.id || "").length;
    const useQuarter = allowQuarter && seed % 5 === 0;
    const quarterRest = allowQuarter && seed % 11 === 0;

    if (useQuarter || quarterRest) {
      const isRest = quarterRest || seed % 13 === 0;
      const ornaments = !isRest && allowAccents && seed % 3 === 0 ? "a" : "";
      notes.push({
        notes: isRest ? [] : ["C5"],
        duration: 4,
        dots: 0,
        velocity: ornaments.includes("a") ? 1 : 0.5,
        ...(ornaments ? { ornaments } : {}),
      });
      continue;
    }

    for (let subdivision = 0; subdivision < 2; subdivision += 1) {
      const subSeed = seed + subdivision * 5;
      const isRest = subSeed % 7 === 0 || subSeed % 17 === 0;
      let ornaments = "";

      if (!isRest && allowFlams && subSeed % 6 === 1) {
        ornaments += "f";
      }

      if (!isRest && allowAccents && subSeed % 4 === 0) {
        ornaments += "a";
      }

      notes.push({
        notes: isRest ? [] : ["C5"],
        duration: 8,
        dots: 0,
        velocity: ornaments.includes("a") ? 1 : 0.5,
        ...(ornaments ? { ornaments } : {}),
      });
    }
  }

  const simplifiedNotes = preferQuarterValues(notes);

  return {
    parts: { snare: { enabled: true } },
    measures: [{
      timeSig: { num: 4, type: 4 },
      parts: [{
        instrument: "snare",
        voices: [{ notes: simplifiedNotes, tuplets: [] }],
      }],
    }],
  };
}

function createFallbackGeneratedLine(section, samplePayload, index) {
  return {
    title: `${section.title || "Section"} ${index + 1}`,
    notes: "Generated from section instructions and sample JSON.",
    tempo: getPositiveInteger(samplePayload.tempo, 90),
    score: createFallbackGeneratedScore(section, samplePayload, index),
  };
}

function normalizeGeneratedLine(input, section, samplePayload, index) {
  const fallbackLine = createFallbackGeneratedLine(section, samplePayload, index);
  const fallbackScore = getSampleScore(samplePayload);
  const scoreSource = input && (input.score || input.measures ? input.score || input : null);
  const score = scoreSource
    ? normalizeGeneratedScore(scoreSource, fallbackScore)
    : fallbackLine.score;

  return {
    title: (input && input.title) || fallbackLine.title,
    notes: (input && input.notes) || "",
    tempo: getPositiveInteger(input && input.tempo, fallbackLine.tempo),
    score: applySectionOrnamentPolicy(section, score),
  };
}

function inferPageCount(section) {
  if (section.pageCount) {
    return getPositiveInteger(section.pageCount, 1);
  }

  const prompt = `${section.instructions || ""}`.toLowerCase();
  const numericMatch = prompt.match(/(\d+)\s+pages?/);
  const wordMatch = prompt.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+pages?\b/
  );

  if (numericMatch) return Number(numericMatch[1]);
  if (wordMatch) return NUMBER_WORDS[wordMatch[1]];
  return Array.isArray(section.pages) && section.pages.length
    ? section.pages.length
    : 1;
}

function getSectionSampleJson(section) {
  return parseJsonLoose(section.sampleJson) || {};
}

function createGenerationSectionsFromBook(book) {
  const bookPdfSettings = normalizePdfSettings(book.pdfSettings);

  return (book.sections || []).map((section, sectionIndex) => {
    const sectionPdfSettings = normalizePdfSettings({
      ...bookPdfSettings,
      ...(section.pdfSettings || {}),
    });
    const existingPageCount = Array.isArray(section.pages) && section.pages.length
      ? section.pages.length
      : 1;

    return {
      id: section.id || `section-${sectionIndex + 1}`,
      title: section.title || `Section ${sectionIndex + 1}`,
      pageCount: getPositiveInteger(
        section.pageCount,
        existingPageCount || inferPageCount(section)
      ),
      instructions: section.prompt || section.instructions || "",
      sampleJson: getSectionSampleJson(section),
      pdfSettings: sectionPdfSettings,
    };
  });
}

function createGenerationConfig(config, sourceBook) {
  return {
    ...config,
    book: {
      ...(config.book || {}),
      book: sourceBook.book || (config.book && config.book.book) || "true-chops",
      slug: sourceBook.slug || (config.book && config.book.slug) || "snare-drum-book",
      title: sourceBook.title || (config.book && config.book.title) || "Snare Drum Book",
      edition: Number(sourceBook.edition || (config.book && config.book.edition) || 1),
      contentVersion: Number(sourceBook.contentVersion || (config.book && config.book.contentVersion) || 1),
      pdfSettings: normalizePdfSettings({
        ...((config.book && config.book.pdfSettings) || {}),
        ...(sourceBook.pdfSettings || {}),
      }),
    },
    sections: createGenerationSectionsFromBook(sourceBook),
  };
}

function createAiPrompt(config, section, samplePayload, count, offset, linesPerPage) {
  const globalInstructions = (config.generation && config.generation.globalInstructions) || [];

  return [
    ...globalInstructions,
    "",
    `Section title: ${section.title || "Untitled section"}`,
    `Section instructions: ${section.instructions || ""}`,
    `Return exactly ${count} lines. These begin at section line ${offset + 1}.`,
    `The section has ${linesPerPage} lines per PDF page.`,
    "",
    "Sample JSON:",
    JSON.stringify(samplePayload, null, 2),
  ].join("\n");
}

function postJson(urlString, payload, timeoutMs) {
  const url = new URL(urlString);
  const body = JSON.stringify(payload);
  const client = url.protocol === "https:" ? https : http;
  const requestOptions = {
    method: "POST",
    hostname: url.hostname,
    port: url.port || (url.protocol === "https:" ? 443 : 80),
    path: `${url.pathname}${url.search}`,
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    },
  };

  return new Promise((resolve, reject) => {
    const request = client.request(requestOptions, (response) => {
      const chunks = [];

      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");

        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`AI endpoint returned HTTP ${response.statusCode}: ${text}`));
          return;
        }

        try {
          resolve(JSON.parse(text));
        } catch (error) {
          reject(new Error(`AI endpoint returned invalid JSON: ${error.message}`));
        }
      });
    });

    request.on("error", reject);
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`AI request timed out after ${timeoutMs}ms`));
    });
    request.write(body);
    request.end();
  });
}

async function requestAiGeneratedLines(config, section, samplePayload, count, offset, linesPerPage) {
  if (process.env.BOOK_AI_DISABLE === "1") {
    return [];
  }

  const localAi = (config.generation && config.generation.localAi) || {};
  const endpoint = process.env.BOOK_AI_ENDPOINT ||
    process.env.OLLAMA_ENDPOINT ||
    localAi.endpoint ||
    "http://127.0.0.1:11434/api/generate";
  const model = process.env.BOOK_AI_MODEL ||
    process.env.OLLAMA_MODEL ||
    localAi.model ||
    "llama3.1";
  const timeoutMs = getPositiveInteger(
    process.env.BOOK_AI_REQUEST_TIMEOUT_MS || localAi.requestTimeoutMs,
    180000
  );
  const temperature = Number(process.env.BOOK_AI_TEMPERATURE || localAi.temperature || 0.8);
  const prompt = createAiPrompt(config, section, samplePayload, count, offset, linesPerPage);
  const payload = endpoint.includes("/api/chat")
    ? {
        model,
        messages: [{ role: "user", content: prompt }],
        stream: false,
        format: "json",
        options: { temperature },
      }
    : {
        model,
        prompt,
        stream: false,
        format: "json",
        options: { temperature },
      };
  const result = await postJson(endpoint, payload, timeoutMs);
  const resultText = result.response ||
    (result.message && result.message.content) ||
    (result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content) ||
    JSON.stringify(result);

  return extractGeneratedLineInputs(parseJsonLoose(resultText));
}

async function generateSectionLines(config, section, sectionIndex, options) {
  const samplePayload = getSamplePayload(section);
  const pdfSettings = normalizePdfSettings({
    ...(config.book && config.book.pdfSettings),
    ...(section.pdfSettings || {}),
  });
  const linesPerPage = getLinesPerPage(pdfSettings);
  const pageCount = inferPageCount(section);
  const lineCount = pageCount * linesPerPage;
  const localAi = (config.generation && config.generation.localAi) || {};
  const batchSize = getPositiveInteger(
    process.env.BOOK_AI_LINE_BATCH_SIZE || localAi.batchSize,
    12
  );
  const lines = [];

  console.log(
    `[${sectionIndex + 1}/${config.sections.length}] ${section.title}: generate ${pageCount} pages, ${lineCount} lines`
  );

  for (let offset = 0; offset < lineCount; offset += batchSize) {
    const count = Math.min(batchSize, lineCount - offset);
    let aiLines = [];

    try {
      aiLines = await requestAiGeneratedLines(config, section, samplePayload, count, offset, linesPerPage);
    } catch (error) {
      if (!options.allowFallback) {
        throw new Error(`${section.title}: ${error.message}`);
      }

      console.warn(`  AI unavailable for lines ${offset + 1}-${offset + count}; using fallback.`);
    }

    if (!options.allowFallback && aiLines.length < count) {
      throw new Error(`${section.title}: AI returned ${aiLines.length} of ${count} requested lines.`);
    }

    for (let batchIndex = 0; batchIndex < count; batchIndex += 1) {
      const index = offset + batchIndex;
      const input = aiLines[batchIndex] || null;
      lines.push(normalizeGeneratedLine(input, section, samplePayload, index));
    }

    process.stdout.write(`  ${Math.min(offset + count, lineCount)} / ${lineCount}\r`);
  }

  process.stdout.write("\n");

  return {
    pageCount,
    pdfSettings,
    lines,
  };
}

function createGeneratedPages(section, generated, now) {
  return Array.from({ length: generated.pageCount }, (_, pageIndex) => {
    const page = createBlankPage(pageIndex + 1, generated.pdfSettings);

    return {
      ...page,
      title: `${section.title} ${pageIndex + 1}`,
      lines: page.lines.map((line, lineIndex) => {
        const generatedLine = generated.lines[pageIndex * page.lines.length + lineIndex];
        return generatedLine
          ? {
              ...line,
              title: generatedLine.title,
              notes: generatedLine.notes || "",
              tempo: generatedLine.tempo,
              score: generatedLine.score,
              updatedAt: now,
            }
          : line;
      }),
    };
  });
}

function buildBook(config, generatedSections) {
  const now = new Date().toISOString();
  const bookSettings = normalizePdfSettings(config.book && config.book.pdfSettings);
  let globalPageNumber = 1;

  const sections = config.sections.map((section, sectionIndex) => {
    const generated = generatedSections[sectionIndex];
    const pages = createGeneratedPages(section, generated, now).map((page, sectionPageIndex) => {
      const pageNumber = globalPageNumber;
      globalPageNumber += 1;

      return {
        ...page,
        pageNumber,
        sectionId: section.id,
        sectionTitle: section.title,
        sectionPageNumber: sectionPageIndex + 1,
        lines: page.lines.map((line, lineIndex) => ({
          ...line,
          pageNumber,
          lineNumber: lineIndex + 1,
          sectionId: section.id,
          sectionPageNumber: sectionPageIndex + 1,
        })),
      };
    });

    return {
      id: section.id,
      title: section.title,
      prompt: section.instructions || "",
      sampleJson: JSON.stringify(section.sampleJson || {}, null, 2),
      pageCount: generated.pageCount,
      pdfSettings: generated.pdfSettings,
      pages,
    };
  });

  const pages = sections.flatMap((section) => section.pages);

  return {
    book: (config.book && config.book.book) || "true-chops",
    slug: (config.book && config.book.slug) || "snare-drum-book",
    title: (config.book && config.book.title) || "Snare Drum Book",
    edition: Number((config.book && config.book.edition) || 1),
    contentVersion: Number((config.book && config.book.contentVersion) || 1),
    updatedAt: now,
    pdfSettings: bookSettings,
    sections,
    pages,
  };
}

function createManifest(book) {
  const createLineManifest = (line) => ({
    pageNumber: line.pageNumber,
    lineNumber: line.lineNumber,
    sectionId: line.sectionId,
    sectionPageNumber: line.sectionPageNumber,
    title: line.title,
    notes: line.notes,
    tempo: line.tempo,
    hasScore: Boolean(line.score),
    updatedAt: line.updatedAt,
  });
  const createPageManifest = (page) => ({
    pageNumber: page.pageNumber,
    sectionId: page.sectionId,
    sectionTitle: page.sectionTitle,
    sectionPageNumber: page.sectionPageNumber,
    title: page.title,
    pdfSettings: page.pdfSettings,
    lines: page.lines.map(createLineManifest),
  });

  return {
    book: book.book,
    slug: book.slug,
    title: book.title,
    edition: book.edition,
    contentVersion: book.contentVersion,
    updatedAt: book.updatedAt,
    pdfSettings: book.pdfSettings,
    sections: book.sections.map((section) => ({
      id: section.id,
      title: section.title,
      prompt: section.prompt,
      sampleJson: section.sampleJson,
      pageCount: section.pageCount,
      pdfSettings: section.pdfSettings,
      pages: section.pages.map(createPageManifest),
    })),
    pages: book.pages.map(createPageManifest),
  };
}

function pageDir(bookRoot, pageNumber) {
  return path.join(bookRoot, "pages", `page-${String(pageNumber).padStart(2, "0")}`);
}

function linePath(bookRoot, pageNumber, lineNumber) {
  return path.join(pageDir(bookRoot, pageNumber), `line-${String(lineNumber).padStart(2, "0")}.json`);
}

function saveBook(book, bookRoot) {
  fs.mkdirSync(bookRoot, { recursive: true });

  for (const page of book.pages) {
    fs.mkdirSync(pageDir(bookRoot, page.pageNumber), { recursive: true });

    for (const line of page.lines) {
      writeJson(
        linePath(bookRoot, page.pageNumber, line.lineNumber),
        {
          ...line,
          pageNumber: page.pageNumber,
          lineNumber: line.lineNumber,
        }
      );
    }
  }

  writeJson(path.join(bookRoot, "book.json"), createManifest(book));
}

async function main() {
  const configPath = path.resolve(getArg("--config", DEFAULT_CONFIG_PATH));
  const config = readJson(configPath);
  const bookSlug = (config.book && config.book.slug) || "snare-drum-book";
  const bookRoot = path.resolve(
    getArg("--output-root", path.join(PROJECT_ROOT, "data", "book-builder", bookSlug))
  );
  const bookPath = path.resolve(getArg("--book", path.join(bookRoot, "book.json")));
  const sourceBook = readJson(bookPath);
  const generationConfig = createGenerationConfig(config, sourceBook);
  const allowFallback = getFlag("--allow-fallback") || process.env.BOOK_AI_ALLOW_FALLBACK === "1";
  const noLocalAi = getFlag("--no-local-ai") || process.env.BOOK_AI_DISABLE === "1";
  const dryRun = getFlag("--dry-run");

  if (noLocalAi) {
    process.env.BOOK_AI_DISABLE = "1";
  }

  if (!Array.isArray(generationConfig.sections) || generationConfig.sections.length === 0) {
    throw new Error(`No saved sections found in ${bookPath}`);
  }

  console.log(`Reading generation settings from ${path.relative(PROJECT_ROOT, configPath)}`);
  console.log(`Reading saved sections from ${path.relative(PROJECT_ROOT, bookPath)}`);
  console.log(`Output root: ${path.relative(PROJECT_ROOT, bookRoot)}`);

  const generatedSections = [];

  for (let sectionIndex = 0; sectionIndex < generationConfig.sections.length; sectionIndex += 1) {
    generatedSections.push(
      await generateSectionLines(generationConfig, generationConfig.sections[sectionIndex], sectionIndex, {
        allowFallback: allowFallback || noLocalAi,
      })
    );
  }

  const book = buildBook(generationConfig, generatedSections);

  if (dryRun) {
    console.log(`Dry run complete. Generated ${book.pages.length} pages and ${book.pages.reduce((sum, page) => sum + page.lines.length, 0)} lines in memory.`);
    return;
  }

  saveBook(book, bookRoot);
  console.log(`Wrote ${book.pages.length} pages to ${path.relative(PROJECT_ROOT, bookRoot)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
