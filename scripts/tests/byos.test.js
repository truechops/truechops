const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs"), Module = require("node:module"), babel = require("@babel/core");
const original = Module._extensions[".js"];
Module._extensions[".js"] = (module, file) => {
  if (file.includes("node_modules")) return original(module, file);
  module._compile(babel.transformSync(fs.readFileSync(file, "utf8"), { presets: [["@babel/preset-env", { targets: { node: "current" } }]], babelrc: false, configFile: false }).code, file);
};
const { buildByosScore, byosLetters, BYOS_PHRASE_LIMIT } = require("../../src/lib/byos");
const { map: alphabet } = require("../../data/byos/alphabet/all");
const { validateScore } = require("../../src/lib/social/validation");

test("BYOS phrases ignore leading punctuation, spaces and numbers, preserving letter order and case equivalence", () => {
  assert.deepEqual(byosLetters("  !HoWdy, 123"), ["h", "o", "w", "d", "y"]);
  const expected = ["h", "o", "w", "d", "y"].flatMap(letter => alphabet[letter].score.measures);
  const score = buildByosScore("  !HoWdy, 123");
  assert.deepEqual(score.measures, expected);
  assert.deepEqual(score, buildByosScore("HOWDY"));
  assert.equal(buildByosScore(""), null);
  assert.equal(buildByosScore("  !123 🎵"), null);
});

test("repeated BYOS letters remain independent when edited in Score", () => {
  const original = JSON.stringify(alphabet.a.score);
  const score = buildByosScore("Aa");
  score.measures[0].parts[0].voices[0].notes[0].ornaments = "";
  score.parts.snare.enabled = false;
  assert.deepEqual(score.measures[1], alphabet.a.score.measures[0]);
  assert.equal(JSON.stringify(alphabet.a.score), original);
});

test("the BYOS alphabet and a full-length phrase can be saved using normal score validation", () => {
  const alphabetScore = buildByosScore("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  assert.equal(alphabetScore.measures.length, 26);
  assert.doesNotThrow(() => validateScore(alphabetScore));
  const fullPhrase = buildByosScore("a".repeat(BYOS_PHRASE_LIMIT));
  assert.equal(fullPhrase.measures.length, 64);
  assert.doesNotThrow(() => validateScore(fullPhrase));
});
