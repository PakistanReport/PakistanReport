import { checkCollisions, ValidationError } from "./validation.js";
export const REPO = "PakistanReport/PakistanReport";
export class GitHubError extends Error {
  constructor(message, transient = false, retryAfter = 0) {
    super(message);
    this.name = "GitHubError";
    this.transient = transient;
    this.retryAfter = retryAfter;
  }
}
export class GitHub {
  constructor(token, fetcher = (...args) => fetch(...args)) {
    this.token = token;
    this.fetcher = fetcher;
  }
  async api(path, method = "GET", body) {
    if (!this.token) throw new GitHubError("GitHub server secret is missing");
    let response;
    try {
      response = await this.fetcher(
        `https://api.github.com/repos/${REPO}/${path}`,
        {
          method,
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "PakistanReport-Publisher",
            "Content-Type": "application/json",
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(12000),
        },
      );
    } catch {
      throw new GitHubError(
        "GitHub request timed out or network unavailable; retry will reconcile the commit",
        true,
      );
    }
    if (!response.ok) {
      const retry = Number(response.headers.get("retry-after") || 0) * 1000;
      const reset =
        Number(response.headers.get("x-ratelimit-reset") || 0) * 1000 -
        Date.now();
      const limited =
        response.status === 403 &&
        (response.headers.get("x-ratelimit-remaining") === "0" || retry > 0);
      const transient =
        response.status >= 500 ||
        response.status === 429 ||
        limited ||
        (method === "PATCH" && [409, 422].includes(response.status));
      throw new GitHubError(
        `GitHub ${response.status} on ${method} ${path}. ${transient ? "Will retry safely." : "Check token permission, branch rules, or repository access."}`,
        transient,
        Math.max(retry, limited ? reset : 0, 0),
      );
    }
    try {
      return await response.json();
    } catch {
      throw new GitHubError("Invalid GitHub response", true);
    }
  }
  async snapshot() {
    const ref = await this.api("git/ref/heads/main");
    const tree = await this.api(`git/trees/${ref.object.sha}?recursive=1`);
    if (tree.truncated)
      throw new ValidationError(
        "Repository tree truncated; publication blocked",
      );
    return { head: ref.object.sha, tree };
  }
  async publish(job, image, save) {
    const snapshot = await this.snapshot();
    // Reconcile an update whose response was lost before doing anything else.
    if (job.candidate) {
      const comparison = await this.api(
        `compare/${job.candidate}...${snapshot.head}`,
      );
      if (["ahead", "identical"].includes(comparison.status)) {
        const entries = new Map(snapshot.tree.tree.map((x) => [x.path, x.sha]));
        if (
          entries.get(job.postPath) !== job.postBlob ||
          entries.get(job.imagePath) !== job.imageBlob
        )
          throw new ValidationError(
            "Publisher commit exists, but its files were subsequently changed or removed; inspect GitHub",
          );
        return job.candidate;
      }
    }
    checkCollisions([job], snapshot.tree);
    if (!job.postBlob) {
      job.postBlob = (
        await this.api("git/blobs", "POST", {
          content: job.release,
          encoding: "utf-8",
        })
      ).sha;
      await save(job);
    }
    if (!job.imageBlob) {
      let binary = "";
      for (let i = 0; i < image.length; i += 8192)
        binary += String.fromCharCode(...image.subarray(i, i + 8192));
      job.imageBlob = (
        await this.api("git/blobs", "POST", {
          content: btoa(binary),
          encoding: "base64",
        })
      ).sha;
      await save(job);
    }
    const tree = await this.api("git/trees", "POST", {
      base_tree: snapshot.tree.sha,
      tree: [
        { path: job.postPath, mode: "100644", type: "blob", sha: job.postBlob },
        {
          path: job.imagePath,
          mode: "100644",
          type: "blob",
          sha: job.imageBlob,
        },
      ],
    });
    const commit = await this.api("git/commits", "POST", {
      message: `Publish ${job.slug}\n\nPakistan-Report-Publisher: ${job.id}`,
      tree: tree.sha,
      parents: [snapshot.head],
    });
    job.candidate = commit.sha;
    await save(job); // Write-ahead journal: must persist before moving main.
    await this.api("git/refs/heads/main", "PATCH", {
      sha: commit.sha,
      force: false,
    });
    return commit.sha;
  }
}
