import { Service } from "./service.js";
import { SourceClient } from "./sources.js";
import { modelProvider } from "./provider.js";
import { assert, NewsroomError, readBounded, decode, json } from "./common.js";
import { HTML, CSS, JS } from "./ui.js";
const HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=31536000",
  "Content-Security-Policy":
    "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};
async function authorized(request, env) {
  if (
    typeof env.NEWSROOM_PASSWORD !== "string" ||
    env.NEWSROOM_PASSWORD.length < 32
  )
    return false;
  let supplied = "";
  try {
    supplied = atob(
      (request.headers.get("Authorization") || "").replace(/^Basic /, ""),
    );
  } catch {}
  const digest = (x) =>
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(x));
  const [a, b] = await Promise.all([
    digest(supplied),
    digest("editor:" + env.NEWSROOM_PASSWORD),
  ]);
  const aa = new Uint8Array(a),
    bb = new Uint8Array(b);
  let mismatch = 0;
  for (let i = 0; i < aa.length; i++) mismatch |= aa[i] ^ bb[i];
  return mismatch === 0;
}
export default {
  async fetch(request, env) {
    const u = new URL(request.url);
    let response;
    if (
      u.protocol !== "https:" &&
      !["localhost", "127.0.0.1"].includes(u.hostname)
    )
      response = json({ error: "HTTPS required" }, 400);
    else if (!(await authorized(request, env)))
      response = new Response("Private Pakistan Report Newsroom", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="Pakistan Report Newsroom"',
        },
      });
    else if (!["GET", "POST"].includes(request.method))
      response = json({ error: "Method not allowed" }, 405);
    else if (
      request.method === "POST" &&
      (request.headers.get("Origin") !== u.origin ||
        request.headers.get("X-Newsroom-Action") !== "1")
    )
      response = json({ error: "Same-origin human action required" }, 403);
    else if (u.pathname.startsWith("/api/"))
      response = await env.NEWSROOM.get(
        env.NEWSROOM.idFromName("phase1"),
      ).fetch(request);
    else if (u.pathname === "/")
      response = new Response(HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    else if (u.pathname === "/app.js")
      response = new Response(JS, {
        headers: { "Content-Type": "text/javascript" },
      });
    else if (u.pathname === "/style.css")
      response = new Response(CSS, { headers: { "Content-Type": "text/css" } });
    else response = json({ error: "Not found" }, 404);
    const secured = new Response(response.body, response);
    for (const [k, v] of Object.entries(HEADERS)) secured.headers.set(k, v);
    return secured;
  },
  async scheduled(_event, env, ctx) {
    if (env.MONITOR_ENABLED === "true")
      ctx.waitUntil(
        env.NEWSROOM.get(env.NEWSROOM.idFromName("phase1")).fetch(
          "https://internal/tick",
          { method: "POST" },
        ),
      );
  },
};
export class Newsroom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.tail = Promise.resolve();
    this.service = new Service(ctx.storage, {
      provider: modelProvider(env),
      client: new SourceClient(),
    });
  }
  serial(fn) {
    const task = this.tail.then(fn);
    this.tail = task.catch(() => {});
    return task;
  }
  fetch(request) {
    return this.serial(async () => {
      try {
        return await this.route(request);
      } catch (e) {
        return json(
          {
            error:
              e instanceof NewsroomError
                ? e.message
                : "Operation failed; approval was not confirmed. Reload and inspect status.",
          },
          e instanceof NewsroomError ? e.status : 500,
        );
      }
    });
  }
  async body(request) {
    assert(
      (request.headers.get("Content-Type") || "").includes("application/json"),
      "JSON body required",
    );
    let body;
    try {
      body = JSON.parse(decode(await readBounded(request, 150000)));
    } catch {
      throw new NewsroomError("Malformed or oversized JSON");
    }
    assert(
      body && typeof body === "object" && !Array.isArray(body),
      "Object body required",
    );
    return body;
  }
  async route(request) {
    const u = new URL(request.url),
      s = this.service;
    if (u.pathname === "/tick") return json(await this.tick());
    if (request.method === "GET") {
      if (u.pathname === "/api/status")
        return json({
          monitoring: this.env.MONITOR_ENABLED === "true",
          draftProvider: this.env.DRAFT_PROVIDER || "disabled",
          autonomousPublication: false,
          publisherIntegration:
            "Human-download ZIP only; no Publisher credentials or public-write path",
          coverage: s.setting("coverageMeta", null),
        });
      if (u.pathname === "/api/sources") return json(s.sources());
      if (u.pathname === "/api/candidates")
        return json(
          s
            .list()
            .map((c) => ({
              id: c.id,
              state: c.state,
              revision: c.revision,
              title: c.draft?.headline || c.observations[0].title,
              category:
                c.draft?.category ||
                s.source(c.observations[0].sourceId).category,
              risk: c.checks?.risk?.level || c.risk?.level,
              score: c.selection.score,
              simulation: c.simulation,
              updated: c.updated,
              lastError: c.lastError,
              exported: Boolean(c.export),
            })),
        );
      const m = u.pathname.match(
        /^\/api\/candidates\/([a-f0-9s]+)(?:\/(visual|evidence))?$/,
      );
      if (m) {
        const c = s.get(m[1]);
        if (m[2] === "visual")
          return new Response(s.asset(c.id, "visual"), {
            headers: {
              "Content-Type":
                "image/" +
                (c.visual.extension === "jpg" ? "jpeg" : c.visual.extension),
            },
          });
        if (m[2] === "evidence")
          return new Response(
            JSON.stringify(
              {
                candidateId: c.id,
                revision: c.revision,
                observations: c.observations,
                claims: c.draft?.claims,
                checks: c.checks,
                approval: c.approval,
                history: c.history,
              },
              null,
              2,
            ),
            {
              headers: {
                "Content-Type": "application/json",
                "Content-Disposition":
                  'attachment; filename="newsroom-evidence-' + c.id + '.json"',
              },
            },
          );
        return json(c);
      }
      return json({ error: "Not found" }, 404);
    }
    if (u.pathname === "/api/ingest") {
      const b = await this.body(request);
      return json(await s.ingest(b.sourceId, b.items));
    }
    if (u.pathname === "/api/sources") {
      const b = await this.body(request);
      s.sourceUpdate(b);
      return json({ ok: true });
    }
    if (u.pathname === "/api/coverage") {
      const b = await this.body(request);
      assert(
        Array.isArray(b.items) &&
          b.items.length <= 5000 &&
          b.items.every(
            (i) => typeof i.title === "string" && typeof i.slug === "string",
          ),
        "Coverage index requires title/slug items",
      );
      s.setSetting("coverage", b.items);
      s.setSetting("coverageMeta", {
        at: Date.now(),
        method: "editor-import",
        count: b.items.length,
      });
      return json({ ok: true });
    }
    if (u.pathname === "/api/coverage/refresh")
      return json(await this.coverage());
    const source = u.pathname.match(/^\/api\/sources\/([a-z0-9-]+)\/poll$/);
    if (source) return json(await s.poll(source[1]));
    const m = u.pathname.match(
      /^\/api\/candidates\/([a-f0-9s]+)\/(process|edit|evidence|visual|approve|reject|reopen|export|handoff|split)$/,
    );
    if (m) {
      const id = m[1],
        action = m[2];
      if (action === "visual") {
        assert(
          (request.headers.get("Content-Type") || "").startsWith("image/"),
          "Image Content-Type required",
        );
        const revision = Number(request.headers.get("X-Revision"));
        let metadata;
        try {
          metadata = JSON.parse(
            decode(
              Uint8Array.from(
                atob(request.headers.get("X-Visual-Metadata") || ""),
                (x) => x.charCodeAt(0),
              ),
            ),
          );
        } catch {
          throw new NewsroomError("Invalid visual metadata");
        }
        return json(
          await s.visual(
            id,
            revision,
            await readBounded(request, 4 * 1024 * 1024),
            metadata,
          ),
        );
      }
      const b = await this.body(request);
      if (action === "process") {
        const c = s.get(id);
        assert(c.revision === b.revision, "Stale candidate revision", 409);
        c.attempts = 0;
        s.save(c);
        return json(await this.process(id));
      }
      if (action === "edit") return json(s.edit(id, b.revision, b.draft));
      if (action === "evidence")
        return json(await s.evidence(id, b.revision, b.observationId, b));
      if (action === "approve") return json(s.approve(id, b.revision, b));
      if (action === "reject") return json(s.reject(id, b.revision, b.note));
      if (action === "reopen") return json(s.reopen(id, b.revision));
      if (action === "split")
        return json(s.split(id, b.revision, b.observationId));
      if (action === "handoff")
        return json(s.handoff(id, b.revision, b.batchId));
      if (action === "export") {
        const bytes = await s.export(id, b.revision, b.schedule);
        return new Response(bytes, {
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition":
              'attachment; filename="pakistan-report-newsroom-' + id + '.zip"',
          },
        });
      }
    }
    return json({ error: "Not found" }, 404);
  }
  async process(id) {
    const s = this.service;
    if (this.env.DRAFT_PROVIDER === "openai-compatible") {
      const key = "model-budget-" + new Date().toISOString().slice(0, 10);
      const used = s.setting(key, 0),
        max = Math.min(
          30,
          Math.max(0, Number(this.env.MODEL_REQUESTS_PER_DAY || 10)),
        );
      if (used >= max) {
        const c = s.get(id);
        c.lastError = "Daily model request cap reached";
        s.transition(c, "Needs Attention", c.lastError);
        return c;
      }
      s.setSetting(key, used + 1);
    }
    return s.process(id);
  }
  async coverage() {
    // Read-only public repository metadata. There is intentionally no GitHub credential.
    let r;
    try {
      r = await fetch(
        "https://api.github.com/repos/PakistanReport/PakistanReport/git/trees/main?recursive=1",
        {
          headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": "PakistanReportNewsroom",
          },
          redirect: "manual",
          signal: AbortSignal.timeout(12000),
        },
      );
    } catch {
      throw new NewsroomError(
        "Published-coverage index unavailable; use editor import",
        503,
        true,
      );
    }
    assert(r.ok, "Coverage index HTTP " + r.status, 503);
    const tree = JSON.parse(decode(await readBounded(r, 2 * 1024 * 1024)));
    assert(
      !tree.truncated && Array.isArray(tree.tree),
      "Incomplete coverage index",
    );
    const items = tree.tree
      .filter((e) =>
        /^_posts\/\d{4}-\d{2}-\d{2}-.+\.(md|markdown)$/.test(e.path),
      )
      .map((e) => {
        const slug = e.path
          .split("/")
          .pop()
          .replace(/^\d{4}-\d{2}-\d{2}-/, "")
          .replace(/\.(md|markdown)$/, "");
        return { slug, title: slug.replace(/-/g, " "), path: e.path };
      });
    this.service.setSetting("coverage", items);
    const meta = {
      at: Date.now(),
      method: "GitHub public filenames",
      count: items.length,
      sha: tree.sha,
    };
    this.service.setSetting("coverageMeta", meta);
    return meta;
  }
  async tick() {
    if (this.env.MONITOR_ENABLED !== "true") return { disabled: true };
    const s = this.service;
    if (
      !s.setting("coverageMeta") ||
      Date.now() - s.setting("coverageMeta").at > 24 * 3600000
    ) {
      try {
        await this.coverage();
      } catch (e) {
        s.setSetting("coverageError", { at: Date.now(), message: e.message });
      }
    }
    const due = s
      .sources()
      .filter(
        (source) =>
          source.enabled &&
          source.type !== "manual" &&
          (!source.poll.nextPollAt || source.poll.nextPollAt <= Date.now()),
      )
      .sort((a, b) => b.priority - a.priority);
    let error = null;
    if (due[0])
      try {
        await s.poll(due[0].id);
      } catch (e) {
        error = e.message;
      }
    const candidate = s
      .list()
      .sort((a, b) => b.selection.score - a.selection.score || a.created - b.created)
      .find(
        (c) =>
          c.state === "Detected" ||
          (["Researching", "Drafting"].includes(c.state) &&
            c.nextAttempt <= Date.now()) ||
          (c.state === "Needs Attention" &&
            c.retryable &&
            c.nextAttempt <= Date.now()),
      );
    if (candidate) await this.process(candidate.id);
    return {
      polled: due[0]?.id || null,
      processed: candidate?.id || null,
      error,
    };
  }
}
