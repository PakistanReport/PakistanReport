export class NewsroomError extends Error {
  constructor(message, status = 400, retryable = false) {
    super(message);
    this.name = "NewsroomError";
    this.status = status;
    this.retryable = retryable;
  }
}
export function assert(ok, message, status = 400) {
  if (!ok) throw new NewsroomError(message, status);
}
export const sha = async (value) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", value instanceof Uint8Array ? value : new TextEncoder().encode(value)),
    ),
    (v) => v.toString(16).padStart(2, "0"),
  ).join("");
export const text = (value, max = 2000) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
export function words(value) {
  return (
    text(value, 50000)
      .toLowerCase()
      .match(/[a-z0-9]+/g) || []
  );
}
const STOP = new Set(
  "a an the and of in to for on at by is are was were has have with from that this as its after over new says said pakistan pakistani".split(
    " ",
  ),
);
export const tokens = (value) =>
  new Set(words(value).filter((w) => w.length > 2 && !STOP.has(w)));
export function similarity(a, b) {
  const aa = tokens(a),
    bb = tokens(b);
  if (!aa.size || !bb.size) return 0;
  let overlap = 0;
  for (const x of aa) if (bb.has(x)) overlap++;
  return overlap / Math.min(aa.size, bb.size);
}
export function validDate(value) {
  const n = Date.parse(value);
  assert(
    typeof value === "string" &&
      /(?:Z|[+-]\d\d:\d\d)$/.test(value) &&
      Number.isFinite(n),
    "Date requires a valid explicit timezone",
  );
  return new Date(n).toISOString();
}
export function safeURL(value, hosts) {
  let u;
  try {
    u = new URL(value);
  } catch {
    throw new NewsroomError("Invalid source URL");
  }
  assert(
    u.protocol === "https:" && !u.username && !u.password && !u.port,
    "Only credential-free HTTPS source URLs are allowed",
  );
  assert(
    Array.isArray(hosts) && hosts.includes(u.hostname),
    "URL host is outside the source allowlist",
  );
  assert(
    !/^(localhost|.*\.localhost|.*\.local|.*\.internal|\d+(\.\d+)*|\[.*\])$/.test(
      u.hostname,
    ),
    "Private or numeric hosts are forbidden",
  );
  u.hash = "";
  for (const k of [...u.searchParams.keys()])
    if (k.startsWith("utm_") || ["fbclid", "gclid"].includes(k))
      u.searchParams.delete(k);
  u.searchParams.sort();
  return u.href;
}
export async function readBounded(response, limit = 1024 * 1024) {
  const reader = response.body?.getReader();
  assert(reader, "Empty response body");
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new NewsroomError("Response exceeds safe size limit");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  return bytes;
}
export const decode = (bytes) =>
  new TextDecoder("utf-8", { fatal: true }).decode(bytes);
export const json = (value, status = 200) => Response.json(value, { status });
