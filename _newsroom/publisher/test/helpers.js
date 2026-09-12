import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { zipSync, strToU8, unzipSync } from "fflate";
import { template } from "../src/template.js";
import { pakistanTime } from "../src/validation.js";
export function fixture(offset = 60000, suffix = "") {
  const files = unzipSync(template());
  const m = JSON.parse(new TextDecoder().decode(files["manifest.json"]));
  const out = {};
  m.name = "Test batch" + suffix;
  for (const [i, e] of m.items.entries()) {
    const schedule = pakistanTime(Date.now() + offset + i * 1000);
    const oldArticle = e.article,
      oldImage = e.image;
    e.article =
      "articles/" +
      schedule.slice(0, 10) +
      "-disposable-publisher-test-" +
      (i + 1) +
      suffix +
      ".md";
    e.image = "images/disposable-publisher-test-" + (i + 1) + suffix + ".png";
    e.schedule = schedule;
    out[e.article] = strToU8(
      new TextDecoder().decode(files[oldArticle]).replace(oldImage, e.image),
    );
    out[e.image] = files[oldImage];
  }
  out["manifest.json"] = strToU8(JSON.stringify(m));
  return { files: out, manifest: m, zip: () => zipSync(out, { level: 0 }) };
}
export function state() {
  const db = new DatabaseSync(":memory:");
  const storage = {
    sql: {
      exec(q, ...args) {
        return db.prepare(q).all(...args);
      },
    },
    transactionSync(fn) {
      db.exec("BEGIN");
      try {
        const r = fn();
        db.exec("COMMIT");
        return r;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
    async setAlarm(time) {
      storage.alarm = time;
    },
    async deleteAlarm() {
      storage.alarm = null;
    },
  };
  return { storage };
}
export class FakeGitHub {
  constructor() {
    this.head = "root";
    this.trees = new Map([
      [
        "root",
        {
          sha: "root-tree",
          tree: [
            {
              path: "google75307899b867922a.html",
              sha: "protected-verification",
            },
          ],
        },
      ],
    ]);
    this.blobs = new Map();
    this.commits = new Map();
    this.updates = 0;
    this.calls = [];
    this.fail = 0;
    this.loseResponse = false;
    this.race = false;
  }
  fetch = async (url, opts = {}) => {
    const path = url.split("/PakistanReport/PakistanReport/")[1];
    const method = opts.method || "GET",
      body = opts.body ? JSON.parse(opts.body) : {};
    this.calls.push([method, path]);
    if (this.fail-- > 0)
      return Response.json({ error: "temporary" }, { status: 503 });
    let result;
    if (path === "git/ref/heads/main") result = { object: { sha: this.head } };
    else if (path.startsWith("git/trees/") && method === "GET")
      result = this.trees.get(path.split("/")[2].split("?")[0]);
    else if (path.startsWith("compare/")) {
      const [base, head] = path.slice(8).split("...");
      let current = head;
      while (current && current !== base)
        current = this.commits.get(current)?.parents[0];
      result = {
        status:
          current === base
            ? base === head
              ? "identical"
              : "ahead"
            : "diverged",
      };
    } else if (path === "git/blobs") {
      const data = Buffer.from(
        body.content,
        body.encoding === "base64" ? "base64" : "utf8",
      );
      const sha = createHash("sha1")
        .update("blob " + data.length + "\0")
        .update(data)
        .digest("hex");
      this.blobs.set(sha, data);
      result = { sha };
    } else if (path === "git/trees") {
      const base = [...this.trees.values()].find(
        (t) => t.sha === body.base_tree,
      );
      const tree = {
        sha: "tree-" + this.trees.size,
        tree: [...base.tree, ...body.tree],
      };
      this.trees.set(tree.sha, tree);
      result = { sha: tree.sha };
    } else if (path === "git/commits") {
      const sha = "commit-" + (this.commits.size + 1);
      this.commits.set(sha, body);
      this.trees.set(sha, this.trees.get(body.tree));
      result = { sha };
    } else if (path === "git/refs/heads/main") {
      if (body.force !== false) throw Error("Force push attempted");
      if (this.race) {
        this.race = false;
        this.commits.set("editor", { parents: [this.head] });
        this.trees.set("editor", {
          sha: "editor-tree",
          tree: [
            ...this.trees.get(this.head).tree,
            { path: "unrelated.txt", sha: "keep" },
          ],
        });
        this.head = "editor";
      }
      if (this.commits.get(body.sha).parents[0] !== this.head)
        return Response.json({}, { status: 422 });
      this.head = body.sha;
      this.updates++;
      result = { object: { sha: this.head } };
      if (this.loseResponse) {
        this.loseResponse = false;
        throw Error("lost response");
      }
    } else throw Error("Unexpected GitHub operation " + method + " " + path);
    if (!result) throw Error("Missing fake result " + path);
    return Response.json(result);
  };
}
