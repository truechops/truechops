// Shared with the explicit MongoDB provisioning command. No account fields are indexed.
const INSTRUMENTS = ["snare", "drumset", "tenors", "bass", "cymbals"];
const DIFFICULTIES = ["beginner", "intermediate", "advanced", "expert"];
const autocomplete = () => [{ type: "string" }, { type: "autocomplete", tokenization: "edgeGram", minGrams: 2, maxGrams: 20, foldDiacritics: true }];
const SEARCH_INDEXES = [
  { collection: "profiles", name: "community_profiles_v1", definition: { mappings: { dynamic: false, fields: {
    displayName: autocomplete(), handle: autocomplete(), bio: { type: "string" },
    instruments: [{ type: "string" }, { type: "token" }],
  } } } },
  { collection: "rhythms", name: "community_rhythms_v1", definition: { mappings: { dynamic: false, fields: {
    name: autocomplete(), description: { type: "string" }, tags: { type: "string" },
    instruments: { type: "token" }, difficulty: { type: "token" }, visibility: { type: "token" },
    type: { type: "token" },
  } } } },
];
module.exports = { INSTRUMENTS, DIFFICULTIES, SEARCH_INDEXES };
