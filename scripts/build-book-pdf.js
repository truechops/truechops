#!/usr/bin/env node

const { spawnSync } = require("child_process");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");

function runScript(scriptName, args = []) {
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, scriptName), ...args],
    {
      cwd: PROJECT_ROOT,
      env: process.env,
      stdio: "inherit",
    }
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log("Regenerating every configured page to its current capacity...");
runScript("generate-ai-book.js", ["--no-local-ai"]);

console.log("Rendering the regenerated full-book PDF...");
runScript("generate-book-pdf.js", process.argv.slice(2));
