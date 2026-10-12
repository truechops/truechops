#!/usr/bin/env node
// Explicit provisioning: never connects to a built-in or guessed database.
const { loadEnvConfig } = require("@next/env");
const { MongoClient } = require("mongodb");
const { SEARCH_INDEXES } = require("../src/lib/social/config");
async function main() {
  loadEnvConfig(process.cwd());
  if (!process.env.MONGODB_URI) throw new Error("Set MONGODB_URI and MONGODB_DB in .env.local before provisioning search.");
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB || "drumtoolz");
    for (const spec of SEARCH_INDEXES) {
      if (!await db.listCollections({ name: spec.collection }).hasNext()) await db.createCollection(spec.collection);
      const collection = db.collection(spec.collection);
      const existing = await collection.listSearchIndexes(spec.name).toArray();
      if (existing.length) {
        if (process.argv.includes("--update")) { await collection.updateSearchIndex(spec.name,spec.definition); console.log(`Updated ${spec.collection}/${spec.name}.`); }
        else console.log(`${spec.collection}/${spec.name}: ${existing[0].queryable ? "ready" : existing[0].status}. Use --update to apply definition changes.`);
      } else {
        await collection.createSearchIndex({ name: spec.name, definition: spec.definition });
        console.log(`Created ${spec.collection}/${spec.name}; MongoDB is building it.`);
      }
    }
    console.log("Run this command again to check readiness. Existing rhythms remain private until their owners publish them.");
  } finally { await client.close(); }
}
main().catch((error) => { console.error(error.message.replace(/mongodb(?:\+srv)?:\/\/[^\s]+/g,"[connection string]")); process.exitCode = 1; });
