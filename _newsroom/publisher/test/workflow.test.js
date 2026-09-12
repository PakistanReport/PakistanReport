import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { Publisher } from "../src/worker.js";
import { FakeGitHub, fixture, state } from "./helpers.js";
function harness() {
  const gh = new FakeGitHub(),
    ctx = state(),
    env = { GITHUB_TOKEN: "server-secret", PUBLISHER_PASSWORD: "a".repeat(40) },
    p = new Publisher(ctx, env);
  const real = globalThis.fetch;
  globalThis.fetch = gh.fetch;
  env.PUBLISHER = { idFromName: (x) => x, get: () => p };
  return { gh, ctx, p, env, restore: () => (globalThis.fetch = real) };
}
async function request(h, path, body, headers = {}) {
  const req = new Request("https://publisher.example" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: "Basic " + btoa("publisher:" + h.env.PUBLISHER_PASSWORD),
      Origin: "https://publisher.example",
      "X-Publisher-Action": "1",
      "Content-Type":
        body instanceof Uint8Array ? "application/zip" : "application/json",
      ...headers,
    },
    body:
      body === undefined
        ? undefined
        : body instanceof Uint8Array
          ? body
          : JSON.stringify(body),
  });
  return worker.fetch(req, h.env);
}
async function due(h, id) {
  const j = h.p.get(id);
  j.next = Date.now() - 1;
  h.p.save(j);
  await h.p.alarm();
  return h.p.get(id);
}
test("upload → review → approve → Publish Now → alarm → atomic GitHub commit; two batches isolated", async () => {
  const h = harness();
  try {
    let r = await request(h, "/api/batches", fixture().zip());
    assert.equal(r.status, 201);
    const b = await r.json();
    r = await request(h, "/api/batches", fixture(60000, "-second").zip());
    assert.equal(r.status, 201);
    const batches = await (await request(h, "/api/batches")).json();
    assert.equal(batches.length, 2);
    const items = batches.find((x) => x.id === b.id).items;
    assert.equal(items.length, 2);
    assert.equal(items[0].status, "Validated");
    assert.equal(items[0].raw, undefined);
    assert.equal(
      (await request(h, "/api/items/" + items[0].id + "/image")).headers.get(
        "Content-Type",
      ),
      "image/png",
    );
    assert.equal(
      (await request(h, "/api/batches/" + b.id + "/approve", {})).status,
      200,
    );
    assert.equal(
      (await request(h, "/api/items/" + items[0].id + "/now", {})).status,
      200,
    );
    const first = await due(h, items[0].id);
    assert.equal(first.status, "Published");
    assert.equal(h.gh.updates, 1);
    const second = await due(h, items[1].id);
    assert.equal(second.status, "Published");
    assert.equal(h.gh.updates, 2);
    await request(h, "/api/items/" + first.id + "/now", {});
    await h.p.alarm();
    assert.equal(h.gh.updates, 2);
    const paths = h.gh.trees.get(h.gh.head).tree.map((x) => x.path);
    assert(paths.includes(first.postPath));
    assert(paths.includes(first.imagePath));
    assert(paths.includes("google75307899b867922a.html"));
    assert.equal(
      h.p.rows("SELECT COUNT(*) AS n FROM jobs WHERE status='Validated'")[0].n,
      2,
    );
  } finally {
    h.restore();
  }
});
test("malformed batch creates no stored jobs; repeated batch is rejected", async () => {
  const h = harness();
  try {
    let f = fixture();
    delete f.files[f.manifest.items[1].image];
    assert.equal((await request(h, "/api/batches", f.zip())).status, 400);
    assert.equal(h.p.rows("SELECT * FROM jobs").length, 0);
    f = fixture();
    assert.equal((await request(h, "/api/batches", f.zip())).status, 201);
    assert.equal((await request(h, "/api/batches", f.zip())).status, 400);
  } finally {
    h.restore();
  }
});
test("unauthenticated, weak secret, CSRF and cross-origin access denied", async () => {
  const h = harness();
  try {
    assert.equal(
      (await request(h, "/", undefined, { Authorization: "" })).status,
      401,
    );
    assert.equal(
      (await request(h, "/api/batches", {}, { Origin: "https://evil.example" }))
        .status,
      403,
    );
    assert.equal(
      (await request(h, "/api/batches", {}, { "X-Publisher-Action": "" }))
        .status,
      403,
    );
    h.env.PUBLISHER_PASSWORD = "short";
    assert.equal((await request(h, "/")).status, 401);
  } finally {
    h.restore();
  }
});
for (const mode of ["lost response", "race", "transient", "permanent", "crash"])
  test("safe recovery: " + mode, async () => {
    const h = harness();
    try {
      await request(h, "/api/batches", fixture().zip());
      const j = JSON.parse(h.p.rows("SELECT data FROM jobs")[0].data);
      await request(h, "/api/items/" + j.id + "/now", {});
      if (mode === "lost response") h.gh.loseResponse = true;
      if (mode === "race") h.gh.race = true;
      if (mode === "transient") h.gh.fail = 1;
      if (mode === "permanent") {
        h.gh.trees
          .get("root")
          .tree.push({ path: j.imagePath, sha: "editor-image" });
      }
      if (mode === "crash") {
        const interrupted = h.p.get(j.id);
        interrupted.status = "Publishing";
        h.p.save(interrupted);
        h.p = new Publisher(h.ctx, h.env);
      }
      let result = await due(h, j.id);
      if (mode === "permanent") {
        assert.equal(result.status, "Failed");
        assert.match(result.error, /overwritten/);
        assert.equal(h.gh.updates, 0);
        return;
      }
      if (mode !== "crash") {
        assert.equal(result.status, "Scheduled");
        result = await due(h, j.id);
      }
      assert.equal(result.status, "Published");
      assert.equal(h.gh.updates, 1);
      const entries = h.gh.trees.get(h.gh.head).tree;
      assert.equal(entries.filter((x) => x.path === j.postPath).length, 1);
      if (mode === "race")
        assert(entries.some((x) => x.path === "unrelated.txt"));
    } finally {
      h.restore();
    }
  });
