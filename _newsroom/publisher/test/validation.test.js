import { test } from "node:test";
import assert from "node:assert/strict";
import { strToU8 } from "fflate";
import { fixture } from "./helpers.js";
import {
  unpackBatch,
  checkCollisions,
  scheduleTime,
  releaseMarkdown,
  validateArticle,
} from "../src/validation.js";
const text = new TextDecoder();
function change(f, from, to) {
  const name = f.manifest.items[0].article;
  f.files[name] = strToU8(text.decode(f.files[name]).replace(from, to));
}
test("valid two-story ZIP and Pakistan schedule", () => {
  const b = unpackBatch(fixture().zip());
  assert.equal(b.items.length, 2);
  assert.equal(b.items[0].category, "Pakistan");
  assert.match(b.items[0].postPath, /^_posts\/\d{4}-\d{2}-\d{2}-/);
});
for (const [name, mutate, pattern] of [
  [
    "missing title",
    (f) => change(f, 'title: "Disposable Publisher Test 1"', 'title: ""'),
    /title/,
  ],
  [
    "category",
    (f) => change(f, 'category: "Pakistan"', 'category: "Sports"'),
    /category/,
  ],
  [
    "duplicate YAML",
    (f) =>
      change(
        f,
        'category: "Pakistan"',
        "category: Pakistan\ncategory: Economy",
      ),
    /YAML/,
  ],
  [
    "malformed YAML",
    (f) => change(f, 'category: "Pakistan"', "category: [Pakistan"),
    /YAML/,
  ],
  ["missing image", (f) => delete f.files[f.manifest.items[0].image], /image/],
  [
    "wrong reference",
    (f) => change(f, 'image: "/assets/images/', 'image: "/images/'),
    /image/,
  ],
  [
    "empty body",
    (f) => {
      const p = f.manifest.items[0].article;
      f.files[p] = strToU8(
        text.decode(f.files[p]).split("---\n\n")[0] + "---\n",
      );
    },
    /body/,
  ],
  [
    "extra file",
    (f) => (f.files["articles/extra.md"] = strToU8("extra")),
    /not listed/,
  ],
  ["traversal", (f) => (f.files["../evil"] = strToU8("bad")), /unsafe/],
  [
    "bad image signature",
    (f) => (f.files[f.manifest.items[0].image] = strToU8("not an image")),
    /contents/,
  ],
  [
    "liquid execution",
    (f) =>
      change(
        f,
        "This is disposable",
        "{% include secret %} This is disposable",
      ),
    /Liquid/,
  ],
  [
    "permalink",
    (f) =>
      change(f, "layout: article", "layout: article\npermalink: /overwrite/"),
    /overrides/,
  ],
  [
    "unclosed fence",
    (f) => change(f, "This is disposable", "```\nThis is disposable"),
    /fence/,
  ],
  [
    "malformed manifest",
    (f) => (f.files["manifest.json"] = strToU8("{")),
    /manifest/,
  ],
])
  test("reject " + name, () => {
    const f = fixture();
    mutate(f);
    assert.throws(() => unpackBatch(f.zip()), pattern);
  });
test("invalid calendar, missing offset, impossible hours", () => {
  for (const x of [
    "2026-02-30T10:00:00+05:00",
    "2026-09-12T10:00:00Z",
    "2026-09-12T25:00:00+05:00",
  ])
    assert.throws(() => scheduleTime(x));
});
test("duplicate article and slug", () => {
  const f = fixture();
  f.manifest.items[1] = f.manifest.items[0];
  f.files["manifest.json"] = strToU8(JSON.stringify(f.manifest));
  assert.throws(() => unpackBatch(f.zip()), /Duplicate article/);
});
test("duplicate slug across dates", () => {
  const f = fixture();
  const e = f.manifest.items[1],
    old = e.article;
  e.article = f.manifest.items[0].article.replace(
    /\d{4}-\d{2}-\d{2}/,
    new Date(Date.parse(f.manifest.items[0].schedule) + 86400000 + 5*3600000).toISOString().slice(0,10),
  );
  e.schedule = e.article.slice(9,19) + "T10:00:00+05:00";
  f.files[e.article] = f.files[old];
  delete f.files[old];
  f.files["manifest.json"] = strToU8(JSON.stringify(f.manifest));
  assert.throws(
    () => unpackBatch(f.zip()),
    /Duplicate slug/,
  );
});
test("published slug, image and queued reservations block overwrites", () => {
  const b = unpackBatch(fixture().zip());
  const item = b.items[0];
  for (const tree of [
    { tree: [{ path: item.postPath }] },
    { tree: [{ path: item.imagePath }] },
    { tree: [{ path: "_posts/2020-01-01-" + item.slug + ".md" }] },
    { tree: [], truncated: true },
  ])
    assert.throws(() => checkCollisions([item], tree));
  assert.throws(() => checkCollisions([item], { tree: [] }, [item]));
});
test("release preserves body and sets explicit Pakistan date", () => {
  const item = unpackBatch(fixture().zip()).items[0];
  const raw = releaseMarkdown(item, Date.parse("2026-09-12T20:01:02Z"));
  assert.match(raw, /date: 2026-09-13 01:01:02 \+0500/);
  assert.equal(raw.split("---\n")[2], item.raw.split("---\n")[2]);
});
test("front matter date must agree with manifest", () => {
  const f = fixture();
  change(
    f,
    "layout: article",
    "layout: article\ndate: 2026-01-01 12:00:00 +0500",
  );
  assert.throws(() => unpackBatch(f.zip()), /match schedule/);
});
test("invalid article slug and missing timezone rejected", () => {
  const f = fixture();
  f.manifest.items[0].article = "articles/2026-09-12-Bad_Slug.md";
  f.files[f.manifest.items[0].article] = Object.values(f.files)[0];
  f.files["manifest.json"] = strToU8(JSON.stringify(f.manifest));
  assert.throws(() => unpackBatch(f.zip()), /unsafe ZIP path|lowercase-slug/);
  const g = fixture();
  delete g.manifest.timezone;
  g.files["manifest.json"] = strToU8(JSON.stringify(g.manifest));
  assert.throws(() => unpackBatch(g.zip()), /timezone/);
});
test("corrupt or truncated PNG rejected", () => {
  for (const kind of ["crc", "short"]) {
    const f = fixture(),
      p = f.manifest.items[0].image;
    f.files[p] = f.files[p].slice();
    if (kind === "crc") f.files[p][30] ^= 1;
    else f.files[p] = f.files[p].slice(0, -10);
    assert.throws(() => unpackBatch(f.zip()), /PNG/);
  }
});
test("quoted YAML date replaced exactly once", () => {
  const item = unpackBatch(fixture().zip()).items[0];
  item.raw = item.raw.replace(
    "layout: article",
    'layout: article\n"date": ' + item.entry.schedule,
  );
  const release = releaseMarkdown(item, item.due);
  assert.equal((release.match(/date/g) || []).length, 1);
});
