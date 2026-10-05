import { generateExerciseMeasures } from "../../src/lib/exercise-generator";

// POST { config, count, start } → { measures, tempo, config }: fresh one-measure
// exercises generated with the book's rules, from measure `start` of the plan.
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { config, count, start } = req.body || {};
    res.status(200).json(generateExerciseMeasures(config, count, start));
  } catch (error) {
    res.status(400).json({ error: `These settings can't make an exercise: ${error.message}` });
  }
}
