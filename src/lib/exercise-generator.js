// Generates fresh exercises from an exercise configuration with the same
// generator and rules as the book. Server only (the generator reads files).
const crypto = require("crypto");
const generator = require("../../scripts/generate-ai-book");
const { MAX_GENERATED_MEASURES, normalizeExerciseConfig, getConfigNestedVariants } = require("./exercise-config");
const { NESTED_TUPLET_STAGES } = require("./book-curriculum");

// The website shows one exercise per row, so allow the full row width.
const TOOL_PDF_SETTINGS = { measuresPerLine: 1, lineSpacing: 130, noteSize: 100 };

// Nested tuplets in measure order: every variant in turn or one variant, one
// measure each, or one measure per step with nestedSteps.
function createNestedSettings(config) {
  if (!config.nestedTuplets) return {};
  const variants = config.nestedTuplets === "cycle" ? getConfigNestedVariants(config) : [config.nestedTuplets];
  const count = config.nestedSteps ? NESTED_TUPLET_STAGES.length : 1;
  return {
    nestedTupletPlan: variants.map(({ actual, hostNotes }) => ({ actual, hostNotes, count })),
    ...(config.nestedSteps ? { nestedTupletStages: NESTED_TUPLET_STAGES } : {}),
  };
}

function createToolBook(config, sectionId) {
  return {
    structureVersion: 3,
    pdfSettings: TOOL_PDF_SETTINGS,
    groups: [{ id: "tool", title: "Generator", rhythmSpan: config.rhythmSpan }],
    sections: [{
      id: sectionId,
      groupId: "tool",
      title: config.name,
      rhythmSpan: config.rhythmSpan,
      primaryRhythms: config.primaryRhythms,
      secondaryRhythms: config.secondaryRhythms,
      pdfSettings: TOOL_PDF_SETTINGS,
      pages: [{
        subsectionId: `${sectionId}-page`,
        title: config.name,
        pdfSettings: TOOL_PDF_SETTINGS,
        generationSettings: {
          ornaments: config.ornaments,
          playEveryNote: config.playEveryNote,
          minPlayedNotes: config.minPlayedNotes,
          maxPlayedNotes: config.maxPlayedNotes,
          maxSameHandStickingRun: config.maxSameHandStickingRun,
          requiredSameHandStickingRuns: [],
          ...(config.fullPrimaryGroupShare != null ? { fullPrimaryGroupShare: config.fullPrimaryGroupShare } : {}),
          ...(config.chainPrimaryGroups ? { chainPrimaryGroups: true } : {}),
          ...createNestedSettings(config),
        },
      }],
    }],
  };
}

// Returns `count` one-measure scores' measures, starting at measure `start` of
// the configuration's plan (the composer adds one measure at a time), which
// repeats once every nested tuplet has had its turn. A random section id seeds
// the generator, so every request gives new exercises.
function generateExerciseMeasures(rawConfig, rawCount = 1, rawStart = 0) {
  const config = normalizeExerciseConfig(rawConfig);
  const count = Math.max(1, Math.min(MAX_GENERATED_MEASURES, Number.parseInt(rawCount, 10) || 1));
  const start = Math.max(0, Math.min(10000, Number.parseInt(rawStart, 10) || 0));
  const sectionId = `tool-${crypto.randomBytes(6).toString("hex")}`;
  const generation = generator.createGenerationConfig({}, createToolBook(config, sectionId));
  const page = generation.sections[0].pages[0];
  const period = (page.nestedTupletPlan || []).reduce((sum, variant) => sum + variant.count, 0) || Infinity;
  const used = new Set();
  const measures = Array.from({ length: count }, (_, index) =>
    generator.createUniqueGeneratedLine(null, page, page.sampleJson, (start + index) % period, used).score.measures[0]);
  return { config, measures, tempo: config.tempo };
}

module.exports = { generateExerciseMeasures };
