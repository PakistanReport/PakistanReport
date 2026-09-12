import { assert, NewsroomError, sha, text, similarity } from "./common.js";
import { SOURCES } from "./registry.js";
import {
  SourceClient,
  normalizeObservation,
  validateSource,
} from "./sources.js";
import {
  rank,
  sameEvent,
  riskFor,
  editorialChecks,
  visualBrief,
  validateDraftShape,
} from "./editorial.js";
import { imageType } from "../../publisher/src/validation.js";
import { makePackage } from "./package.js";
export class Service {
  constructor(
    storage,
    {
      sources = SOURCES,
      client = new SourceClient(),
      provider = null,
      now = () => Date.now(),
    } = {},
  ) {
    this.storage = storage;
    this.sql = storage.sql;
    this.client = client;
    this.provider = provider;
    this.now = now;
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS sources (id TEXT PRIMARY KEY, data TEXT NOT NULL, poll TEXT NOT NULL)",
    );
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS observations (id TEXT PRIMARY KEY, candidate TEXT NOT NULL, url TEXT NOT NULL, hash TEXT NOT NULL)",
    );
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS candidates (id TEXT PRIMARY KEY, state TEXT NOT NULL, updated INTEGER NOT NULL, data TEXT NOT NULL)",
    );
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS assets (id TEXT NOT NULL, kind TEXT NOT NULL, part INTEGER NOT NULL, bytes BLOB NOT NULL, PRIMARY KEY(id,kind,part))",
    );
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, data TEXT NOT NULL)",
    );
    for (const s of sources)
      this.sql.exec(
        "INSERT OR IGNORE INTO sources VALUES (?,?,?)",
        s.id,
        JSON.stringify(s),
        "{}",
      );
  }
  rows(sql, ...args) {
    return [...this.sql.exec(sql, ...args)];
  }
  sources() {
    return this.rows("SELECT data,poll FROM sources").map((r) => ({
      ...JSON.parse(r.data),
      poll: JSON.parse(r.poll),
    }));
  }
  source(id) {
    const s = this.sources().find((s) => s.id === id);
    assert(s, "Unknown source");
    return s;
  }
  list() {
    return this.rows("SELECT data FROM candidates ORDER BY updated DESC").map(
      (r) => JSON.parse(r.data),
    );
  }
  get(id) {
    const r = this.rows("SELECT data FROM candidates WHERE id=?", id)[0];
    assert(r, "Candidate not found", 404);
    return JSON.parse(r.data);
  }
  save(c) {
    c.updated = this.now();
    this.sql.exec(
      "INSERT INTO candidates VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state,updated=excluded.updated,data=excluded.data",
      c.id,
      c.state,
      c.updated,
      JSON.stringify(c),
    );
  }
  audit(c, action, actor = "system") {
    c.history.push({ at: this.now(), actor, action, revision: c.revision });
    c.history = c.history.slice(-100);
  }
  transition(c, state, action, actor = "system") {
    c.state = state;
    this.audit(c, action, actor);
    this.save(c);
  }
  setting(key, fallback = null) {
    const r = this.rows("SELECT data FROM settings WHERE key=?", key)[0];
    return r ? JSON.parse(r.data) : fallback;
  }
  setSetting(key, data) {
    this.sql.exec(
      "INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data",
      key,
      JSON.stringify(data),
    );
  }
  sourceUpdate(s) {
    validateSource(s);
    assert(!("poll" in s), "Poll metadata is managed by the server");
    this.sql.exec(
      "INSERT INTO sources VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
      s.id,
      JSON.stringify(s),
      "{}",
    );
  }
  coverage(c) {
    return [
      ...this.setting("coverage", []),
      ...this.list()
        .filter(
          (other) =>
            other.id !== c.id && other.draft && other.state !== "Rejected",
        )
        .map((other) => ({
          id: other.id,
          title: other.draft.headline,
          slug: other.draft.slug,
        })),
    ];
  }
  check(c) {
    c.checks = editorialChecks(c, this.sources(), this.coverage(c), this.now());
    const coverageMeta = this.setting("coverageMeta");
    const coverageOK = Boolean(
      coverageMeta && this.now() - coverageMeta.at <= 24 * 3600000,
    );
    c.checks.checks.push({
      name: "Published coverage index",
      pass: coverageOK,
      detail:
        "Refresh the published article index at least every 24 hours before approval/export.",
    });
    c.checks.passed = c.checks.passed && coverageOK;
    if (!["Approved", "Rejected", "Sent to Publisher"].includes(c.state))
      c.state = c.checks.passed ? "Ready for Review" : "Needs Attention";
    return c.checks;
  }
  invalidate(c, reason) {
    c.revision++;
    delete c.approval;
    delete c.nextAttempt;
    c.retryable = false;
    c.attempts = 0;
    c.deliveryLocked = Boolean(c.export || c.handoff || c.deliveryLocked);
    c.state = "Needs Attention";
    this.audit(c, reason);
  }
  async ingest(sourceId, items) {
    const s = this.source(sourceId);
    assert(
      Array.isArray(items) && items.length > 0 && items.length <= 30,
      "Import 1–30 source items",
    );
    // Normalize every item before any mutation; malformed packages never partly ingest.
    const normalized = await Promise.all(
      items.map((item) => normalizeObservation(item, s, this.now())),
    );
    const out = [];
    this.storage.transactionSync(() => {
      for (const obs of normalized) {
        const existing = this.rows(
          "SELECT candidate FROM observations WHERE id=?",
          obs.id,
        )[0];
        if (existing) {
          out.push({ id: existing.candidate, duplicate: true });
          continue;
        }
        const all = this.list();
        const sameURL = this.rows(
          "SELECT candidate FROM observations WHERE url=? ORDER BY rowid DESC LIMIT 1",
          obs.url,
        )[0];
        let candidate = sameURL
          ? this.get(sameURL.candidate)
          : all.find((c) => c.observations.some((o) => sameEvent(o, obs)));
        if (candidate) {
          assert(
            candidate.observations.length < 12,
            "Candidate source cap reached; split the event for further research",
          );
          candidate.observations.push(obs);
          this.invalidate(
            candidate,
            "New or changed source evidence; earlier approval invalidated",
          );
        } else {
          candidate = {
            id: obs.id.slice(0, 24),
            state: "Detected",
            revision: 1,
            observations: [obs],
            history: [],
            created: this.now(),
            updated: this.now(),
            attempts: 0,
            simulation:
              obs.url.includes(".example") || obs.url.includes(".invalid"),
          };
          this.audit(candidate, "New event detected");
        }
        candidate.selection = rank(
          candidate.observations,
          this.sources(),
          this.now(),
        );
        candidate.risk = riskFor(candidate, candidate.draft?.claims);
        if (candidate.rejectedBy === "editor") {
          candidate.state = "Rejected";
          this.audit(candidate, "New source retained; editor rejection remains in force");
        } else if (!candidate.selection.advance) {
          candidate.rejectedBy = "system";
          candidate.state = "Rejected";
          this.audit(
            candidate,
            "Below newsworthiness threshold: " + candidate.selection.score,
          );
        }
        if (candidate.selection.advance && candidate.rejectedBy !== "editor" && !candidate.deliveryLocked) {
          delete candidate.rejectedBy;
          delete candidate.draft;
          delete candidate.processedRevision;
          delete candidate.checks;
          candidate.state = "Detected";
        }
        this.save(candidate);
        this.sql.exec(
          "INSERT INTO observations VALUES (?,?,?,?)",
          obs.id,
          candidate.id,
          obs.url,
          obs.contentHash,
        );
        out.push({ id: candidate.id, duplicate: false });
      }
    });
    return out;
  }
  async poll(id) {
    const s = this.source(id);
    try {
      const result = await this.client.poll(s, s.poll, this.now());
      if (result.skipped) return result;
      let items = [];
      if (result.observations?.length)
        items = await this.ingest(id, result.observations);
      const { observations, ...poll } = result;
      this.sql.exec(
        "UPDATE sources SET poll=? WHERE id=?",
        JSON.stringify({ ...poll, failures: 0, error: null }),
        id,
      );
      return { ...poll, items };
    } catch (e) {
      const failures = (s.poll.failures || 0) + 1;
      this.sql.exec(
        "UPDATE sources SET poll=? WHERE id=?",
        JSON.stringify({
          ...s.poll,
          lastPollAt: this.now(),
          nextPollAt:
            this.now() +
            Math.max(
              s.intervalMinutes * 60000,
              Math.min(24 * 3600000, 60000 * 2 ** Math.min(failures, 10)),
            ),
          failures,
          error: e.message.slice(0, 600),
        }),
        id,
      );
      throw e;
    }
  }
  async process(id) {
    let c = this.get(id);
    assert(
      !["Rejected", "Approved", "Sent to Publisher"].includes(c.state),
      "Candidate is not eligible for processing",
      409,
    );
    if (c.draft && c.processedRevision === c.revision) {
      this.check(c);
      this.save(c);
      return c;
    }
    assert(
      c.selection.advance,
      "Candidate is below newsworthiness threshold",
      409,
    );
    if ((c.attempts || 0) >= 3) {
      c.retryable = false;
      c.nextAttempt = null;
      c.lastError =
        "Processing retry limit reached. Editor must explicitly retry.";
      this.transition(c, "Needs Attention", c.lastError);
      return c;
    }
    c.attempts = (c.attempts || 0) + 1;
    c.nextAttempt = this.now() + 120000;
    this.transition(c, "Researching", "Research started");
    try {
      for (const obs of c.observations) {
        const source = this.source(obs.sourceId);
        if (source.role === "primary" && !obs.document) {
          try {
            obs.document = await this.client.document(obs, source);
          } catch (e) {
            obs.researchError = e.message;
          }
        }
      }
      this.transition(
        c,
        "Drafting",
        "Retained source evidence prepared for drafting",
      );
      assert(
        this.provider,
        "Draft provider disabled; editor-written structured draft can be submitted",
        409,
      );
      const draft = validateDraftShape(await this.provider(c));
      assert(
        JSON.stringify(draft).length <= 100000,
        "Draft payload exceeds limit",
      );
      c.draft = draft;
      c.visual = c.visual || visualBrief(c);
      c.processedRevision = c.revision;
      c.lastError = null;
      delete c.nextAttempt;
      this.check(c);
      this.audit(c, "Draft generated; editorial checks completed");
      this.save(c);
    } catch (e) {
      c.lastError = text(e.message, 800);
      c.retryable = Boolean(e.retryable) && c.attempts < 3;
      c.nextAttempt = c.retryable
        ? this.now() + Math.min(3600000, 60000 * 2 ** c.attempts)
        : null;
      this.transition(
        c,
        "Needs Attention",
        c.lastError +
          (c.retryable ? " Retry scheduled." : " Human action required."),
      );
    }
    return c;
  }
  async evidence(id, revision, observationId, body) {
    const c = this.get(id);
    this.mutable(c, revision);
    const obs = c.observations.find((o) => o.id === observationId);
    assert(obs, "Unknown observation");
    assert(
      typeof body.text === "string" &&
        body.text.length >= 80 &&
        body.text.length <= 12000,
      "Manual source text must be 80–12000 characters",
    );
    assert(
      body.editorConfirmed === true &&
        typeof body.note === "string" &&
        body.note.trim().length >= 20,
      "Confirm you checked the original document and explain provenance",
    );
    this.invalidate(c, "Source evidence amended by editor");
    obs.document = {
      text: body.text,
      hash: await sha(body.text),
      method: "manual",
      editorConfirmed: true,
      note: body.note.slice(0, 1000),
      retrievedAt: new Date(this.now()).toISOString(),
    };
    this.check(c);
    this.audit(c, "Editor confirmed source text", "editor");
    this.save(c);
    return c;
  }
  mutable(c, revision) {
    assert(
      c.revision === revision,
      "This candidate changed. Reload before editing or approving.",
      409,
    );
    assert(
      !["Approved", "Rejected", "Sent to Publisher"].includes(c.state),
      "Reopen this candidate before editing",
      409,
    );
  }
  edit(id, revision, draft) {
    const c = this.get(id);
    this.mutable(c, revision);
    assert(
      draft &&
        typeof draft === "object" &&
        !Array.isArray(draft) &&
        JSON.stringify(draft).length <= 100000,
      "Invalid structured draft",
    );
    validateDraftShape(draft);
    this.invalidate(c, "Draft edited; prior checks/approval invalidated");
    c.draft = draft;
    c.visual = c.visual || visualBrief(c);
    c.processedRevision = c.revision;
    this.check(c);
    this.audit(c, "Editorial draft saved", "editor");
    this.save(c);
    return c;
  }
  async visual(id, revision, bytes, metadata) {
    const c = this.get(id);
    this.mutable(c, revision);
    assert(
      bytes.length > 0 && bytes.length <= 4 * 1024 * 1024,
      "Visual must be at most 4 MiB",
    );
    assert(
      metadata.kind === "illustration" &&
        metadata.caption === "Pakistan Report illustration." &&
        metadata.reviewed === true,
      "Confirm a non-documentary illustration and required caption",
    );
    assert(
      typeof metadata.alt === "string" &&
        metadata.alt.length >= 15 &&
        metadata.alt.length <= 500,
      "Descriptive image alt text required",
    );
    assert(
      ["png", "jpg", "jpeg", "webp"].includes(metadata.extension),
      "Unsupported image type",
    );
    imageType(bytes, "visual." + metadata.extension);
    const hash = await sha(bytes);
    this.storage.transactionSync(() => {
      this.invalidate(c, "Visual changed; earlier approval invalidated");
      c.visual = {
        ...visualBrief(c),
        ...metadata,
        status: "Complete",
        fileHash: hash,
      };
      this.putAsset(id, "visual", bytes);
      this.check(c);
      this.audit(c, "Editor confirmed illustrative visual", "editor");
      this.save(c);
    });
    return c;
  }
  putAsset(id, kind, bytes) {
    const used = this.rows(
      "SELECT COALESCE(SUM(length(bytes)),0) AS n FROM assets",
    )[0].n;
    assert(
      used + bytes.length <= 256 * 1024 * 1024,
      "Private storage cap reached; stop intake and ask the administrator to review retention",
    );
    this.sql.exec("DELETE FROM assets WHERE id=? AND kind=?", id, kind);
    for (let i = 0; i < bytes.length; i += 512 * 1024)
      this.sql.exec(
        "INSERT INTO assets VALUES (?,?,?,?)",
        id,
        kind,
        i / (512 * 1024),
        bytes.slice(i, i + 512 * 1024),
      );
  }
  asset(id, kind) {
    const rows = this.rows(
      "SELECT bytes FROM assets WHERE id=? AND kind=? ORDER BY part",
      id,
      kind,
    );
    assert(rows.length, "Asset unavailable", 404);
    const parts = rows.map((r) => new Uint8Array(r.bytes));
    const bytes = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
    let offset = 0;
    for (const p of parts) {
      bytes.set(p, offset);
      offset += p.length;
    }
    return bytes;
  }
  approve(
    id,
    revision,
    { claimIds, sensitiveNote, reviewedArticle, reviewedVisual },
  ) {
    const c = this.get(id);
    this.mutable(c, revision);
    this.check(c);
    assert(
      !c.deliveryLocked,
      "A previous revision was already exported; manage that item in the Publisher",
      409,
    );
    assert(c.checks.passed, "Editorial checks failed; approval blocked", 409);
    const ids = c.draft.claims.map((x) => x.id);
    assert(
      Array.isArray(claimIds) &&
        ids.every((id) => claimIds.includes(id)) &&
        claimIds.length === ids.length,
      "Attest to every material claim against its source evidence",
    );
    assert(
      reviewedArticle === true && reviewedVisual === true,
      "Explicit article and visual review confirmations required",
    );
    if (c.checks.risk.level === "SENSITIVE" || c.draft.risk === "SENSITIVE")
      assert(
        typeof sensitiveNote === "string" && sensitiveNote.trim().length >= 40,
        "Sensitive story requires a substantive review note addressing allegations/conflicts and attribution",
      );
    c.approval = {
      revision: c.revision,
      at: this.now(),
      actor: "editor",
      claimIds,
      note: text(sensitiveNote, 2000),
      reviewedArticle: true,
      reviewedVisual: true,
    };
    this.transition(
      c,
      "Approved",
      "Explicit human approval; no publication performed",
      "editor",
    );
    return c;
  }
  reject(id, revision, note) {
    const c = this.get(id);
    assert(c.revision === revision, "Stale candidate revision", 409);
    assert(
      c.state !== "Sent to Publisher",
      "Already handed off; manage the item in Publisher",
      409,
    );
    assert(
      typeof note === "string" && note.trim().length >= 5,
      "Rejection reason required",
    );
    delete c.approval;
    c.rejectedBy = "editor";
    this.transition(
      c,
      "Rejected",
      "Editor rejection: " + note.slice(0, 1000),
      "editor",
    );
    return c;
  }
  reopen(id, revision) {
    const c = this.get(id);
    assert(c.revision === revision, "Stale revision", 409);
    assert(
      ["Rejected", "Approved"].includes(c.state),
      "Cannot reopen this state",
    );
    assert(
      !c.export,
      "Exported copies may exist; create a new candidate or manage the existing item in Publisher",
      409,
    );
    delete c.rejectedBy;
    this.invalidate(c, "Editor reopened candidate");
    this.check(c);
    this.save(c);
    return c;
  }
  async export(id, revision, schedule) {
    const c = this.get(id);
    assert(c.revision === revision, "Stale approval revision", 409);
    assert(
      c.state === "Approved" && c.approval?.revision === revision,
      "Explicit current approval required",
      409,
    );
    if (c.export) {
      assert(
        c.export.schedule === schedule,
        "An immutable package already exists for another schedule",
        409,
      );
      return this.asset(id, "package");
    }
    this.check(c);
    assert(c.checks.passed, "Editorial checks no longer pass", 409);
    const { zip } = makePackage(
      c,
      this.asset(id, "visual"),
      schedule,
      this.now(),
    );
    const digest = await sha(zip);
    this.storage.transactionSync(() => {
      this.putAsset(id, "package", zip);
      c.export = { hash: digest, schedule, at: this.now(), revision };
      this.audit(
        c,
        "Publisher-compatible package exported. Upload and approve separately in existing Publisher.",
        "editor",
      );
      this.save(c);
    });
    return zip;
  }
  handoff(id, revision, batchId) {
    const c = this.get(id);
    assert(
      c.revision === revision && c.state === "Approved" && c.export,
      "Export an approved package first",
      409,
    );
    assert(
      typeof batchId === "string" && /^[a-f0-9-]{36}$/.test(batchId),
      "Enter the existing Publisher batch ID after its validated upload",
    );
    c.handoff = {
      batchId,
      at: this.now(),
      reportedBy: "editor",
      verifiedRemotely: false,
    };
    this.transition(
      c,
      "Sent to Publisher",
      "Editor reports validated handoff to batch " +
        batchId +
        "; remote status not queried",
      "editor",
    );
    return c;
  }
  split(id, revision, observationId) {
    const c = this.get(id);
    this.mutable(c, revision);
    assert(c.observations.length > 1, "Cannot split the only source");
    const obs = c.observations.find((o) => o.id === observationId);
    assert(obs, "Unknown observation");
    const next = {
      id: obs.id.slice(0, 24) + "s",
      revision: 1,
      observations: [obs],
      state: "Detected",
      history: [],
      created: this.now(),
      updated: this.now(),
      attempts: 0,
      simulation: c.simulation,
    };
    assert(
      !this.rows("SELECT id FROM candidates WHERE id=?", next.id).length,
      "Source already split",
    );
    next.selection = rank(next.observations, this.sources(), this.now());
    next.risk = riskFor(next);
    this.storage.transactionSync(() => {
      c.observations = c.observations.filter((o) => o.id !== observationId);
      this.invalidate(c, "Editor split an incorrectly clustered source");
      c.selection = rank(c.observations, this.sources(), this.now());
      delete c.draft;
      this.save(c);
      this.audit(next, "Editor separated source from " + id, "editor");
      this.save(next);
      this.sql.exec(
        "UPDATE observations SET candidate=? WHERE id=?",
        next.id,
        obs.id,
      );
    });
    return next;
  }
}
