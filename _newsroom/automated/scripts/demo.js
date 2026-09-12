// Local demonstration only. Model/source responses are synthetic; no real source polling.
import { runtime, seed, PASSWORD } from "../test/runtime.js";
import { image, visualMetadata } from "../test/helpers.js";
import { sources, routine } from "../test/fixtures/events.js";
import { pakistanTime } from "../../publisher/src/validation.js";
const r = await runtime();
const id = await seed(r.call);
let c = await (await r.call("/api/candidates/" + id)).json();
c = await (
  await r.call("/api/candidates/" + id + "/process", { revision: c.revision })
).json();
const metadata = btoa(
  String.fromCharCode(
    ...new TextEncoder().encode(JSON.stringify(visualMetadata)),
  ),
);
const uploaded = await r.call("/api/candidates/" + id + "/visual", image(), {
  "X-Revision": String(c.revision),
  "X-Visual-Metadata": metadata,
});
if (!uploaded.ok) throw Error(await uploaded.text());
await r.call("/api/ingest", {
  sourceId: sources[0].id,
  items: [
    { ...routine, publishedAt: new Date(Date.now() - 3600000).toISOString() },
  ],
});
console.log(
  "LOCAL SYNTHETIC DEMO — not live reporting. No public publication capability.",
);
console.log("Open: " + (await r.mf.ready).origin);
console.log("Username: editor");
console.log("Temporary local password: " + PASSWORD);
console.log(
  "One worthwhile fixture is Ready for Review; one routine MoU fixture is Rejected.",
);
console.log(
  "Review evidence, attest to claims, approve and download the ZIP. Do not upload demo stories to the live Publisher.",
);
console.log(
  "A valid Pakistan schedule for package testing: " +
    pakistanTime(Date.now() + 3600000),
);
console.log(
  "Ctrl+C stops the local demonstration and discards its temporary data.",
);
process.on("SIGINT", async () => {
  await r.mf.dispose();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await r.mf.dispose();
  process.exit(0);
});
