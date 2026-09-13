// One-shot discovery diagnostics. Never enables a source or invents a review.
// No candidates, evidence, models, Publisher or publication calls are involved.
import { SourceClient, validateSource } from "../src/sources.js";
import { SOURCES } from "../src/registry.js";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export async function probeSources(sources = SOURCES, client = new SourceClient()) {
  const results = [];
  for (const source of sources) {
    const base = {id:source.id, url:source.url, at:new Date().toISOString()};
    if (!source.enabled || source.type === "manual") {
      results.push({...base,result:"disabled",reason:source.disabledReason || "Source disabled or manual-only"});
      continue;
    }
    try {
      validateSource(source);
      const result = await client.poll(source);
      results.push({...base,result:"parsed",items:result.observations.length,
        skippedItems:result.skippedItems || 0,
        sourceDates:result.observations.slice(0,3).map(o=>o.publishedAt)});
    } catch (error) {
      results.push({...base,result:"blocked",reason:error.message});
    }
  }
  return results;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const results = await probeSources();
  await mkdir("test-output", {recursive:true});
  await writeFile("test-output/live-source-results.json", JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));
}
