// Entirely synthetic editorial fixtures. These are not reports of real developments.
export const NOW = Date.parse("2026-09-12T08:00:00Z");
export const sources = [
  {
    id: "sbp-fixture",
    name: "SIMULATED central bank",
    type: "rss",
    url: "https://sbp.example/feed",
    hosts: ["sbp.example"],
    category: "Economy",
    role: "primary",
    owner: "Fixture central bank",
    authority: 1,
    priority: 100,
    intervalMinutes: 60,
    enabled: true,
    restrictionsReviewed: true,
  },
  {
    id: "wire-fixture",
    name: "SIMULATED independent wire",
    type: "rss",
    url: "https://wire.example/feed",
    hosts: ["wire.example"],
    category: "Economy",
    role: "reporting",
    owner: "Fixture wire",
    authority: 0.9,
    priority: 70,
    intervalMinutes: 60,
    enabled: true,
    restrictionsReviewed: true,
  },
  {
    id: "court-fixture",
    name: "SIMULATED court registry",
    type: "manual",
    url: "https://court.example/",
    hosts: ["court.example"],
    category: "Politics",
    role: "primary",
    owner: "Fixture court",
    authority: 1,
    priority: 100,
    intervalMinutes: 60,
    enabled: false,
    restrictionsReviewed: true,
  },
  {
    id: "report-fixture",
    name: "SIMULATED second independent outlet",
    type: "manual",
    url: "https://report.example/",
    hosts: ["report.example"],
    category: "Politics",
    role: "reporting",
    owner: "Fixture second outlet",
    authority: 0.9,
    priority: 70,
    intervalMinutes: 60,
    enabled: false,
    restrictionsReviewed: true,
  },
];
const at = new Date(NOW - 3600000).toISOString();
export const important = {
  title:
    "SIMULATED Pakistan State Bank cuts policy rate by 100 basis points to 10 percent",
  url: "https://sbp.example/policy-decision",
  publishedAt: at,
  summary:
    "SIMULATED Pakistan State Bank announced a policy rate cut effective now, with implications for inflation, borrowers and savers.",
};
export const sameEvent = {
  title:
    "SIMULATED State Bank Pakistan cuts policy rate to 10 percent by 100 basis points",
  url: "https://wire.example/pakistan-policy-rate",
  publishedAt: at,
  summary: "",
};
export const routine = {
  title:
    "SIMULATED Pakistan officials sign routine MoU at ceremonial cooperation meeting",
  url: "https://sbp.example/ceremonial-mou",
  publishedAt: at,
  summary:
    "Officials pledged cooperation during a goodwill visit and signed a memorandum of understanding to strengthen ties.",
};
export const sensitive = {
  title: "SIMULATED Pakistan court orders review of disputed election results",
  url: "https://court.example/election-dispute",
  publishedAt: at,
  summary:
    "The court ordered review after conflicting reports of disputed polling-station totals; the case raises constitutional issues.",
};
export const sensitiveWire = {
  title: "SIMULATED Pakistan court review of disputed election results ordered",
  url: "https://wire.example/election-dispute",
  publishedAt: at,
  summary: "",
};
export const sensitiveReport = {
  title: "SIMULATED Pakistan court orders disputed election results review",
  url: "https://report.example/election-dispute",
  publishedAt: at,
  summary: "",
};
export const insufficient = {
  title: "SIMULATED Pakistan federal tax hike announced with national impact",
  url: "https://wire.example/unsupported-tax",
  publishedAt: at,
  summary: "",
};
export const economyDocument = `SIMULATED SOURCE DOCUMENT — NOT REAL NEWS.
The policy committee reduced the benchmark rate by 100 basis points to 10 percent, effective immediately.
The statement described slower price growth as the basis for its decision, while warning that the outlook remained uncertain.
The policy rate guides short-term financial conditions but is not the rate charged on every commercial loan.
Existing borrowing contracts determine whether and when a policy change affects a customer's repayments.
Deposit returns are set by product terms and applicable rules rather than by an automatic identical adjustment.
A lower rate can influence financing costs, but credit availability also depends on lender decisions and borrower circumstances.
Future decisions will depend on incoming inflation and external-sector data, and the statement made no commitment to further cuts.
The statement did not supply revised repayments for individual borrowers or a schedule of changes to retail banking products.
This synthetic document exists only to test evidence-linked editorial preparation.`;
export const courtDocument = `SIMULATED COURT DOCUMENT — NOT REAL NEWS.
The court ordered scrutiny of disputed election records and did not declare a winner.
The petition describes 12 disputed polling stations, while the responding submission describes 15 disputed polling stations.
The registry records both submissions without endorsing either total.
The court said its review concerns the documentary record and that allegations remain unproved.
A procedural direction does not resolve the merits or establish the truth of disputed allegations.
The publicly available direction contains no date for a final determination.
Neither litigants nor outside observers can infer a final electoral result from the direction alone.
The original records and the parties' responses are the next materials required for scrutiny.`;
export const wireCourtDocument =
  courtDocument +
  " Independent fixture wire reports the petition description of 12 disputed polling stations and the responding description of 15 disputed polling stations.";
