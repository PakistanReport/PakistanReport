const repository = "PakistanReport/PakistanReport";
const categories = ["Pakistan", "Politics", "Economy", "Business", "Technology", "World", "Jobs", "Explainer"];
const encoder = new TextEncoder();

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function reply(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function matches(a, b) {
  const hash = async value => new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  const [left, right] = await Promise.all([hash(a), hash(b)]);
  return left.reduce((difference, byte, i) => difference | (byte ^ right[i]), 0) === 0;
}

async function readBytes(stream, max) {
  if (!stream) throw new RequestError(400, "Missing request or image body.");
  const reader = stream.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new RequestError(413, "Input exceeds the size limit.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

function validate(article) {
  if (!article || typeof article !== "object") throw new RequestError(422, "Expected an article object.");
  for (const [field, max] of Object.entries({
    title: 180, description: 450, body_markdown: 70000, image_alt: 300,
  })) {
    if (typeof article[field] !== "string" || !article[field].trim() || article[field].length > max)
      throw new RequestError(422, "Invalid " + field + ".");
  }
  if (typeof article.slug !== "string" || article.slug.length > 100 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug) || !categories.includes(article.category))
    throw new RequestError(422, "Use a lowercase slug and an existing Pakistan Report category.");
  if (/^---\s*(?:\r?\n|$)/.test(article.body_markdown.trimStart()) ||
      /\{\{|\{%/.test(article.body_markdown))
    throw new RequestError(422, "Use Markdown without YAML front matter or Liquid tags.");
  if (article.image_caption != null &&
      (typeof article.image_caption !== "string" || article.image_caption.length > 300))
    throw new RequestError(422, "Invalid image_caption.");
  if (!Array.isArray(article.openaiFileIdRefs) || article.openaiFileIdRefs.length !== 1)
    throw new RequestError(422, "Select exactly one image from the conversation.");
}

async function downloadImage(ref) {
  let url;
  try {
    if (typeof ref?.download_link !== "string" || ref.download_link.length > 8192) throw Error();
    url = new URL(ref.download_link);
  } catch {
    throw new RequestError(422, "The action needs a real conversation image reference.");
  }
  const trustedLocation = target => {
    const host = target.hostname;
    return target.protocol === "https:" && !target.port && !target.username && !target.password && (
      host.endsWith(".oaiusercontent.com") ||
      /^(?:sdmntpr|oaisdmntpr|oaisdsorpr)[a-z0-9-]*\.blob\.core\.windows\.net$/.test(host) ||
      /^oaisdmntpr[a-z0-9-]*\.s3\.[a-z0-9-]+\.amazonaws\.com$/.test(host) ||
      (host === "chatgpt.com" && target.pathname === "/backend-api/estuary/content")
    );
  };
  const signal = AbortSignal.timeout(10000);
  let response;
  for (let hop = 0; hop <= 3; hop++) {
    if (!trustedLocation(url))
      throw new RequestError(422, "Unsupported image download host: " + url.hostname);
    response = await fetch(url, { redirect: "manual", signal });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get("location");
    await response.body?.cancel();
    if (!location || hop === 3)
      throw new RequestError(422, "The image link returned an unusable redirect.");
    url = new URL(location, url);
  }
  if (!response.ok)
    throw new RequestError(422, "Image download returned HTTP " + response.status + ". Select the conversation image again.");
  const bytes = await readBytes(response.body, 8 * 1024 * 1024);
  const ascii = (start, end) => String.fromCharCode(...bytes.subarray(start, end));
  let extension;
  if (bytes.length >= 33 && bytes[0] === 137 && ascii(1, 8) === "PNG\r\n\x1a\n" && ascii(12, 16) === "IHDR")
    extension = "png";
  else if (bytes.length >= 16 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    extension = "jpg";
  else if (bytes.length >= 20 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP")
    extension = "webp";
  else throw new RequestError(422, "Expected a PNG, JPEG, or WebP image.");
  return { bytes, extension };
}

async function publish(article, image, env, branch) {
  const base = "https://api.github.com/repos/" + repository;
  const headers = {
    Authorization: "Bearer " + env.GITHUB_TOKEN,
    Accept: "application/vnd.github+json",
    "User-Agent": "PakistanReport-Chat-Publisher",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  async function git(method, path, body, allowMissing = false) {
    const response = await fetch(base + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "error", signal: AbortSignal.timeout(10000),
    });
    if (response.status === 404 && allowMissing) return null;
    if (method === "PATCH" && [409, 422].includes(response.status))
      throw new RequestError(409, "Branch update rejected. Check the branch before retrying.");
    if (!response.ok) throw new RequestError(502, "GitHub returned HTTP " + response.status + ".");
    return response.json();
  }

  const local = new Date(Date.now() + 5 * 3600000).toISOString();
  const stem = local.slice(0, 10) + "-" + article.slug;
  const postPath = "_posts/" + stem + ".md";
  const imagePath = "assets/images/" + stem + "." + image.extension;
  const head = (await git("GET", "/git/ref/heads/" + branch)).object.sha;
  const [existingPost, existingImage, baseCommit] = await Promise.all([
    git("GET", "/contents/" + postPath + "?ref=" + head, undefined, true),
    git("GET", "/contents/" + imagePath + "?ref=" + head, undefined, true),
    git("GET", "/git/commits/" + head),
  ]);
  if (existingPost || existingImage)
    throw new RequestError(409, "An article or image already exists at this path. Check the branch before retrying.");

  const frontMatter = {
    layout: "article", title: article.title, description: article.description,
    category: article.category, author: "Pakistan Report Editorial Desk",
    date: local.slice(0, 19).replace("T", " ") + " +0500",
    published: branch === "main", image: "/" + imagePath, image_alt: article.image_alt,
    image_caption: article.image_caption?.trim() || "Pakistan Report AI-generated illustration.",
  };
  const metadata = Object.entries(frontMatter).map(([key, value]) => key + ": " + JSON.stringify(value)).join("\n");
  const markdown = "---\n" + metadata + "\n---\n\n" + article.body_markdown.trim() + "\n";
  let binary = "";
  for (let index = 0; index < image.bytes.length; index += 8192)
    binary += String.fromCharCode(...image.bytes.subarray(index, index + 8192));
  const blob = await git("POST", "/git/blobs", { encoding: "base64", content: btoa(binary) });
  const tree = await git("POST", "/git/trees", {
    base_tree: baseCommit.tree.sha,
    tree: [
      { path: postPath, mode: "100644", type: "blob", content: markdown },
      { path: imagePath, mode: "100644", type: "blob", sha: blob.sha },
    ],
  });
  const commit = await git("POST", "/git/commits", {
    message: "Publish " + article.slug, tree: tree.sha, parents: [head],
  });
  await git("PATCH", "/git/refs/heads/" + branch, { sha: commit.sha, force: false });
  return { branch, post_path: postPath, image_path: "/" + imagePath,
    commit: "https://github.com/" + repository + "/commit/" + commit.sha };
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    const branch = env.CHAT_PUBLISHER_BRANCH || "chat-publishing-test";
    if (path === "/health" && request.method === "GET")
      return reply({ ok: true, destination_branch: branch, branch_guard: true, image_download_version: 2 });
    if (path !== "/publish-article") return reply({ error: "Not found." }, 404);
    if (request.method !== "POST") return reply({ error: "Use POST." }, 405);
    if (!(env.CHAT_PUBLISHER_API_KEY?.length >= 32) || !env.GITHUB_TOKEN ||
        !["main", "chat-publishing-test"].includes(branch))
      return reply({ error: "Publisher configuration is incomplete." }, 503);
    if (!(await matches(request.headers.get("Authorization") || "", "Bearer " + env.CHAT_PUBLISHER_API_KEY)))
      return reply({ error: "Unauthorized." }, 401);

    try {
      const raw = await readBytes(request.body, 256 * 1024);
      let article;
      try { article = JSON.parse(new TextDecoder().decode(raw)); }
      catch { throw new RequestError(400, "Expected valid JSON."); }
      validate(article);
      if (!["chat-publishing-test", "main"].includes(article.expected_branch))
        throw new RequestError(422, "Supply the expected GitHub destination branch.");
      if (article.expected_branch !== branch)
        throw new RequestError(409, "The expected branch differs from the configured destination.");
      const image = await downloadImage(article.openaiFileIdRefs[0]);
      return reply(await publish(article, image, env, branch));
    } catch (error) {
      if (error instanceof RequestError) return reply({ error: error.message }, error.status);
      return reply({ error: "Could not reach the image host or GitHub. Check the branch before retrying." }, 502);
    }
  },
};
