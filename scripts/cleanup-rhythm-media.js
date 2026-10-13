#!/usr/bin/env node
const fs = require("node:fs");
const Module = require("node:module");
const babel = require("@babel/core");
const { loadEnvConfig } = require("@next/env");
const { MongoClient } = require("mongodb");
const originalLoader = Module._extensions[".js"];
Module._extensions[".js"] = (module,file) => {
  if (file.includes("node_modules")) return originalLoader(module,file);
  module._compile(babel.transformSync(fs.readFileSync(file,"utf8"),{presets:[["@babel/preset-env",{targets:{node:"current"}}]],babelrc:false,configFile:false}).code,file);
};
async function main() {
  loadEnvConfig(process.cwd());
  if (!process.env.MONGODB_URI || !process.env.MONGODB_DB) throw new Error("Set MONGODB_URI and MONGODB_DB before cleaning up recordings.");
  const { createSocialService } = require("../src/lib/social/server");
  const { bunnyConfig } = require("../src/lib/social/bunny");
  const apply = process.argv.includes("--apply");
  if (apply) bunnyConfig();
  const client = new MongoClient(process.env.MONGODB_URI,{serverSelectionTimeoutMS:10000});
  try {
    await client.connect();
    const api = createSocialService(client.db(process.env.MONGODB_DB));
    const result = await api.cleanupMedia({dryRun:!apply});
    console.log(`${result.processed} abandoned or deleted recordings ${apply ? "processed; failed provider deletions remain queued" : "eligible; use --apply to remove them"}.`);
  } finally { await client.close(); }
}
main().catch(() => { console.error("Media cleanup failed. Check the database and Bunny environment settings.");process.exitCode=1; });
