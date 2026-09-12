// Read-only, one-shot connector smoke test. No candidates are stored or drafted.
import { SourceClient } from "../src/sources.js";
import { SOURCES } from "../src/registry.js";
import { mkdir, writeFile } from "node:fs/promises";
const client = new SourceClient();
const results = [];
for (const id of ["pbs", "sbp"]) {
  const source = SOURCES.find((s) => s.id === id);
  const start = new Date().toISOString();
  try {
    const result = await client.poll({
      ...source,
      enabled: true,
      restrictionsReviewed: true,
    });
    results.push({
      id,
      url: source.url,
      at: start,
      result: "parsed",
      items: result.observations.length,
      skippedItems: result.skippedItems || 0,
      sourceDates: result.observations.slice(0, 3).map((o) => o.publishedAt),
    });
  } catch (error) {
    results.push({
      id,
      url: source.url,
      at: start,
      result: "blocked",
      reason: error.message,
    });
  }
}
await mkdir("test-output", { recursive: true });
await writeFile(
  "test-output/live-source-results.json",
  JSON.stringify(results, null, 2),
);
console.log(JSON.stringify(results, null, 2));
