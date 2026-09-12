import { XMLParser, XMLValidator } from "fast-xml-parser";
import { parseHTML } from "linkedom";
import {
  assert,
  NewsroomError,
  safeURL,
  readBounded,
  decode,
  text,
  sha,
  validDate,
} from "./common.js";
const list = (x) => (x === undefined ? [] : Array.isArray(x) ? x : [x]);
export function validateSource(s) {
  assert(
    s &&
      typeof s.enabled === "boolean" &&
      typeof s.restrictionsReviewed === "boolean",
    "Source enabled/restrictionsReviewed must be booleans",
  );
  assert(s && /^[a-z][a-z0-9-]{1,40}$/.test(s.id), "Invalid source ID");
  assert(
    ["rss", "atom", "html-index", "manual"].includes(s.type),
    "Unsupported source connector",
  );
  assert(["primary", "reporting"].includes(s.role), "Source role required");
  assert(
    typeof s.owner === "string" && s.owner.trim(),
    "Source editorial ownership is required",
  );
  assert(
    s.authority >= 0 &&
      s.authority <= 1 &&
      s.priority >= 0 &&
      s.priority <= 100,
    "Invalid authority/priority",
  );
  assert(
    s.intervalMinutes >= 30 && s.intervalMinutes <= 10080,
    "Polling interval must be 30 minutes to 7 days",
  );
  safeURL(s.url, s.hosts);
  assert(
    s.role === "primary" || s.intervalMinutes >= 60,
    "Reporting sources require at least hourly intervals",
  );
  assert(
    !s.enabled || s.restrictionsReviewed === true,
    "Review source restrictions before enabling monitoring",
  );
  return s;
}
export function cleanHTML(html) {
  const { document } = parseHTML(
    "<html><body>" + text(html, 200000) + "</body></html>",
  );
  for (const e of document.querySelectorAll(
    "script,style,nav,footer,header,form,iframe,svg",
  ))
    e.remove();
  return document.body.textContent.replace(/\s+/g, " ").trim();
}
export function parseSource(body, s) {
  assert(
    typeof body === "string" && body.length <= 1024 * 1024,
    "Oversized source body",
  );
  if (s.type === "rss" || s.type === "atom") {
    assert(!/<!DOCTYPE|<!ENTITY/i.test(body), "XML entities/DOCTYPE forbidden");
    assert(XMLValidator.validate(body) === true, "Malformed feed XML");
    const doc = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@",
      processEntities: false,
      parseTagValue: false,
    }).parse(body);
    const items =
      s.type === "atom" ? list(doc.feed?.entry) : list(doc.rss?.channel?.item);
    assert(doc.feed || doc.rss?.channel, "Feed root missing");
    return items
      .slice(0, 30)
      .map((i) => {
        const link =
          s.type === "atom"
            ? list(i.link).find(
                (l) => !l["@rel"] || l["@rel"] === "alternate",
              )?.["@href"]
            : i.link;
        return {
          title: cleanHTML(
            typeof i.title === "object" ? i.title["#text"] : i.title,
          ),
          url: link,
          publishedAt: i.pubDate || i.published || i.updated || null,
          summary:
            s.role === "primary"
              ? cleanHTML(
                  i.description || i.summary?.["#text"] || i.summary || "",
                )
              : "",
        };
      })
      .filter((i) => i.title && i.url);
  }
  if (s.type === "html-index") {
    assert(
      s.linkPattern && s.linkPattern.length <= 100,
      "Index link filter required",
    );
    const { document } = parseHTML(body);
    const patterns = s.linkPattern.toLowerCase().split("|").filter(Boolean);
    return [...document.querySelectorAll("a[href]")]
      .map((a) => ({
        title: a.textContent.trim(),
        url: new URL(a.getAttribute("href"), s.url).href,
        publishedAt: null,
        summary: "",
      }))
      .filter(
        (i) =>
          i.title.length >= 20 &&
          i.title.length <= 300 &&
          patterns.some((p) => i.url.toLowerCase().includes(p)),
      )
      .slice(0, 30);
  }
  throw new NewsroomError("Manual sources do not have a polling connector");
}
// Conservative RFC-style group handling: choose the most specific user-agent group;
// unknown/failed robots retrieval blocks fetch, and explicit disallow is never bypassed.
export function robotsAllowed(body, url) {
  assert(body.length <= 128 * 1024, "Oversized robots file");
  const groups = [];
  let agents = [],
    rules = [],
    started = false;
  const flush = () => {
    if (agents.length) groups.push({ agents, rules });
    agents = [];
    rules = [];
    started = false;
  };
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim();
    const m = line.match(/^([^:]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase(),
      value = m[2].trim();
    if (key === "user-agent") {
      if (started) flush();
      agents.push(value.toLowerCase());
    } else if (["allow", "disallow"].includes(key)) {
      rules.push({ kind: key, path: value });
      started = true;
    }
  }
  flush();
  const bot = "pakistanreportnewsroom";
  const specific = groups.filter((g) =>
    g.agents.some((a) => a !== "*" && bot.includes(a)),
  );
  const selected = specific.length
    ? specific
    : groups.filter((g) => g.agents.includes("*"));
  const path = new URL(url).pathname + new URL(url).search;
  const matches = [];
  for (const g of selected)
    for (const r of g.rules) {
      if (!r.path) continue;
      const escaped = r.path
        .replace(/[.+?^{}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*");
      if (new RegExp("^" + escaped).test(path)) matches.push(r);
    }
  matches.sort(
    (a, b) => b.path.length - a.path.length || (a.kind === "allow" ? -1 : 1),
  );
  return !matches.length || matches[0].kind === "allow";
}
export class SourceClient {
  constructor(fetcher = (...args) => fetch(...args)) {
    this.fetcher = fetcher;
  }
  async request(url, s, headers = {}) {
    safeURL(url, s.hosts);
    let r;
    try {
      r = await this.fetcher(url, {
        headers: {
          "User-Agent":
            "PakistanReportNewsroom/1.0 (+https://pakistanreport.pakistanreportnews.workers.dev/contact/)",
          ...headers,
        },
        redirect: "manual",
        signal: AbortSignal.timeout(12000),
      });
    } catch {
      throw new NewsroomError("Source network failure or timeout", 503, true);
    }
    assert(
      ![301, 302, 303, 307, 308].includes(r.status),
      "Source redirected; review and update registry URL (not followed)",
      409,
    );
    if (r.status >= 500 || r.status === 429)
      throw new NewsroomError("Source temporary HTTP " + r.status, 503, true);
    assert(
      r.ok || [304, 404].includes(r.status),
      "Source access restricted: HTTP " + r.status,
      403,
    );
    return r;
  }
  async allowed(url, s) {
    const robots = await this.request(new URL("/robots.txt", url).href, s);
    if (robots.status === 404) return;
    assert(robots.ok, "Robots policy unavailable");
    const policy=decode(await readBounded(robots,128*1024));
    assert(!/<html|<!doctype html/i.test(policy),"Robots response is an HTML page; manual access review required",403);
    assert(robotsAllowed(policy,url),"Source robots.txt disallows this path",403);
    // Conservatively honor the largest advertised crawl delay, even across groups.
    const delays=[...policy.matchAll(/^crawl-delay:\s*([0-9.]+)/gim)].map(m=>Number(m[1]));
    assert(delays.every(n=>Number.isFinite(n)&&n>=0&&n<=31536000),"Invalid crawl delay; manual access review required");
    return Math.max(0,...delays);
  }
  async poll(s, previous = {}, now = Date.now()) {
    validateSource(s);
    assert(s.enabled, "Source disabled");
    assert(s.type !== "manual", "Manual source cannot be polled");
    if (previous.nextPollAt > now) return { skipped: true };
    const crawlDelay=(await this.allowed(s.url,s))||0;
    const headers = {};
    if (previous.etag) headers["If-None-Match"] = previous.etag;
    if (previous.modified) headers["If-Modified-Since"] = previous.modified;
    const r = await this.request(s.url, s, headers);
    const metadata = {
      lastPollAt: now,
      nextPollAt: now + Math.max(s.intervalMinutes * 60000,crawlDelay*1000),
      etag: r.headers.get("etag") || previous.etag || null,
      modified: r.headers.get("last-modified") || previous.modified || null,
    };
    if (r.status === 304)
      return { ...metadata, observations: [], notModified: true };
    assert(r.ok, "Source not found");
    const body = decode(await readBounded(r));
    const observations = [];
    let skipped = 0;
    for (const item of parseSource(body, s)) {
      try {
        observations.push(await normalizeObservation(item, s, now));
      } catch {
        skipped++;
      }
    }
    return { ...metadata, observations, skippedItems: skipped };
  }
  async document(observation, s) {
    assert(
      s.role === "primary",
      "Automated full-document retrieval is restricted to primary sources",
    );
    assert(
      !/\.pdf(?:[?#]|$)/i.test(observation.url),
      "PDF requires manually checked text/document evidence",
    );
    const delay=(await this.allowed(observation.url,s))||0;
    assert(delay===0,"Source advertises crawl-delay; use manually checked document evidence instead of immediate follow-up retrieval",409);
    const r = await this.request(observation.url, s);
    assert(r.ok, "Document unavailable");
    assert(
      /text\/html|text\/plain/.test(r.headers.get("content-type") || ""),
      "Unsupported document content type",
    );
    const body = decode(await readBounded(r));
    const plain = cleanHTML(body).slice(0, 12000);
    assert(
      plain.length >= 80,
      "Document text unavailable; manual evidence required",
    );
    return {
      text: plain,
      hash: await sha(plain),
      retrievedAt: new Date().toISOString(),
      method: "primary-document",
    };
  }
}
export async function normalizeObservation(item, s, now = Date.now()) {
  assert(item && typeof item === "object", "Malformed source item");
  const title = text(item.title, 300);
  assert(title.length >= 10, "Source title missing/too short");
  const url = safeURL(item.url, s.hosts);
  let publishedAt = null;
  if (item.publishedAt) {
    const date = Date.parse(item.publishedAt);
    assert(
      Number.isFinite(date) && date <= now + 3600000,
      "Invalid/future source date",
    );
    publishedAt = new Date(date).toISOString();
  }
  const summary = text(item.summary, s.role === "primary" ? 2000 : 0);
  return {
    id: await sha(
      s.id + "|" + url + "|" + title + "|" + summary + "|" + publishedAt,
    ),
    sourceId: s.id,
    title,
    url,
    publishedAt,
    retrievedAt: new Date(now).toISOString(),
    summary,
    sourceSnapshot: {
      name: s.name,
      role: s.role,
      owner: s.owner,
      authority: s.authority,
    },
    contentHash: await sha(title + "|" + summary),
  };
}
