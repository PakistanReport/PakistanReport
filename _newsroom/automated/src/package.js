import { zipSync, strToU8 } from "fflate";
import { stringify } from "yaml";
import { unpackBatch, scheduleTime } from "../../publisher/src/validation.js";
import { assert } from "./common.js";
export function makePackage(candidate, image, schedule, now = Date.now()) {
  assert(
    candidate.state === "Approved" &&
      candidate.approval?.revision === candidate.revision,
    "A current explicit human approval is required",
    409,
  );
  scheduleTime(schedule);
  const d = candidate.draft;
  const filename = schedule.slice(0, 10) + "-" + d.slug + ".md";
  const imageName =
    d.slug + "-" + candidate.id.slice(0, 8) + "." + candidate.visual.extension;
  const lines = [];
  let section = "";
  for (const p of d.paragraphs) {
    if (p.section !== section) {
      section = p.section;
      lines.push("## " + section);
    }
    lines.push(p.text);
  }
  const sources = new Map();
  for (const c of d.claims)
    for (const e of c.evidence) {
      const obs = candidate.observations.find((o) => o.id === e.observationId);
      if (obs) sources.set(obs.url, obs);
    }
  lines.push(
    "## Sources",
    ...[...sources.values()].map(
      (o) => "- [" + o.title.replace(/[\[\]]/g, "") + "](" + o.url + ")",
    ),
  );
  const raw =
    "---\n" +
    stringify({
      layout: "article",
      title: d.headline,
      description: d.deck,
      category: d.category,
      author: "Pakistan Report Editorial Desk",
      published: true,
      image: "/assets/images/" + imageName,
      image_alt: candidate.visual.alt,
      image_caption: candidate.visual.caption,
    }) +
    "---\n\n" +
    lines.join("\n\n") +
    "\n";
  const manifest = {
    version: 1,
    timezone: "Asia/Karachi",
    name: "Newsroom approved: " + d.headline.slice(0, 70),
    items: [
      {
        article: "articles/" + filename,
        image: "images/" + imageName,
        schedule,
      },
    ],
  };
  const zip = zipSync(
    {
      "manifest.json": strToU8(JSON.stringify(manifest, null, 2)),
      ["articles/" + filename]: strToU8(raw),
      ["images/" + imageName]: image,
    },
    { level: 0, mtime: new Date("2026-01-01T00:00:00Z") },
  );
  const validated = unpackBatch(zip, now);
  assert(validated.items.length === 1, "Publisher validator rejected package");
  return { zip, manifest, raw };
}
