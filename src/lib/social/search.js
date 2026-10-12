import { SEARCH_INDEXES } from "./config";

export function publicRhythmFilter(extra = {}) {
  return { type: "saved", visibility: "public", ...extra };
}
export function searchPipeline(options) {
  const { q, type, page, limit, instrument, difficulty } = options;
  const people = type === "users";
  const filter = people ? {} : publicRhythmFilter();
  if (instrument) filter.instruments = instrument;
  if (difficulty && !people) filter.difficulty = difficulty;
  const stages = [];
  if (q) {
    const fields = people ? ["displayName", "handle"] : ["name"];
    const query = people ? q.replace(/^@/, "") : q;
    const should = [
      ...fields.map((path) => ({ autocomplete: { path, query, tokenOrder: "sequential", ...(query.length >= 4 ? { fuzzy: { maxEdits: 1, prefixLength: 1, maxExpansions: 32 } } : {}), score: { boost: { value: 3 } } } })),
      { text: { query, path: people ? ["displayName","handle","bio","instruments"] : ["name","description","tags"], score: { boost: { value: 2 } } } },
    ];
    stages.push({ $search: { index: SEARCH_INDEXES[people ? 0 : 1].name, compound: {
      should, minimumShouldMatch: 1,
      ...(!people || instrument ? { filter: Object.entries(filter).map(([path,value]) => ({ equals: { path, value } })) } : {}),
    } } });
  }
  // Search indexes are eventually consistent. Recheck visibility against the
  // source document before returning it, even when Search still says public.
  stages.push({ $match: filter });
  stages.push({ $sort: q ? { relevance: { $meta: "searchScore" }, _id: 1 } : { updatedAt: -1, _id: -1 } });
  stages.push({ $skip: (page-1)*limit }, { $limit: limit+1 });
  return stages;
}