test("retry exhaustion becomes Failed with retained content", async () => {
  const h = harness();
  try {
    await request(h, "/api/batches", fixture().zip());
    const id = h.p.rows("SELECT id FROM jobs")[0].id;
    await request(h, "/api/items/" + id + "/now", {});
    h.gh.fail = 50;
    let j;
    for (let i = 0; i < 6; i++) j = await due(h, id);
    assert.equal(j.status, "Failed");
    assert.equal(j.attempts, 6);
    assert(h.p.image(id).length);
    assert(j.error);
    assert.equal(h.gh.updates, 0);
  } finally {
    h.restore();
  }
});
test("archive retains audit and reservations; discard only unapproved batches", async () => {
  const h = harness();
  try {
    const b = await (await request(h, "/api/batches", fixture().zip())).json();
    const ids = h.p.rows("SELECT id FROM jobs").map((r) => r.id);
    assert.equal(
      (await request(h, "/api/batches/" + b.id + "/archive", {})).status,
      400,
    );
    for (const id of ids) {
      await request(h, "/api/items/" + id + "/now", {});
      await due(h, id);
    }
    assert.equal(
      (await request(h, "/api/batches/" + b.id + "/archive", {})).status,
      200,
    );
    assert.equal(h.p.rows("SELECT * FROM images").length, 0);
    assert(h.p.get(ids[0]).commit);
    assert.equal(
      (await request(h, "/api/batches/" + b.id + "/discard", {})).status,
      400,
    );
    const second = await (
      await request(h, "/api/batches", fixture(60000, "-discard").zip())
    ).json();
    assert.equal(
      (await request(h, "/api/batches/" + second.id + "/discard", {})).status,
      200,
    );
  } finally {
    h.restore();
  }
});
