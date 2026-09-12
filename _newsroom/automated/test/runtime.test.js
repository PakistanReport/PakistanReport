import { test } from "node:test";
import assert from "node:assert/strict";
import { runtime, seed } from "./runtime.js";
import { image, visualMetadata } from "./helpers.js";
import { unpackBatch, pakistanTime } from "../../publisher/src/validation.js";
test(
  "real workerd private HTTP workflow stops at human-approved Publisher ZIP",
  { timeout: 30000 },
  async () => {
    const r = await runtime();
    try {
      assert.equal(
        (await r.mf.dispatchFetch("https://newsroom.example/api/candidates"))
          .status,
        401,
      );
      assert.equal(
        (await r.call("/api/ingest", {}, { Origin: "https://evil.example" }))
          .status,
        403,
      );
      assert.equal(
        (await r.call("/api/ingest", {}, { "X-Newsroom-Action": "" })).status,
        403,
      );
      const id = await seed(r.call);
      let c = await (await r.call("/api/candidates/" + id)).json();
      let response = await r.call("/api/candidates/" + id + "/process", {
        revision: c.revision,
      });
      assert.equal(response.status, 200, await response.clone().text());
      c = await response.json();
      assert(c.draft, JSON.stringify(c));
      assert.equal(c.state, "Needs Attention");
      const metadata = btoa(
        String.fromCharCode(
          ...new TextEncoder().encode(JSON.stringify(visualMetadata)),
        ),
      );
      response = await r.call("/api/candidates/" + id + "/visual", image(), {
        "X-Revision": String(c.revision),
        "X-Visual-Metadata": metadata,
      });
      assert.equal(response.status, 200, await response.clone().text());
      c = await response.json();
      assert.equal(c.state, "Ready for Review", JSON.stringify(c.checks));
      assert.equal(
        (
          await r.call("/api/candidates/" + id + "/export", {
            revision: c.revision,
            schedule: pakistanTime(Date.now() + 3600000),
          })
        ).status,
        409,
      );
      response = await r.call("/api/candidates/" + id + "/approve", {
        revision: c.revision,
        claimIds: c.draft.claims.map((c) => c.id),
        reviewedArticle: true,
        reviewedVisual: true,
      });
      assert.equal(response.status, 200, await response.clone().text());
      const schedule = pakistanTime(Date.now() + 3600000);
      response = await r.call("/api/candidates/" + id + "/export", {
        revision: c.revision,
        schedule,
      });
      assert.equal(response.status, 200, await response.clone().text());
      const zip = new Uint8Array(await response.arrayBuffer());
      assert.equal(unpackBatch(zip).items.length, 1);
      const repeated = await r.call("/api/candidates/" + id + "/export", {
        revision: c.revision,
        schedule,
      });
      assert.deepEqual(new Uint8Array(await repeated.arrayBuffer()), zip);
      const latest = await (await r.call("/api/candidates/" + id)).json();
      assert.equal(latest.state, "Approved");
      assert.equal(r.modelCalls(), 1);
      assert(
        r.calls.every((c) => !c.url.includes("pakistanreportnews.workers.dev")),
      );
      assert(
        r.calls
          .filter((c) => c.url.includes("api.github.com"))
          .every((c) => c.method === "GET"),
      );
      assert.equal((await r.call("/api/publish", {})).status, 404);
    } finally {
      await r.mf.dispose();
    }
  },
);
