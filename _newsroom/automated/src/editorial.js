import { assert, similarity, tokens, text, words } from "./common.js";
import { CATEGORIES } from "../../publisher/src/validation.js";
export const THRESHOLD = 65;
export const LENGTHS = {
  Breaking: [250, 400],
  Standard: [400, 650],
  Important: [550, 800],
  Explainer: [700, 1200],
  "Deep analysis": [1200, 2000],
};
export const SECTIONS = [
  "What happened",
  "Facts and context",
  "Why it matters",
  "What happens next",
];
export function rank(observations, sources, now = Date.now()) {
  const corpus = observations
    .map((o) => o.title + " " + o.summary)
    .join(" ")
    .toLowerCase();
  const factors = [];
  const add = (name, points) => factors.push({ name, points });
  const authority = Math.max(
    ...observations.map(
      (o) => sources.find((s) => s.id === o.sourceId)?.authority || 0,
    ),
  );
  add("Source authority", Math.round(authority * 15));
  const primary = observations.some(
    (o) => sources.find((s) => s.id === o.sourceId)?.role === "primary",
  );
  if (primary) add("Primary source", 15);
  if (
    /pakistan|pakistani|sbp|state bank|fbr|parliament|supreme court|national|federal/.test(
      corpus,
    )
  )
    add("National relevance", 15);
  if (
    /policy rate|inflation|tax|budget|reserves|electricity|petrol|diesel|exports|imports|jobs|employment|wage|tariff/.test(
      corpus,
    )
  )
    add("Economic/citizen impact", 20);
  if (
    /bill|legislation|court|election|parliament|constitutional|cabinet decision|judgment|ruling/.test(
      corpus,
    )
  )
    add("Political/public significance", 20);
  if (
    /cut|raise|raised|rises|falls|approved|enacted|orders|announced|effective|released|published|changed|revised/.test(
      corpus,
    )
  )
    add("Concrete development", 15);
  const dates = observations
    .map((o) => Date.parse(o.publishedAt))
    .filter(Number.isFinite);
  const age = dates.length ? (now - Math.max(...dates)) / 3600000 : Infinity;
  add("Timeliness", age <= 24 ? 10 : age <= 72 ? 5 : age <= 168 ? 0 : -20);
  add("Novel candidate", 10);
  if (
    /because|effective|deadline|from|basis points|percent|%|million|billion/.test(
      corpus,
    )
  )
    add("Explanatory value", 5);
  const owners = new Set(
    observations.map((o) => sources.find((s) => s.id === o.sourceId)?.owner),
  );
  if (owners.size >= 2) add("Independent source groups", 10);
  if (
    /memorandum of understanding|\bmou\b|ceremonial|courtesy call|pledged cooperation|strengthen.*ties|routine meeting|goodwill visit/.test(
      corpus,
    )
  )
    add("Routine PR / ceremonial announcement", -75);
  if (
    /speech|addressed.*conference/.test(corpus) &&
    !/enacted|approved|effective|orders|policy rate/.test(corpus)
  )
    add("Speech without material action", -40);
  if (
    /minor administrative|retirement ceremony|transfer of.*officer/.test(corpus)
  )
    add("Minor administrative notice", -55);
  if (/rumou?r|unconfirmed|speculat|may reportedly/.test(corpus))
    add("Speculation", -45);
  const score = Math.max(
    0,
    Math.min(
      100,
      factors.reduce((sum, f) => sum + f.points, 0),
    ),
  );
  return { score, threshold: THRESHOLD, advance: score >= THRESHOLD, factors };
}
export function sameEvent(a, b) {
  const ad = Date.parse(a.publishedAt || a.retrievedAt),
    bd = Date.parse(b.publishedAt || b.retrievedAt);
  if (Math.abs(ad - bd) > 72 * 3600000) return false;
  const ac = a.title + " " + a.summary,
    bc = b.title + " " + b.summary;
  // Similarity is only a candidate-clustering aid. Differing figures remain evidence,
  // never silently overwrite a report; editors can split a mistaken cluster.
  return similarity(a.title, b.title) >= 0.58 || similarity(ac, bc) >= 0.72;
}
export function riskFor(candidate, claims = []) {
  const corpus = [
    ...candidate.observations.map((o) => o.title + " " + o.summary),
    ...claims.map((c) => c.text),
  ].join(" ");
  const matches = [];
  for (const [label, re] of [
    [
      "allegation/crime",
      /alleg|accus|arrest|criminal|murder|fraud|corruption|suspect/i,
    ],
    [
      "death/security",
      /\bdead\b|death|killed|casualt|terror|attack|military|security incident/i,
    ],
    [
      "judicial/election dispute",
      /court|judgment|lawsuit|election|ballot|constitutional|dispute/i,
    ],
    [
      "communal/religious tension",
      /communal|sectarian|blasphem|religious tension/i,
    ],
    [
      "political sensitivity",
      /parliament|political|prime minister|opposition|minister accused/i,
    ],
  ])
    if (re.test(corpus)) matches.push(label);
  const conflicts = findConflicts(claims);
  if (conflicts.length) matches.push("conflicting material reports");
  const level = matches.length
    ? "SENSITIVE"
    : /statistics|data release|application deadline|public timetable/i.test(
          corpus,
        )
      ? "LOW"
      : "NORMAL";
  return {
    level,
    reasons: matches.length
      ? matches
      : ["No sensitive trigger detected; human factual review still required"],
    conflicts,
  };
}
export function findConflicts(claims) {
  const out = [];
  for (let i = 0; i < claims.length; i++)
    for (let j = i + 1; j < claims.length; j++) {
      const a = claims[i],
        b = claims[j];
      if (a.key && a.key === b.key && a.value !== b.value)
        out.push({
          key: a.key,
          claims: [a.id, b.id],
          values: [a.value, b.value],
        });
    }
  return out;
}
function numericTokens(s) {
  return new Set(
    (s.match(/\b\d+(?:[.,]\d+)*(?:%|\b)/g) || []).map((v) =>
      v.replace(/,/g, ""),
    ),
  );
}
export function verifyClaims(claims, observations, sources) {
  const errors = [],
    results = [];
  if (!Array.isArray(claims) || !claims.length || claims.length > 40)
    return {
      ok: false,
      errors: ["Require 1–40 material claims with evidence"],
      claims: [],
    };
  const ids = new Set();
  for (const claim of claims) {
    const issues = [];
    if (!claim || !/^c[a-z0-9-]{1,40}$/.test(claim.id) || ids.has(claim.id)) {
      errors.push("Invalid or duplicate claim ID");
      continue;
    }
    ids.add(claim.id);
    if (
      typeof claim.text !== "string" ||
      claim.text.length < 15 ||
      claim.text.length > 1500
    )
      issues.push("Claim text required");
    if (
      typeof claim.key !== "string" ||
      !claim.key ||
      typeof claim.value !== "string" ||
      !claim.value
    )
      issues.push("Claim comparison key and value required");
    const refs = Array.isArray(claim.evidence) ? claim.evidence : [];
    if (!refs.length || refs.length > 8)
      issues.push("Claim evidence missing or excessive");
    const owners = new Set();
    let primary = false;
    const quotes = [];
    for (const ref of refs) {
      const obs = observations.find((o) => o.id === ref.observationId);
      const source = sources.find((s) => s.id === obs?.sourceId);
      if (!obs || !source) {
        issues.push("Unknown evidence/source");
        continue;
      }
      const corpus = obs.document?.text || obs.summary || "";
      if (
        typeof ref.quote !== "string" ||
        ref.quote.length < 15 ||
        ref.quote.length > 600 ||
        !corpus.includes(ref.quote)
      ) {
        issues.push("Evidence excerpt is not present in retained source text");
        continue;
      }
      if (!obs.document && source.role !== "primary")
        issues.push(
          "Reporting headline is discovery only, not factual evidence",
        );
      if (obs.document?.method === "manual" && !obs.document.editorConfirmed)
        issues.push("Manual evidence has not been confirmed by editor");
      owners.add(source.owner);
      if (source.role === "primary") primary = true;
      quotes.push(ref.quote);
    }
    if (!primary && owners.size < 2)
      issues.push("Need a primary source or two independent reporting groups");
    for (const n of numericTokens(claim.text || ""))
      if (!numericTokens(quotes.join(" ")).has(n))
        issues.push("Claim number/date not present in evidence: " + n);
    if (similarity(claim.text || "", quotes.join(" ")) < 0.2)
      issues.push("Claim and evidence have insufficient topical overlap");
    results.push({
      id: claim.id,
      status: issues.length ? "Unsupported" : "Evidence linked",
      sourceGroups: owners.size,
      primary,
      issues,
    });
    for (const issue of issues) errors.push(claim.id + ": " + issue);
  }
  return {
    ok: errors.length === 0,
    errors,
    claims: results,
    meaning:
      "Evidence linkage is mechanically checked; truth and semantic entailment require editor attestation.",
  };
}
export function editorialChecks(
  candidate,
  sources,
  coverage = [],
  now = Date.now(),
) {
  const d = candidate.draft;
  const checks = [];
  const check = (name, pass, detail) =>
    checks.push({ name, pass: Boolean(pass), detail });
  check(
    "Newsworthiness",
    candidate.selection?.advance,
    "Threshold " + THRESHOLD + "; no quota",
  );
  if (!d) {
    check("Article completeness", false, "Draft not available");
    return {
      passed: false,
      checks,
      risk: riskFor(candidate),
      verification: { ok: false, errors: ["No draft"] },
    };
  }
  const verified = verifyClaims(d.claims, candidate.observations, sources);
  const risk = riskFor(candidate, d.claims || []);
  check(
    "Source provenance",
    verified.ok,
    verified.errors.join("; ") ||
      "Every claim has retained source evidence; editor must assess meaning.",
  );
  check(
    "Risk classification",
    ["LOW", "NORMAL", "SENSITIVE"].includes(d.risk) &&
      { LOW: 0, NORMAL: 1, SENSITIVE: 2 }[d.risk] >=
        { LOW: 0, NORMAL: 1, SENSITIVE: 2 }[risk.level],
    "Minimum classification: " + risk.level,
  );
  const sensitive = risk.level === "SENSITIVE" || d.risk === "SENSITIVE";
  check(
    "Sensitive corroboration",
    !sensitive || verified.claims.every((c) => c.sourceGroups >= 2),
    "Sensitive claims need two independent editorial/institutional groups.",
  );
  const paras = Array.isArray(d.paragraphs) ? d.paragraphs : [];
  const body = paras.map((p) => p.text).join("\n\n");
  const wc = words(body).length;
  const length = LENGTHS[d.format];
  check(
    "Article completeness",
    length &&
      wc >= length[0] &&
      wc <= length[1] &&
      SECTIONS.every((s) => paras.some((p) => p.section === s)),
    `Word count ${wc}; required ${length?.join("–") || "valid format"}; four editorial sections required`,
  );
  check(
    "Category validity",
    CATEGORIES.includes(d.category),
    "Publisher category is Explainer (singular), not Explainers. Politics remains a core category.",
  );
  check(
    "Headline and deck",
    typeof d.headline === "string" &&
      d.headline.length >= 15 &&
      d.headline.length <= 180 &&
      typeof d.deck === "string" &&
      d.deck.length >= 30 &&
      d.deck.length <= 400 &&
      !/shocking|you won.t believe|bombshell|jaw-dropping/i.test(d.headline),
    "Clear, bounded headline and deck; no clickbait triggers.",
  );
  check(
    "Headline/body consistency",
    similarity(d.headline || "", body) >= 0.45,
    "Headline must have substantial topical overlap with the body; editor confirms meaning.",
  );
  check(
    "Slug",
    typeof d.slug === "string" &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(d.slug) &&
      d.slug.length <= 120,
    "Lowercase hyphenated slug required.",
  );
  const claimMap = new Map((d.claims || []).map((c) => [c.id, c]));
  let coverageOK = paras.length >= 4;
  for (const p of paras) {
    if (
      !SECTIONS.includes(p.section) ||
      typeof p.text !== "string" ||
      !Array.isArray(p.claimIds) ||
      !p.claimIds.length ||
      p.claimIds.some((id) => !claimMap.has(id))
    )
      coverageOK = false;
  }
  check(
    "Paragraph claim coverage",
    coverageOK,
    "Every paragraph must identify the factual claims supporting it.",
  );
  const allEvidence = (d.claims || [])
    .flatMap((c) => (c.evidence || []).map((e) => e.quote || ""))
    .join(" ");
  let numbersOK = true;
  for (const n of numericTokens([d.headline, d.deck, body].join(" ")))
    if (!numericTokens(allEvidence).has(n)) numbersOK = false;
  check(
    "Dates and numbers",
    numbersOK,
    "All output numbers/dates must appear in retained supporting evidence.",
  );
  const conflictIds = new Set(risk.conflicts.flatMap((c) => c.claims));
  const namedInBody = new Set(paras.flatMap((p) => p.claimIds || []));
  check(
    "Conflicting reports",
    !risk.conflicts.length ||
      (/conflicting|disputed|differing accounts|could not establish/i.test(
        body,
      ) &&
        [...conflictIds].every((id) => namedInBody.has(id))),
    "Conflicting values must remain visible and attributed; no silent choice of a version.",
  );
  const quoted = [...body.matchAll(/[“"]([^”"]+)[”"]/g)].map((m) => m[1]);
  check(
    "Quotations",
    quoted.every((q) => allEvidence.includes(q)),
    "Any quotation must match retained evidence exactly.",
  );
  const sourceTexts = candidate.observations
    .map((o) => o.document?.text || o.summary)
    .filter(Boolean);
  let copied = 0;
  const outputWords = words(body);
  const sourceWordStrings=sourceTexts.map(s=>words(s).join(" "));
  for (let i = 0; i + 14 <= outputWords.length; i++) {
    const segment = outputWords.slice(i, i + 14).join(" ");
    if (sourceWordStrings.some((s) => s.includes(segment))) copied++;
  }
  check(
    "Originality heuristic",
    copied === 0,
    "No unquoted fourteen-word source match; this is a heuristic, not a copyright determination.",
  );
  check(
    "Duplicate coverage",
    !coverage.some(
      (c) =>
        c.id !== candidate.id &&
        (c.slug === d.slug || similarity(c.title || "", d.headline) >= 0.8),
    ),
    "Compared with local candidates and imported published-article index.",
  );
  const v = candidate.visual;
  check(
    "Visual requirement",
    v?.status === "Complete" &&
      v?.kind === "illustration" &&
      v?.caption === "Pakistan Report illustration." &&
      v?.reviewed === true &&
      typeof v.alt === "string" &&
      v.alt.length >= 15 &&
      v?.fileHash,
    "Editor-confirmed PNG/JPEG/WebP illustration required; no fabricated documentary photography.",
  );
  check(
    "Safe Markdown/front matter",
    !/{[{%]|<script|javascript:|^---$/im.test(body) && !body.includes("\0"),
    "No executable Liquid, scripts, or embedded front-matter delimiters.",
  );
  check(
    "Freshness",
    candidate.observations.some(
      (o) => o.publishedAt && now - Date.parse(o.publishedAt) <= 7 * 86400000,
    ),
    "At least one dated source in the last seven days.",
  );
  return {
    passed: checks.every((c) => c.pass),
    checks,
    risk,
    verification: verified,
    wordCount: wc,
  };
}
export function visualBrief(candidate) {
  return {
    status: "Awaiting visual",
    kind: "illustration",
    caption: "Pakistan Report illustration.",
    alt: "",
    brief:
      "Create a clearly illustrative, non-photographic editorial graphic about " +
      (candidate.draft?.headline || candidate.observations[0].title) +
      ". Use neutral conceptual shapes and relevant objects. Do not depict actual incidents, victims, named people, evidence, documents or official seals. Do not add unsupported figures. No event photography or misleading realism.",
    reviewed: false,
  };
}
export function validateDraftShape(d) {
  assert(
    d && typeof d === "object" && !Array.isArray(d),
    "Structured draft object required",
  );
  for (const key of ["headline", "deck", "category", "format", "slug", "risk"])
    assert(
      typeof d[key] === "string" && d[key].length <= 1000,
      "Invalid draft field: " + key,
    );
  assert(
    Array.isArray(d.claims) && d.claims.length >= 1 && d.claims.length <= 40,
    "Draft needs 1–40 claims",
  );
  assert(
    Array.isArray(d.paragraphs) &&
      d.paragraphs.length >= 4 &&
      d.paragraphs.length <= 40,
    "Draft needs 4–40 paragraphs",
  );
  for (const c of d.claims) {
    assert(
      c &&
        typeof c === "object" &&
        typeof c.id === "string" &&
        typeof c.text === "string" &&
        typeof c.key === "string" &&
        typeof c.value === "string" &&
        Array.isArray(c.evidence),
      "Malformed claim",
    );
    for (const e of c.evidence)
      assert(
        e && typeof e.observationId === "string" && typeof e.quote === "string",
        "Malformed evidence reference",
      );
  }
  for (const p of d.paragraphs)
    assert(
      p &&
        typeof p.text === "string" &&
        p.text.length <= 10000 &&
        typeof p.section === "string" &&
        Array.isArray(p.claimIds) &&
        p.claimIds.every((x) => typeof x === "string"),
      "Malformed paragraph",
    );
  return d;
}
