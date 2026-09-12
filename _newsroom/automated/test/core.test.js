import { test } from "node:test";
import assert from "node:assert/strict";
import {
  harness,
  completeVisual,
  approve,
  image,
  visualMetadata,
} from "./helpers.js";
import {
  important,
  sameEvent,
  routine,
  sensitive,
  sensitiveWire,
  sensitiveReport,
  insufficient,
  NOW,
  documents,
  economyDraft,
} from "./fixtures/events.js";
import { unpackBatch } from "../../publisher/src/validation.js";
import { NewsroomError } from "../src/common.js";
async function ready() {
  const s = harness();
  const [{ id }] = await s.ingest("sbp-fixture", [important]);
  let c = await s.process(id);
  c = await completeVisual(s, c);
  return { s, c };
}
test("full source → selection → research → original draft → checks → human approval → Publisher-valid ZIP", async () => {
  const { s, c } = await ready();
  assert.equal(c.state, "Ready for Review");
  assert.equal(c.checks.wordCount, 432);
  assert(c.observations[0].document.text);
  assert(c.history.some((h) => h.action === "Research started"));
  assert(c.history.some((h) => h.action.includes("Draft generated")));
  const approved = approve(s, c);
  assert.equal(approved.state, "Approved");
  const bytes = await s.export(c.id, c.revision, "2026-09-12T18:00:00+05:00");
  const batch = unpackBatch(bytes, NOW);
  assert.equal(batch.items.length, 1);
  assert.equal(batch.items[0].category, "Economy");
  assert.match(batch.items[0].raw, /## What happened/);
  assert.match(batch.items[0].raw, /## Sources/);
  assert.equal(s.get(c.id).state, "Approved");
  assert(s.get(c.id).export);
});
test("routine MoU/ceremonial PR is rejected with negative ranking reason", async () => {
  const s = harness();
  const [{ id }] = await s.ingest("sbp-fixture", [routine]);
  const c = s.get(id);
  assert.equal(c.state, "Rejected");
  assert(c.selection.score < 65);
  assert(c.selection.factors.some((f) => f.points < 0));
  await assert.rejects(s.process(id), /eligible/);
});
test("two independent sources for same event form one candidate", async () => {
  const s = harness();
  const [a] = await s.ingest("sbp-fixture", [important]);
  const [b] = await s.ingest("wire-fixture", [sameEvent]);
  assert.equal(a.id, b.id);
  assert.equal(s.list().length, 1);
  assert.equal(s.get(a.id).observations.length, 2);
  assert(
    s
      .get(a.id)
      .selection.factors.some((f) => f.name === "Independent source groups"),
  );
});
test("duplicate source delivery is idempotent", async () => {
  const s = harness();
  const [a] = await s.ingest("sbp-fixture", [important]);
  const [b] = await s.ingest("sbp-fixture", [important]);
  assert(b.duplicate);
  assert.equal(a.id, b.id);
  assert.equal(s.get(a.id).observations.length, 1);
});
test("changed timestamp and text invalidate prior human approval", async () => {
  const { s, c } = await ready();
  approve(s, c);
  await s.ingest("sbp-fixture", [
    {
      ...important,
      summary: important.summary + " The statement was revised.",
    },
  ]);
  const changed = s.get(c.id);
  assert.equal(changed.approval, undefined);
  assert.notEqual(changed.state, "Approved");
  await assert.rejects(
    s.export(c.id, c.revision, "2026-09-12T18:00:00+05:00"),
    /Stale/,
  );
});
test("sensitive conflicts remain explicit and require review note and two source groups", async () => {
  const s = harness();
  const [{ id }] = await s.ingest("court-fixture", [sensitive]);
  await s.ingest("wire-fixture", [sensitiveWire]);
  await s.ingest("report-fixture", [sensitiveReport]);
  let c = await s.process(id);
  assert.equal(c.state, "Needs Attention");
  assert.equal(c.checks.risk.level, "SENSITIVE");
  assert(c.checks.risk.conflicts.length);
  const wire = c.observations.find((o) => o.sourceId === "wire-fixture");
  c = await s.evidence(id, c.revision, wire.id, {
    text: documents[wire.url],
    editorConfirmed: true,
    note: "Fixture editor checked the synthetic original source and both conflicting totals.",
  });
  c = await completeVisual(s, c);
  assert.equal(
    c.state,
    "Ready for Review",
    JSON.stringify(c.checks.checks.filter((x) => !x.pass)),
  );
  assert.throws(() => approve(s, c), /Sensitive/);
  const accepted = approve(
    s,
    c,
    "Reviewed both competing totals, preserved attribution, and confirmed that the procedural order does not decide the merits.",
  );
  assert.equal(accepted.state, "Approved");
});
test("insufficiently sourced discovery cannot become publishable", async () => {
  const s = harness({
    provider: async () => ({ needsAttention: "no primary" }),
  });
  const [{ id }] = await s.ingest("wire-fixture", [insufficient]);
  let c = s.get(id);
  assert(c.selection.advance);
  c = await s.process(id);
  assert.equal(c.state, "Needs Attention");
  assert(!c.approval);
  assert.throws(
    () =>
      s.approve(id, c.revision, {
        claimIds: [],
        reviewedArticle: true,
        reviewedVisual: true,
      }),
    /checks/,
  );
});
test("unsupported claim and fabricated numeric value block approval", async () => {
  const { s, c } = await ready();
  const d = structuredClone(c.draft);
  d.claims[0].text = "The policy rate was cut by 999 basis points.";
  let edited = s.edit(c.id, c.revision, d);
  assert.equal(edited.state, "Needs Attention");
  assert(edited.checks.verification.errors.some((x) => x.includes("999")));
  assert.throws(() => approve(s, edited), /checks/);
});
test("fabricated quotation provenance cannot pass", async () => {
  const { s, c } = await ready();
  const d = structuredClone(c.draft);
  d.claims[0].evidence[0].quote =
    "This fabricated official quotation does not exist.";
  const changed = s.edit(c.id, c.revision, d);
  assert.equal(changed.state, "Needs Attention");
  assert(
    changed.checks.verification.errors.some((x) => x.includes("not present")),
  );
});
test("headline/body inconsistency, category and missing paragraph evidence block readiness", async () => {
  const { s, c } = await ready();
  const d = structuredClone(c.draft);
  d.headline = "A completely unrelated championship football victory";
  d.category = "Sports";
  d.paragraphs[0].claimIds = [];
  const changed = s.edit(c.id, c.revision, d);
  for (const name of [
    "Headline/body consistency",
    "Category validity",
    "Paragraph claim coverage",
  ])
    assert(changed.checks.checks.find((x) => x.name === name).pass === false);
});
test("near-duplicate published coverage blocks approval", async () => {
  const { s, c } = await ready();
  s.setSetting("coverage", [{ title: c.draft.headline, slug: c.draft.slug }]);
  assert.throws(() => approve(s, c), /checks/);
});
test("stale published index prevents approval", async () => {
  const { s, c } = await ready();
  s.setSetting("coverageMeta", { at: NOW - 25 * 3600000 });
  assert.throws(() => approve(s, c), /checks/);
});
test("missing illustration blocks Ready; malformed visual rejected", async () => {
  const s = harness();
  const [{ id }] = await s.ingest("sbp-fixture", [important]);
  const c = await s.process(id);
  assert.equal(c.state, "Needs Attention");
  assert.equal(c.visual.status, "Awaiting visual");
  await assert.rejects(
    s.visual(id, c.revision, new Uint8Array([1, 2, 3]), visualMetadata),
  );
});
test("explicit rejection cannot export; reopening rechecks and invalidates approvals", async () => {
  const { s, c } = await ready();
  const rejected = s.reject(
    c.id,
    c.revision,
    "Not proceeding with this synthetic test story",
  );
  assert.equal(rejected.state, "Rejected");
  await assert.rejects(
    s.export(c.id, c.revision, "2026-09-12T18:00:00+05:00"),
    /approval/,
  );
  const reopened = s.reopen(c.id, c.revision);
  assert(reopened.revision > c.revision);
  assert.equal(reopened.approval, undefined);
});
test("approval requires all human attestations and current revision", async () => {
  const { s, c } = await ready();
  assert.throws(
    () =>
      s.approve(c.id, c.revision, {
        claimIds: [],
        reviewedArticle: true,
        reviewedVisual: true,
      }),
    /every/,
  );
  assert.throws(() => s.approve(c.id, c.revision - 1, {}), /changed/);
  assert.throws(
    () =>
      s.approve(c.id, c.revision, {
        claimIds: c.draft.claims.map((c) => c.id),
        reviewedArticle: false,
        reviewedVisual: true,
      }),
    /review/,
  );
});
test("repeat package export is byte-identical; changed schedule blocked; no automatic handoff claim", async () => {
  const { s, c } = await ready();
  approve(s, c);
  const time = "2026-09-12T18:00:00+05:00";
  const a = await s.export(c.id, c.revision, time),
    b = await s.export(c.id, c.revision, time);
  assert.deepEqual(a, b);
  await assert.rejects(
    s.export(c.id, c.revision, "2026-09-12T19:00:00+05:00"),
    /immutable/,
  );
  assert.equal(s.get(c.id).state, "Approved");
  const sent = s.handoff(
    c.id,
    c.revision,
    "12345678-1234-1234-1234-123456789abc",
  );
  assert.equal(sent.state, "Sent to Publisher");
  assert.equal(sent.handoff.verifiedRemotely, false);
});
test("changed evidence after export locks a second delivery", async () => {
  const { s, c } = await ready();
  approve(s, c);
  await s.export(c.id, c.revision, "2026-09-12T18:00:00+05:00");
  await s.ingest("sbp-fixture", [
    { ...important, summary: important.summary + " Revised details." },
  ]);
  const updated = s.get(c.id);
  assert(updated.deliveryLocked);
  assert.throws(() => approve(s, updated), /already exported/);
});
test("transient provider retry retains errors and completes idempotently", async () => {
  let calls = 0;
  const s = harness({
    provider: async (c) => {
      if (++calls === 1)
        throw new NewsroomError("Temporary provider error", 503, true);
      return economyDraft(c);
    },
  });
  const [{ id }] = await s.ingest("sbp-fixture", [important]);
  let c = await s.process(id);
  assert.equal(c.state, "Needs Attention");
  assert(c.retryable && c.nextAttempt);
  c = await s.process(id);
  assert(c.draft);
  await s.process(id);
  assert.equal(calls, 2);
  assert(c.history.some((h) => h.action.includes("Temporary")));
});
test("retry exhaustion is visible and bounded", async () => {
  const s = harness({
    provider: async () => {
      throw new NewsroomError("temporary", 503, true);
    },
  });
  const [{ id }] = await s.ingest("sbp-fixture", [important]);
  let c;
  for (let i = 0; i < 4; i++) c = await s.process(id);
  assert.equal(c.state, "Needs Attention");
  assert.equal(c.attempts, 3);
  assert.equal(c.retryable, false);
  assert.match(c.lastError, /retry limit/);
});
test("malformed import is atomic and untrusted source URL cannot escape allowlist", async () => {
  const s = harness();
  await assert.rejects(s.ingest("sbp-fixture", [important, { title: "bad" }]));
  assert.equal(s.list().length, 0);
  await assert.rejects(
    s.ingest("sbp-fixture", [{ ...important, url: "https://evil.example/" }]),
    /allowlist/,
  );
});
test("malformed draft does not corrupt stored candidate", async () => {
  const { s, c } = await ready();
  assert.throws(() =>
    s.edit(c.id, c.revision, { headline: "bad", claims: {} }),
  );
  assert.equal(s.get(c.id).revision, c.revision);
});
test("editor can split a mistaken event cluster and preserve provenance", async () => {
  const s = harness();
  const [{ id }] = await s.ingest("sbp-fixture", [important]);
  await s.ingest("wire-fixture", [sameEvent]);
  const c = s.get(id);
  const split = s.split(id, c.revision, c.observations[1].id);
  assert.notEqual(split.id, id);
  assert.equal(s.get(id).observations.length, 1);
  assert.equal(split.observations.length, 1);
});

test("new corroboration remains eligible for scheduled research", async () => {
  const s = harness();
  const [{ id }] = await s.ingest("sbp-fixture", [important]);
  await s.ingest("wire-fixture", [sameEvent]);
  assert.equal(s.get(id).state, "Detected");
  assert((await s.process(id)).draft);
});
test("new sources cannot revive an editor-rejected candidate", async () => {
  const s = harness();
  const [{ id }] = await s.ingest("sbp-fixture", [important]);
  s.reject(id, s.get(id).revision, "Not appropriate for coverage");
  await s.ingest("wire-fixture", [sameEvent]);
  assert.equal(s.get(id).state, "Rejected");
});
test("changed evidence requeues research and clears obsolete retry state", async () => {
  const { s, c } = await ready();
  c.retryable = true; c.nextAttempt = 1; c.attempts = 3;
  s.save(c);
  await s.ingest("wire-fixture", [sameEvent]);
  const updated = s.get(c.id);
  assert.equal(updated.state, "Detected");
  assert.equal(updated.draft, undefined);
  assert.equal(updated.retryable, false);
  assert.equal(updated.nextAttempt, undefined);
  assert.equal(updated.attempts, 0);
});
