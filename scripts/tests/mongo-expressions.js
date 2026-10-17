// Evaluate the aggregation expressions used by notation search in API fixtures.
// Tests exercise the production projection and predicate, not a replacement matcher.
const at = (value, path) => path.split(".").reduce((item, key) => item?.[key], value);
function evaluate(expression, row, variables = {}) {
  const run = (value) => evaluate(value, row, variables);
  if (typeof expression === "string") {
    if (expression.startsWith("$$")) return at(variables, expression.slice(2));
    if (expression.startsWith("$")) return at(row, expression.slice(1));
    return expression;
  }
  if (Array.isArray(expression)) return expression.map(run);
  if (!expression || typeof expression !== "object") return expression;
  const [op, value] = Object.entries(expression)[0] || [];
  if (!op?.startsWith("$")) return Object.fromEntries(Object.entries(expression).map(([key, item]) => [key, run(item)]));
  if (op === "$literal") return value;
  if (op === "$map") return run(value.input).map((item) => evaluate(value.in, row, { ...variables, [value.as]: item }));
  if (op === "$filter") return run(value.input).filter((item) => evaluate(value.cond, row, { ...variables, [value.as]: item }));
  const args = Array.isArray(value) ? value.map(run) : run(value);
  switch (op) {
    case "$ifNull": return args[0] ?? args[1];
    case "$objectToArray": return Object.entries(args).map(([k, v]) => ({ k, v }));
    case "$eq": return JSON.stringify(args[0]) === JSON.stringify(args[1]);
    case "$gt": return args[0] > args[1];
    case "$gte": return args[0] >= args[1];
    case "$in": return args[1].includes(args[0]);
    case "$not": return !args[0];
    case "$size": return args.length;
    case "$indexOfCP": return args[0].indexOf(args[1]);
    case "$anyElementTrue": return args[0].some(Boolean);
    case "$range": return Array.from({ length: Math.max(0, args[1] - args[0]) }, (_, index) => args[0] + index);
    case "$max": return Math.max(...args);
    case "$add": return args.reduce((a, b) => a + b, 0);
    case "$subtract": return args[0] - args[1];
    case "$slice": return args[0].slice(args[1], args[1] + args[2]);
    default: throw new Error(`Unsupported fixture expression ${op}`);
  }
}
module.exports = evaluate;
