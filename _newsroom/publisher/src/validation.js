import { unzipSync } from "fflate";
import { parseDocument } from "yaml";
export const CATEGORIES = [
  "Pakistan",
  "Politics",
  "Economy",
  "Business",
  "Technology",
  "World",
  "Jobs",
  "Explainer",
];
export const MAX_ZIP = 24 * 1024 * 1024;
const decoder = new TextDecoder("utf-8", { fatal: true });
export class ValidationError extends Error {}
export function requireValid(condition, message) {
  if (!condition) throw new ValidationError(message);
}
export function pakistanTime(ms) {
  return new Date(ms + 5 * 3600000).toISOString().slice(0, 19) + "+05:00";
}
export function scheduleTime(value) {
  requireValid(
    typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+05:00$/.test(value),
    "schedule must be YYYY-MM-DDTHH:mm:ss+05:00 (Asia/Karachi)",
  );
  const ms = Date.parse(value);
  requireValid(
    Number.isFinite(ms) && pakistanTime(ms) === value,
    "Invalid calendar date or time",
  );
  return ms;
}
export function frontMatter(raw) {
  requireValid(
    typeof raw === "string" && !raw.includes("\0"),
    "Invalid Markdown text",
  );
  const match = raw
    .replace(/\r\n/g, "\n")
    .match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  requireValid(
    match && match[2].trim(),
    "Markdown requires YAML front matter and a nonempty article body",
  );
  const doc = parseDocument(match[1], { uniqueKeys: true, schema: "core" });
  requireValid(
    !doc.errors.length && !doc.warnings.length,
    "Malformed YAML front matter",
  );
  let data;
  try {
    data = doc.toJS({ maxAliasCount: 0 });
  } catch {
    throw new ValidationError("YAML aliases are not supported");
  }
  requireValid(
    data && typeof data === "object" && !Array.isArray(data),
    "Front matter must be a mapping",
  );
  return { data, body: match[2], yaml: match[1] };
}
export function validateArticle(raw, entry) {
  requireValid(
    entry && typeof entry === "object" && !Array.isArray(entry),
    "Each manifest item must be an object",
  );
  requireValid(
    Object.keys(entry).every((k) =>
      ["article", "image", "schedule"].includes(k),
    ),
    "Manifest items allow only article, image, schedule",
  );
  requireValid(
    typeof entry.article === "string" &&
      /^articles\/\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(
        entry.article,
      ),
    "article must be articles/YYYY-MM-DD-lowercase-slug.md",
  );
  requireValid(
    typeof entry.image === "string" &&
      /^images\/[a-z0-9]+(?:-[a-z0-9]+)*\.(png|jpg|jpeg|webp)$/.test(
        entry.image,
      ),
    "image must be images/lowercase-name.png, jpg, jpeg or webp",
  );
  const due = scheduleTime(entry.schedule);
  const filename = entry.article.slice(9),
    slug = filename.slice(11, -3);
  requireValid(
    filename.slice(0, 10) === entry.schedule.slice(0, 10),
    "Article filename date must match Pakistan schedule date",
  );
  const { data, body, yaml } = frontMatter(raw);
  requireValid(
    typeof data.title === "string" &&
      data.title.trim().length > 0 &&
      data.title.length <= 300,
    "Missing or invalid title",
  );
  requireValid(
    CATEGORIES.includes(data.category),
    "category must be one of: " + CATEGORIES.join(", "),
  );
  requireValid(
    data.layout === undefined || data.layout === "article",
    "layout must be article",
  );
  requireValid(
    data.published === undefined || data.published === true,
    "published must be true or omitted",
  );
  requireValid(
    data.slug === undefined || data.slug === slug,
    "slug must match the filename",
  );
  requireValid(
    !("permalink" in data) && !("categories" in data),
    "Use the existing category and filename conventions; permalink/categories overrides are not allowed",
  );
  requireValid(
    data.image === "/assets/" + entry.image,
    "Front matter image must be /assets/" + entry.image,
  );
  if (data.date !== undefined) {
    requireValid(
      typeof data.date === "string",
      "date must use YYYY-MM-DD HH:mm:ss +0500",
    );
    const normal = data.date.replace(" ", "T").replace(" +0500", "+05:00");
    requireValid(
      scheduleTime(normal) === due,
      "Front matter date must match schedule, or omit date",
    );
  }
  // Liquid executes at build time; finished V1 Markdown must not contain executable Liquid.
  requireValid(
    !/{[{%]/.test(body + yaml),
    "Liquid templates are not supported in batch articles",
  );
  const fences = body.split("\n").filter((l) => /^\s*(`{3,}|~{3,})/.test(l));
  requireValid(fences.length % 2 === 0, "Unclosed Markdown code fence");
  for (const match of body.matchAll(/!\[[^\]]*\]\(([^\s)]+)(?:\s+[^)]*)?\)/g)) {
    requireValid(
      match[1] === data.image,
      "Inline images must reference the matching /assets/images/ image",
    );
  }
  return {
    title: data.title,
    category: data.category,
    slug,
    filename,
    postPath: "_posts/" + filename,
    imagePath: "assets/" + entry.image,
    due,
    raw,
    entry,
  };
}
export function releaseMarkdown(item, time) {
  const { yaml, body } = frontMatter(item.raw);
  // YAML-aware replacement also handles quoted keys and multiline scalar syntax.
  const date = pakistanTime(time).replace("T", " ").replace("+05:00", " +0500");
  const doc = parseDocument(yaml, { uniqueKeys: true, schema: "core" });
  doc.set("date", date);
  return `---\n${doc.toString()}---\n${body}`;
}
export function imageType(bytes, name) {
  const hex = Array.from(bytes.slice(0, 12), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
  const type = hex.startsWith("89504e470d0a1a0a")
    ? "png"
    : hex.startsWith("ffd8ff")
      ? "jpeg"
      : hex.startsWith("52494646") && hex.slice(16, 24) === "57454250"
        ? "webp"
        : "";
  const ext = name.split(".").pop();
  requireValid(
    type && (ext === type || (ext === "jpg" && type === "jpeg")),
    "Image contents do not match supported image extension: " + name,
  );
  requireValid(bytes.length >= 24, "Truncated image: " + name);
  if (type === "png") {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let at = 8,
      ended = false,
      hasData = false;
    requireValid(
      view.getUint32(8) === 13 &&
        String.fromCharCode(...bytes.slice(12, 16)) === "IHDR",
      "PNG requires IHDR",
    );
    const width = view.getUint32(16),
      height = view.getUint32(20);
    requireValid(
      width > 0 && height > 0 && width * height <= 40000000,
      "PNG dimensions exceed 40 megapixels or are invalid",
    );
    while (at < bytes.length) {
      requireValid(at + 12 <= bytes.length, "Truncated PNG chunk");
      const length = view.getUint32(at);
      requireValid(at + 12 + length <= bytes.length, "Truncated PNG data");
      let crc = 0xffffffff;
      for (let i = at + 4; i < at + 8 + length; i++) {
        crc ^= bytes[i];
        for (let bit = 0; bit < 8; bit++)
          crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
      requireValid(
        (crc ^ 0xffffffff) >>> 0 === view.getUint32(at + 8 + length),
        "Corrupt PNG checksum",
      );
      const kind = String.fromCharCode(...bytes.slice(at + 4, at + 8));
      if (kind === "IDAT") hasData = true;
      at += length + 12;
      if (kind === "IEND") {
        ended = true;
        break;
      }
    }
    requireValid(
      ended && hasData && at === bytes.length,
      "Incomplete PNG or trailing data",
    );
  } else if (type === "jpeg")
    requireValid(
      bytes.at(-2) === 255 && bytes.at(-1) === 217,
      "Truncated JPEG (missing end marker)",
    );
  else
    requireValid(
      new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(
        4,
        true,
      ) +
        8 ===
        bytes.length,
      "Truncated WebP container",
    );
  return "image/" + type;
}
export function unpackBatch(buffer, now = Date.now()) {
  requireValid(
    buffer.byteLength > 0 && buffer.byteLength <= MAX_ZIP,
    "ZIP must be at most 24 MiB",
  );
  let total = 0,
    count = 0;
  const seen = new Set();
  let files;
  try {
    files = unzipSync(new Uint8Array(buffer), {
      filter: (f) => {
        requireValid(++count <= 65, "ZIP contains too many entries");
        requireValid(!seen.has(f.name), "Duplicate ZIP entry: " + f.name);
        seen.add(f.name);
        requireValid(
          /^(manifest\.json|articles\/(?:[a-z0-9.-]+\.md)?|images\/(?:[a-z0-9-]+\.(?:png|jpg|jpeg|webp))?)$/.test(
            f.name,
          ),
          "Unexpected or unsafe ZIP path: " + f.name,
        );
        total += f.originalSize;
        requireValid(
          total <= 32 * 1024 * 1024 && f.originalSize <= 4 * 1024 * 1024,
          "Uncompressed ZIP exceeds 32 MiB or file exceeds 4 MiB",
        );
        return !f.name.endsWith("/");
      },
    });
  } catch (e) {
    throw new ValidationError("Invalid ZIP: " + e.message);
  }
  requireValid(
    files["manifest.json"] && files["manifest.json"].length <= 32768,
    "Missing or oversized manifest.json",
  );
  let manifest;
  try {
    const source = decoder.decode(files["manifest.json"]);
    requireValid(
      !parseDocument(source, { uniqueKeys: true }).errors.length,
      "Duplicate manifest keys",
    );
    manifest = JSON.parse(source);
  } catch {
    throw new ValidationError("Malformed manifest.json");
  }
  requireValid(
    manifest && manifest.version === 1 && manifest.timezone === "Asia/Karachi",
    "manifest requires version: 1 and timezone: Asia/Karachi",
  );
  requireValid(
    Object.keys(manifest).every((k) =>
      ["version", "timezone", "name", "items"].includes(k),
    ),
    "Unexpected manifest field",
  );
  requireValid(
    typeof manifest.name === "string" &&
      manifest.name.trim() &&
      manifest.name.length <= 100,
    "Batch name is required (100 characters maximum)",
  );
  requireValid(
    Array.isArray(manifest.items) &&
      manifest.items.length >= 1 &&
      manifest.items.length <= 20,
    "Batch must contain 1–20 items",
  );
  const used = new Set(["manifest.json"]),
    slugs = new Set();
  const items = manifest.items.map((e, i) => {
    try {
      requireValid(e && files[e.article], "Missing article file");
      requireValid(
        files[e.article].length <= 128 * 1024,
        "Markdown exceeds 128 KiB",
      );
      const item = validateArticle(decoder.decode(files[e.article]), e);
      requireValid(
        item.due >= now - 60000 && item.due <= now + 90 * 86400000,
        "Schedule must be now through 90 days ahead",
      );
      requireValid(
        files[e.image] && files[e.image].length > 0,
        "Missing matching image",
      );
      requireValid(!used.has(e.article), "Duplicate article filename");
      requireValid(!used.has(e.image), "Duplicate image filename");
      requireValid(!slugs.has(item.slug), "Duplicate slug");
      used.add(e.article);
      used.add(e.image);
      slugs.add(item.slug);
      return {
        ...item,
        image: files[e.image],
        mime: imageType(files[e.image], e.image),
      };
    } catch (e) {
      throw new ValidationError(`Item ${i + 1}: ${e.message}`);
    }
  });
  requireValid(
    Object.keys(files).every((p) => used.has(p)),
    "ZIP contains files not listed in the manifest",
  );
  return { name: manifest.name, items };
}
export function checkCollisions(items, tree, reserved = []) {
  requireValid(
    !tree.truncated,
    "Repository tree was truncated; cannot safely check duplicates",
  );
  const paths = new Set(tree.tree.map((x) => x.path.toLowerCase()));
  const slugs = new Set(
    tree.tree
      .filter((x) => x.path.startsWith("_posts/"))
      .map((x) =>
        x.path
          .split("/")
          .pop()
          .replace(/^\d{4}-\d{2}-\d{2}-/, "")
          .replace(/\.(md|markdown|html)$/, "")
          .toLowerCase(),
      ),
  );
  for (const item of items) {
    requireValid(
      !paths.has(item.postPath.toLowerCase()) &&
        !slugs.has(item.slug.toLowerCase()),
      "Published article collision: " + item.slug,
    );
    requireValid(
      !paths.has(item.imagePath.toLowerCase()),
      "Existing image would be overwritten: " + item.imagePath,
    );
    requireValid(
      !reserved.some(
        (r) =>
          r.slug === item.slug ||
          r.postPath === item.postPath ||
          r.imagePath === item.imagePath,
      ),
      "Another batch reserves this slug, article or image: " + item.slug,
    );
  }
}
