import { HTML, CSS, JS } from "./ui.js";
import { template } from "./template.js";
import { GitHub } from "./github.js";
import {
  unpackBatch,
  checkCollisions,
  validateArticle,
  releaseMarkdown,
  ValidationError,
  requireValid,
  MAX_ZIP,
} from "./validation.js";
const secureHeaders = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy":
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  "Strict-Transport-Security": "max-age=31536000",
};
const json = (data, status = 200) =>
  Response.json(data, { status, headers: secureHeaders });
async function authenticated(request, env) {
  if (!env.PUBLISHER_PASSWORD || env.PUBLISHER_PASSWORD.length < 32)
    return false;
  let actual = "";
  try {
    actual = atob(
      (request.headers.get("Authorization") || "").replace(/^Basic /, ""),
    );
  } catch {}
  const hash = async (text) =>
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    );
  const [a, b] = await Promise.all([
    hash(actual),
    hash("publisher:" + env.PUBLISHER_PASSWORD),
  ]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (
      url.protocol !== "https:" &&
      !["localhost", "127.0.0.1"].includes(url.hostname)
    )
      return json({ error: "HTTPS required" }, 400);
    if (!(await authenticated(request, env)))
      return new Response(
        "Private Pakistan Report Publisher. Sign in with username publisher.",
        {
          status: 401,
          headers: {
            ...secureHeaders,
            "WWW-Authenticate":
              'Basic realm="Pakistan Report Publisher", charset="UTF-8"',
          },
        },
      );
    if (!["GET", "POST"].includes(request.method))
      return json({ error: "Method not allowed" }, 405);
    if (
      request.method === "POST" &&
      (request.headers.get("Origin") !== url.origin ||
        request.headers.get("X-Publisher-Action") !== "1")
    )
      return json({ error: "Same-origin publisher action required" }, 403);
    if (url.pathname.startsWith("/api/")) {
      const response = await env.PUBLISHER.get(
        env.PUBLISHER.idFromName("editorial-v1"),
      ).fetch(request);
      const secured = new Response(response.body, response);
      for (const [k, v] of Object.entries(secureHeaders))
        secured.headers.set(k, v);
      return secured;
    }
    if (request.method !== "GET") return json({ error: "Not found" }, 404);
    if (url.pathname === "/template.zip")
      return new Response(template(), {
        headers: {
          ...secureHeaders,
          "Content-Type": "application/zip",
          "Content-Disposition":
            'attachment; filename="pakistan-report-template.zip"',
        },
      });
    const assets = {
      "/": [HTML, "text/html; charset=utf-8"],
      "/style.css": [CSS, "text/css"],
      "/app.js": [JS, "text/javascript"],
    };
    const asset = assets[url.pathname];
    return asset
      ? new Response(asset[0], {
          headers: { ...secureHeaders, "Content-Type": asset[1] },
        })
      : json({ error: "Not found" }, 404);
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      env.PUBLISHER.get(env.PUBLISHER.idFromName("editorial-v1")).fetch(
        "https://internal/watchdog",
        { method: "POST" },
      ),
    );
  },
};
export class Publisher {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.sql = ctx.storage.sql;
    this.tail = Promise.resolve();
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS batches (id TEXT PRIMARY KEY, name TEXT NOT NULL, created INTEGER NOT NULL)",
    );
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, batch TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, postPath TEXT UNIQUE NOT NULL, imagePath TEXT UNIQUE NOT NULL, status TEXT NOT NULL, due INTEGER NOT NULL, next INTEGER NOT NULL, data TEXT NOT NULL)",
    );
    this.sql.exec("CREATE INDEX IF NOT EXISTS jobs_due ON jobs(status,next)");
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS images (job TEXT NOT NULL, part INTEGER NOT NULL, bytes BLOB NOT NULL, PRIMARY KEY(job,part))",
    );
  }
  serial(fn) {
    const run = this.tail.then(fn);
    this.tail = run.catch(() => {});
    return run;
  }
  rows(query, ...args) {
    return [...this.sql.exec(query, ...args)];
  }
  get(id) {
    const r = this.rows("SELECT data FROM jobs WHERE id=?", id)[0];
    requireValid(r, "Article not found");
    return JSON.parse(r.data);
  }
  save(job) {
    this.sql.exec(
      "UPDATE jobs SET status=?, due=?, next=?, data=? WHERE id=?",
      job.status,
      job.due,
      job.next,
      JSON.stringify(job),
      job.id,
    );
  }
  history(job, message) {
    job.history.push({ at: Date.now(), message });
    job.history = job.history.slice(-50);
  }
  image(id) {
    const parts = this.rows(
      "SELECT bytes FROM images WHERE job=? ORDER BY part",
      id,
    ).map((r) => new Uint8Array(r.bytes));
    const total = parts.reduce((s, p) => s + p.length, 0);
    requireValid(total > 0, "Stored image is missing");
    const out = new Uint8Array(total);
    let at = 0;
    for (const p of parts) {
      out.set(p, at);
      at += p.length;
    }
    return out;
  }
  async arm() {
    const row = this.rows(
      "SELECT MIN(next) AS time FROM jobs WHERE status IN ('Scheduled','Publishing')",
    )[0];
    if (row?.time !== null && row?.time !== undefined)
      await this.ctx.storage.setAlarm(Math.max(Date.now() + 100, row.time));
    else await this.ctx.storage.deleteAlarm();
  }
  fetch(request) {
    return this.serial(async () => {
      try {
        return await this.route(request);
      } catch (e) {
        return json(
          {
            error:
              e instanceof ValidationError || e.name === "GitHubError"
                ? e.message
                : "Publisher operation failed; no approval was confirmed. Refresh status and retry.",
          },
          e instanceof ValidationError ? 400 : 503,
        );
      }
    });
  }
  async route(request) {
    const path = new URL(request.url).pathname;
    if (path === "/watchdog") {
      await this.arm();
      return json({ ok: true });
    }
    if (path === "/api/batches" && request.method === "GET") {
      const batches = this.rows("SELECT * FROM batches ORDER BY created DESC");
      return json(
        batches.map((b) => ({
          ...b,
          items: this.rows(
            "SELECT data FROM jobs WHERE batch=? ORDER BY due",
            b.id,
          ).map((r) => {
            const {
              raw,
              release,
              entry,
              postBlob,
              imageBlob,
              candidate,
              ...safe
            } = JSON.parse(r.data);
            return safe;
          }),
        })),
      );
    }
    if (path === "/api/batches" && request.method === "POST") {
      requireValid(
        (request.headers.get("Content-Type") || "").split(";")[0] ===
          "application/zip",
        "Upload a ZIP",
      );
      // Bound the stream before buffering, including requests without Content-Length.
      const reader = request.body?.getReader();
      requireValid(reader, "Empty upload");
      const chunks = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_ZIP) {
          await reader.cancel();
          throw new ValidationError("ZIP exceeds 24 MiB");
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const c of chunks) {
        bytes.set(c, offset);
        offset += c.length;
      }
      const batch = unpackBatch(bytes);
      // Bound private retained content well below the 5 GB free storage allowance.
      const stored = this.rows(
        "SELECT COALESCE(SUM(LENGTH(bytes)),0) AS n FROM images",
      )[0].n;
      requireValid(
        stored + batch.items.reduce((s, i) => s + i.image.length, 0) <=
          512 * 1024 * 1024,
        "Private storage limit reached (512 MiB). Archive published batches or discard unapproved batches before uploading.",
      );
      const snapshot = await new GitHub(this.env.GITHUB_TOKEN).snapshot();
      checkCollisions(
        batch.items,
        snapshot.tree,
        this.rows("SELECT slug,postPath,imagePath FROM jobs"),
      );
      const id = crypto.randomUUID(),
        created = Date.now();
      this.ctx.storage.transactionSync(() => {
        this.sql.exec(
          "INSERT INTO batches VALUES (?,?,?)",
          id,
          batch.name,
          created,
        );
        for (const item of batch.items) {
          const { image, ...rest } = item;
          const job = {
            ...rest,
            id: crypto.randomUUID(),
            batch: id,
            status: "Validated",
            next: item.due,
            attempts: 0,
            history: [
              {
                at: created,
                message:
                  "Draft uploaded; complete batch validated against GitHub main",
              },
            ],
          };
          this.sql.exec(
            "INSERT INTO jobs VALUES (?,?,?,?,?,?,?,?,?)",
            job.id,
            id,
            job.slug,
            job.postPath,
            job.imagePath,
            job.status,
            job.due,
            job.next,
            JSON.stringify(job),
          );
          for (
            let part = 0, at = 0;
            at < image.length;
            part++, at += 512 * 1024
          )
            this.sql.exec(
              "INSERT INTO images VALUES (?,?,?)",
              job.id,
              part,
              image.slice(at, at + 512 * 1024),
            );
        }
      });
      return json({ id, status: "Validated" }, 201);
    }
    let match = path.match(/^\/api\/batches\/([a-f0-9-]+)\/approve$/);
    if (match && request.method === "POST") {
      const jobs = this.rows(
        "SELECT data FROM jobs WHERE batch=? AND status='Validated'",
        match[1],
      ).map((r) => JSON.parse(r.data));
      requireValid(
        jobs.length > 0,
        "No validated articles remain in this batch",
      );
      const snapshot = await new GitHub(this.env.GITHUB_TOKEN).snapshot();
      for (const j of jobs) validateArticle(j.raw, j.entry);
      checkCollisions(jobs, snapshot.tree);
      requireValid(
        jobs.every((j) => j.due >= Date.now() - 60000),
        "A schedule has passed. Use Publish Now for that item, then approve the remaining batch.",
      );
      // Arm before state transition; watchdog repairs a crash between these operations.
      await this.ctx.storage.setAlarm(
        Math.max(Date.now() + 100, Math.min(...jobs.map((j) => j.due))),
      );
      this.ctx.storage.transactionSync(() => {
        for (const j of jobs) {
          j.status = "Scheduled";
          this.history(j, "Batch approved and scheduled in Asia/Karachi");
          this.save(j);
        }
      });
      await this.arm();
      return json({ status: "Scheduled" });
    }
    match = path.match(/^\/api\/batches\/([a-f0-9-]+)\/archive$/);
    if (match && request.method === "POST") {
      const jobs = this.rows(
        "SELECT data FROM jobs WHERE batch=?",
        match[1],
      ).map((r) => JSON.parse(r.data));
      requireValid(
        jobs.length && jobs.every((j) => j.status === "Published"),
        "Only entirely published batches may be archived",
      );
      this.ctx.storage.transactionSync(() => {
        for (const j of jobs) {
          this.sql.exec("DELETE FROM images WHERE job=?", j.id);
          delete j.raw;
          delete j.release;
          delete j.entry;
          j.imageArchived = true;
          this.history(
            j,
            "Private source files archived; published GitHub files and audit retained",
          );
          this.save(j);
        }
      });
      return json({ ok: true });
    }
    match = path.match(/^\/api\/batches\/([a-f0-9-]+)\/discard$/);
    if (match && request.method === "POST") {
      const jobs = this.rows(
        "SELECT data FROM jobs WHERE batch=?",
        match[1],
      ).map((r) => JSON.parse(r.data));
      requireValid(
        jobs.length && jobs.every((j) => j.status === "Validated"),
        "Only entirely unapproved batches may be discarded",
      );
      this.ctx.storage.transactionSync(() => {
        for (const j of jobs)
          this.sql.exec("DELETE FROM images WHERE job=?", j.id);
        this.sql.exec("DELETE FROM jobs WHERE batch=?", match[1]);
        this.sql.exec("DELETE FROM batches WHERE id=?", match[1]);
      });
      return json({ ok: true });
    }
    match = path.match(/^\/api\/items\/([a-f0-9-]+)\/(now|image)$/);
    if (match) {
      const job = this.get(match[1]);
      if (match[2] === "image" && request.method === "GET")
        return new Response(this.image(job.id), {
          headers: { ...secureHeaders, "Content-Type": job.mime },
        });
      if (match[2] === "now" && request.method === "POST") {
        if (["Publishing", "Published"].includes(job.status))
          return json({ status: job.status });
        requireValid(
          ["Validated", "Scheduled", "Failed"].includes(job.status),
          "Article is not validated",
        );
        validateArticle(job.raw, job.entry);
        const now = Date.now();
        // Once any publication attempt started, never change its payload on retry.
        if (!job.release) {
          job.release = releaseMarkdown(job, now);
          job.due = now;
        }
        job.status = "Scheduled";
        job.next = now;
        job.attempts = 0;
        job.error = null;
        this.history(job, "Publish Now / retry approved");
        await this.ctx.storage.setAlarm(now + 100);
        this.save(job);
        await this.arm();
        return json({ status: job.status });
      }
    }
    return json({ error: "Not found" }, 404);
  }
  alarm() {
    return this.serial(async () => {
      const row = this.rows(
        "SELECT data FROM jobs WHERE status IN ('Scheduled','Publishing') AND next<=? ORDER BY next LIMIT 1",
        Date.now(),
      )[0];
      if (!row) {
        await this.arm();
        return;
      }
      const job = JSON.parse(row.data);
      // Persistent recovery wake-up survives process termination, including during GitHub I/O.
      await this.ctx.storage.setAlarm(Date.now() + 120000);
      job.attempts++;
      if (job.attempts > 6) {
        job.status = "Failed";
        job.error =
          "Retry limit reached after interrupted attempts. Inspect history and retry manually.";
        this.history(job, job.error);
        this.save(job);
        await this.arm();
        return;
      }
      job.status = "Publishing";
      job.next = Date.now() + 120000;
      try {
        validateArticle(job.raw, job.entry);
        if (!job.release) job.release = releaseMarkdown(job, job.due);
        this.history(job, "Publishing attempt " + job.attempts);
        this.save(job);
        job.commit = await new GitHub(this.env.GITHUB_TOKEN).publish(
          job,
          this.image(job.id),
          (j) => this.save(j),
        );
        job.status = "Published";
        job.error = null;
        this.history(
          job,
          "Committed article and image together: " +
            job.commit +
            "; Cloudflare build follows",
        );
      } catch (e) {
        const retry = e.transient && job.attempts < 6;
        job.status = retry ? "Scheduled" : "Failed";
        job.next =
          Date.now() +
          Math.max(
            Math.min(30 * 2 ** (job.attempts - 1), 900) * 1000,
            e.retryAfter || 0,
          );
        job.error =
          e instanceof ValidationError || e.name === "GitHubError"
            ? e.message
            : "Publication failed; stored content retained. Check server configuration and retry.";
        this.history(
          job,
          job.error +
            (retry ? " Automatic retry scheduled." : " Manual retry required."),
        );
      }
      this.save(job);
      await this.arm();
    });
  }
}