export const documents = {
  [important.url]: economyDocument,
  [sameEvent.url]: economyDocument,
  [sensitive.url]: courtDocument,
  [sensitiveWire.url]: wireCourtDocument,
  [sensitiveReport.url]: wireCourtDocument,
};
const economyParagraphs = [
  [
    "What happened",
    `A simulated policy decision has moved Pakistan's benchmark interest rate lower, placing the focus on how a central-bank adjustment reaches households and businesses. The committee's announced reduction is 100 basis points, taking the policy rate to 10 percent. The decision is effective immediately. It is a change to the policy benchmark, rather than a statement that every bank customer will receive an identical reduction in the cost of borrowing.`,
    ["c1", "c3"],
  ],
  [
    "Facts and context",
    `The committee's explanation centres on slower growth in prices, but its statement also recognises uncertainty around the outlook. That qualification matters when interpreting the decision: the evidence describes the reason for the current adjustment without promising a continuing series of reductions. The distinction between the benchmark and the price of a particular financial product is equally important. Commercial lending terms are not interchangeable with the central bank's headline rate.`,
    ["c2", "c3"],
  ],
  [
    "Facts and context",
    `For an existing borrower, the relevant evidence is the agreement governing the loan. Its terms determine whether a benchmark movement affects the payment and when any adjustment can take place. The central-bank statement supplies no replacement repayment table for individual customers. It would therefore be unsupported to turn the policy announcement into a precise claim about a household's monthly saving or a company's next instalment.`,
    ["c4", "c8"],
  ],
  [
    "Why it matters",
    `The change is relevant to financing conditions because the policy benchmark helps guide short-term financial conditions. Even so, a lower benchmark does not by itself settle whether a lender will extend credit or what terms a particular applicant will receive. Those decisions also depend on the lender and the borrower's circumstances. Explaining that limit gives readers a more useful interpretation than presenting the decision as a guaranteed reduction in every borrowing cost.`,
    ["c3", "c6"],
  ],
  [
    "Why it matters",
    `Savers face a related distinction. The return on a deposit follows the product's conditions and the rules that apply to it; the policy decision is not an announcement of identical changes across every savings account. The source statement offers no retail-product timetable. Readers would need the terms of their own product to establish the effect on them, rather than treating a change in the benchmark as a personalised instruction from their bank.`,
    ["c5", "c8"],
  ],
  [
    "What happens next",
    `The committee has tied its future decisions to incoming information about inflation and the external sector. It has not committed to another cut. The next useful assessment will therefore need to compare new data with the reasoning given for this decision, while keeping the current announcement separate from predictions about future policy. On the information available in this simulated case, the direction of the next decision and individual retail-product changes remain unestablished.`,
    ["c7", "c8"],
  ],
];
export function economyDraft(c) {
  const primary = c.observations.find((o) => o.sourceId === "sbp-fixture");
  const lines = economyDocument.split("\n").slice(1, -1);
  const claims = lines.map((quote, i) => ({
    id: "c" + (i + 1),
    key: "policy-" + i,
    value: quote,
    text: quote,
    evidence: [{ observationId: primary.id, quote }],
  }));
  return {
    headline:
      "SIMULATED: Pakistan policy-rate cut and its limits for borrowers",
    deck: "A synthetic policy decision illustrates why a lower benchmark does not automatically change every loan repayment or deposit return.",
    category: "Economy",
    format: "Standard",
    slug: "simulated-pakistan-policy-rate-fixture",
    risk: "NORMAL",
    claims,
    paragraphs: economyParagraphs.map(([section, text, claimIds]) => ({
      section,
      text,
      claimIds,
    })),
  };
}
export function courtDraft(c) {
  const court = c.observations.find((o) => o.sourceId === "court-fixture"),
    wire = c.observations.find((o) => o.sourceId === "wire-fixture");
  const q = courtDocument.split("\n").slice(1);
  const claims = q.map((quote, i) => ({
    id: "c" + (i + 1),
    key: "court-" + i,
    value: quote,
    text: quote,
    evidence: [
      { observationId: court.id, quote },
      { observationId: wire.id, quote },
    ],
  }));
  claims.push(
    {
      id: "c9",
      key: "disputed-station-count",
      value: "12",
      text: "The petition describes 12 disputed polling stations.",
      evidence: [
        { observationId: court.id, quote: q[1] },
        { observationId: wire.id, quote: q[1] },
      ],
    },
    {
      id: "c10",
      key: "disputed-station-count",
      value: "15",
      text: "The responding submission describes 15 disputed polling stations.",
      evidence: [
        { observationId: court.id, quote: q[1] },
        { observationId: wire.id, quote: q[1] },
      ],
    },
  );
  return {
    headline:
      "SIMULATED: Pakistan court review leaves disputed election claims unresolved",
    deck: "A synthetic court direction orders examination of records while conflicting station totals and the merits of the dispute remain unresolved.",
    category: "Politics",
    format: "Breaking",
    slug: "simulated-court-election-fixture",
    risk: "SENSITIVE",
    claims,
    paragraphs: [
      {
        section: "What happened",
        text: "A court in this simulated Pakistan election case has directed scrutiny of contested records. The direction is procedural: it does not name an election winner or determine which account of the dispute is correct. Treating the review order as a final electoral result would go beyond the record available to readers and could wrongly imply that the court has accepted the allegations.",
        claimIds: ["c1", "c4", "c5"],
      },
      {
        section: "Facts and context",
        text: "The retained material contains conflicting descriptions of the scope of the dispute. The petition identifies 12 polling stations; the responding submission gives a total of 15. Both descriptions appear in the registry record, and neither is endorsed there. Pakistan Report could not establish a single agreed total from those submissions. The competing figures therefore remain attributed to their respective accounts rather than being merged into a supposed finding.",
        claimIds: ["c2", "c3", "c9", "c10"],
      },
      {
        section: "Why it matters",
        text: "The difference between asking for scrutiny and deciding the merits is central to this story. A review direction establishes the procedural step the court has taken. It does not establish that an accusation is true. Readers, parties and observers cannot reliably infer the final electoral outcome from that step alone. Preserving those distinctions helps keep the reporting proportionate to the available documentary evidence.",
        claimIds: ["c4", "c5", "c7"],
      },
      {
        section: "What happens next",
        text: "The relevant next materials are the underlying records and the responses from the parties. The available direction does not give a date for a final determination, so there is no supported timetable to report. Further coverage would need to distinguish new documentary information from repeated assertions, and continue to attribute disputed accounts until the record provides a basis for resolving them.",
        claimIds: ["c6", "c8"],
      },
    ],
  };
}
// Deterministic model-adapter double. Not imported by the deployed Worker.
export const fixtureProvider = async (c) =>
  c.observations.some((o) => o.sourceId === "court-fixture")
    ? courtDraft(c)
    : economyDraft(c);
