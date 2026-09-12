import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SourceClient,
  parseSource,
  robotsAllowed,
  validateSource,
} from "../src/sources.js";
import { sources, NOW } from "./fixtures/events.js";
import { harness } from "./helpers.js";
import { modelProvider, SYSTEM } from "../src/provider.js";
const feed =
  '<rss version="2.0"><channel><title>Fixture</title><item><title>Pakistan policy rate cut announced</title><link>https://sbp.example/decision</link><pubDate>Sat, 12 Sep 2026 06:00:00 GMT</pubDate><description>National central bank decision effective immediately.</description></item></channel></rss>';
test("RSS ingestion yields provenance and conditional requests respect interval", async () => {
  let calls = [];
  const client = new SourceClient(async (url, options) => {
    calls.push([url, options]);
    return new Response(
      url.endsWith("robots.txt") ? "User-agent: *\nAllow: /" : feed,
      { headers: { etag: '"one"', "Content-Type": "application/rss+xml" } },
    );
  });
  const result = await client.poll(sources[0], {}, NOW);
  assert.equal(result.observations.length, 1);
  assert(result.observations[0].contentHash);
  assert.equal(result.observations[0].sourceSnapshot.role, "primary");
  assert.equal(result.etag, '"one"');
  assert.equal(
    (await client.poll(sources[0], result, NOW + 1000)).skipped,
    true,
  );
  assert.equal(calls.length, 2);
});
test("304 does not create observations and sends ETag", async () => {
  let received;
  const client = new SourceClient(async (url, options) => {
    if (url.endsWith("robots.txt")) return new Response("", { status: 404 });
    received = options.headers;
    return new Response(null, { status: 304 });
  });
  const result = await client.poll(sources[0], { etag: "abc" }, NOW);
  assert.equal(result.observations.length, 0);
  assert.equal(received["If-None-Match"], "abc");
});
test("Atom feed and filtered primary HTML index connectors", () => {
  const atom =
    '<feed><entry><title>Pakistan inflation data release</title><link href="https://sbp.example/data"/><updated>2026-09-12T06:00:00Z</updated><summary>Primary data</summary></entry></feed>';
  assert.equal(parseSource(atom, { ...sources[0], type: "atom" }).length, 1);
  const html =
    '<a href="/press/decision">Pakistan benchmark policy decision announced</a><a href="/contact">Contact the institution newsroom</a>';
  const result = parseSource(html, {
    ...sources[0],
    type: "html-index",
    linkPattern: "/press/",
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].publishedAt, null);
});
test("reporting connector retains headlines/links only", () => {
  const result = parseSource(feed, sources[1]);
  assert.equal(result[0].summary, "");
});
test("malformed XML and external entity payloads rejected", () => {
  for (const xml of [
    "<rss><oops></rss>",
    '<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss/>',
  ])
    assert.throws(() => parseSource(xml, sources[0]));
});
test("source disabled, excessive polling and unreviewed restrictions rejected", async () => {
  const client = new SourceClient(() => {
    throw Error("must not fetch");
  });
  await assert.rejects(
    client.poll({ ...sources[0], enabled: false }),
    /disabled/,
  );
  assert.throws(
    () => validateSource({ ...sources[0], intervalMinutes: 1 }),
    /interval/,
  );
  assert.throws(
    () => validateSource({ ...sources[0], restrictionsReviewed: false }),
    /restrictions/,
  );
});
test("robots allow/disallow and specific user-agent groups are respected", () => {
  assert(
    !robotsAllowed(
      "User-agent: *\nDisallow: /private",
      "https://sbp.example/private/a",
    ),
  );
  assert(
    robotsAllowed(
      "User-agent: *\nDisallow: /\nAllow: /feed",
      "https://sbp.example/feed",
    ),
  );
  assert(
    !robotsAllowed(
      "User-agent: PakistanReportNewsroom\nDisallow: /\nUser-agent: *\nAllow: /",
      "https://sbp.example/feed",
    ),
  );
});
test("disallowed robots blocks the actual source request", async () => {
  let calls = 0;
  const client = new SourceClient(async () => {
    calls++;
    return new Response("User-agent: *\nDisallow: /");
  });
  await assert.rejects(client.poll(sources[0], {}, NOW), /disallows/);
  assert.equal(calls, 1);
});
test("cross-domain redirects are not followed", async () => {
  const client = new SourceClient(
    async () =>
      new Response(null, {
        status: 302,
        headers: { Location: "https://evil.example" },
      }),
  );
  await assert.rejects(client.poll(sources[0], {}, NOW), /redirected/);
});
test("source failure creates retained error and retry deadline", async () => {
  const s = harness({
    client: new SourceClient(
      async () => new Response("error", { status: 503 }),
    ),
  });
  await assert.rejects(s.poll("sbp-fixture"));
  const meta = s.source("sbp-fixture").poll;
  assert.equal(meta.failures, 1);
  assert(meta.error.includes("503"));
  assert(meta.nextPollAt > NOW);
});
test("PDF and newspaper full-text fetching require manual evidence", async () => {
  const client = new SourceClient(() => {
    throw Error("must not fetch");
  });
  await assert.rejects(
    client.document({ url: "https://sbp.example/file.pdf" }, sources[0]),
    /PDF/,
  );
  await assert.rejects(
    client.document({ url: "https://wire.example/news" }, sources[1]),
    /primary/,
  );
});
test("oversized feed response fails before parsing", async () => {
  const client = new SourceClient(
    async (url) =>
      new Response(
        url.endsWith("/robots.txt")
          ? "User-agent: *\nAllow: /"
          : "x".repeat(1024 * 1024 + 1),
      ),
  );
  await assert.rejects(client.poll(sources[0], {}, NOW), /size/);
});
test("model provider is disabled without configuration and never invents a draft", async () => {
  await assert.rejects(modelProvider({})({}), /disabled/);
});
test("OpenAI-compatible adapter uses untrusted-source instructions and parses structured result", async () => {
  let seen;
  const result = await modelProvider(
    {
      DRAFT_PROVIDER: "openai-compatible",
      MODEL_API_KEY: "fake-private-secret",
      MODEL_NAME: "fixture",
      MODEL_ENDPOINT: "https://model.example/v1/chat/completions",
      MODEL_ALLOWED_HOSTS: "model.example",
    },
    async (url, options) => {
      seen = options;
      return Response.json({
        choices: [
          { message: { content: JSON.stringify({ headline: "test" }) } },
        ],
      });
    },
  )({ id: "fixture", observations: [], selection: {} });
  assert.equal(result.headline, "test");
  const payload = JSON.parse(seen.body);
  assert(payload.messages[0].content.includes("untrusted"));
  assert(payload.messages[0].content.includes("HUMAN REVIEW ONLY"));
  assert(!payload.tools);
  assert.equal(seen.redirect, "manual");
});
test("unapproved model host and malformed response rejected", async () => {
  const config = {
    DRAFT_PROVIDER: "openai-compatible",
    MODEL_API_KEY: "fake",
    MODEL_NAME: "fixture",
    MODEL_ENDPOINT: "https://model.example/v1/chat/completions",
    MODEL_ALLOWED_HOSTS: "other.example",
  };
  await assert.rejects(modelProvider(config)({}), /approved/);
  config.MODEL_ALLOWED_HOSTS = "model.example";
  await assert.rejects(
    modelProvider(config, async () =>
      Response.json({ choices: [{ message: { content: "bad-json" } }] }),
    )({ observations: [] }),
    /Malformed/,
  );
});
test('source crawl-delay lengthens interval and prevents immediate document crawl',async()=>{const client=new SourceClient(async url=>new Response(url.endsWith('robots.txt')?'User-agent: *\nCrawl-delay: 7200\nAllow: /':feed));const result=await client.poll(sources[0],{},NOW);assert.equal(result.nextPollAt,NOW+7200000);await assert.rejects(client.document({url:'https://sbp.example/document'},sources[0]),/crawl-delay/);});
test('HTML robots challenge does not silently permit source crawling',async()=>{let calls=0;const client=new SourceClient(async()=>{calls++;return new Response('<html>Access challenge</html>');});await assert.rejects(client.poll(sources[0],{},NOW),/HTML/);assert.equal(calls,1);});
