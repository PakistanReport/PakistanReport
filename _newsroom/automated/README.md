# Pakistan Report Automated Newsroom — Phase 1

Private editorial preparation and review, ending at a human-approved Publisher ZIP. **There is no public publishing function, Publisher credential, GitHub write credential, or autonomous-publication mode in this Worker.** Manual batches and the existing Publisher continue unchanged.

## Run the local demonstration

Node 22+ is required (Node SQLite). From this branch:

```sh
cd _newsroom/publisher
npm ci
cd ../automated
npm ci
npm run demo
```

Open the localhost URL printed by the demo, with username **editor** and the temporary password it prints. The demo uses the actual Worker/SQLite HTTP routes, synthetic source documents and a deterministic model-response double. It places a worthwhile policy fixture in **Ready for Review** and a routine MoU in **Rejected**. Inspect the evidence and checks, attest to each claim and the article/visual, click **Approve for Publisher package**, enter a future `YYYY-MM-DDTHH:mm:ss+05:00` time, then **Download Publisher ZIP**. This does not publish. Do not send synthetic demo stories to the live Publisher. Ctrl+C discards demo state.

`npm test` covers ingestion through validated export, realistic negative fixtures, source restrictions, model-response parsing, private HTTP access, state transitions, retries and DOM review controls. `npm run test:publisher` runs the unchanged Publisher regression suite. `npm run check` bundles this separate Worker without deploying. `npm run test:live` makes a one-shot, read-only PBS/SBP connector attempt and writes diagnostic results under ignored `test-output/`.

## Data flow and architecture

`source registry → bounded RSS/Atom/index polling → content fingerprint + event cluster → transparent ranking → retained primary-document evidence → model/editor structured draft → editorial checks + visual requirement → private Review Queue → explicit human approval → immutable Publisher ZIP`

The implementation reuses Cloudflare Workers/SQLite Durable Objects and imports the existing Publisher's category, image, scheduling and ZIP validators. It does not import the Publisher's GitHub writer. All files are in the existing Jekyll-excluded `_newsroom` tree. The public site's `_posts`, images, Search Console verification, analytics, templates and deployment configuration are untouched.

A separate Worker named `pakistan-report-newsroom` has its own SQLite object and authentication secret. Monitoring is disabled by default. When enabled, its fifteen-minute cron polls at most one due source (priority ordered) and processes at most one eligible candidate per invocation; each source has its own longer interval. No articles/day target exists. Nothing prevents a day with zero accepted stories.

Stored data: configurable source metadata and poll status; canonical observations with source identity snapshots and content hashes; retained bounded evidence with retrieval method/date; candidate revisions and ranking factors; structured claims and draft paragraphs; risk/conflict records; checks; private visual/package chunks; human attestations; handoff receipts and audit history. The private asset cap is 256 MiB. There is no public asset endpoint or cross-origin API access.

## Source connectors

| Connector | Implemented behavior | Initial registry entries |
|---|---|---|
| RSS / Atom | Bounded XML; no entities/DOCTYPE; ETag/Last-Modified; up to 30 entries; provenance and duplicate fingerprints | PBS RSS; Dawn RSS discovery |
| Primary HTML index | Allowlisted hosts; pipe-separated URL-substring filter; headline/link discovery; unknown dates remain unknown | SBP, FBR, Finance Division |
| Primary HTML document | Bounded readable text, source hash and retrieval time; robots check; no redirects | Eligible primary-source candidate URLs |
| Manual evidence | Editor checks original material and confirms provenance before attaching text | Supreme Court, PSX disclosures, Reuters corroboration; PDF documents |
| Published coverage | Read-only GitHub main tree/filename index, or explicit editor import | PakistanReport/PakistanReport |

All sources start **disabled**, pending restrictions/endpoint review. In the Source registry, editors can add, disable, reprioritize and adjust intervals using validated JSON. Do not enable a source merely because its homepage is reachable. Unknown robots status, HTTP denial, redirects, PDFs and inaccessible documents result in visible failures/manual-evidence requirements. Redirects are not followed. A missed date cannot masquerade as a new publication date.

Reporting sources provide headlines/links only through automatic ingestion. Their full articles are not crawled or used as rewrite inputs. Primary evidence is preferred. Source ownership groups, rather than URL counts, determine independent corroboration. Manual reporting excerpts require an editor-confirmed provenance note. Never paste a full copyrighted newspaper article into the evidence form when a permitted short excerpt or primary document will suffice.

Clustering is heuristic (shared terms and a bounded event-time window), not an oracle. Related reports retain separate evidence and conflicting values. Use **Split into separate candidate** if unrelated developments were grouped. Identical observations are ignored; changed source text/date creates a new revision and invalidates approval. Same-URL updates join the existing candidate. Document changes that do not change the feed/index metadata are not independently detected; editors must refresh evidence for corrections.

## Evidence, drafting and editorial gates

Claim schema: `id`, `text`, `key`, `value`, and `evidence: [{observationId, quote}]`. Comparison keys identify the same event/measure/timeframe across accounts; differing values remain conflicts. Every article paragraph supplies its section and supporting claim IDs. Four sections are required: What happened; Facts and context; Why it matters; What happens next.

The optional **OpenAI-compatible chat/completions adapter** prepares original structured copy from retained source text. It has no tools, network browsing or publishing function. Source documents are explicitly treated as untrusted data, not instructions. Malformed or declined responses become Needs Attention. This adapter is disabled by default and has a configurable daily request cap. **No paid model account was created or invoked.** A provider may charge for calls; any paid use requires the owner's separate decision. An approved self-hosted compatible provider is also possible, but no such service was tested here.

Without a configured model, candidates stop in Needs Attention and accept an editor-written structured draft through the interface. The deterministic fixture provider is in `test/` only and is not bundled into the production Worker. It proves wiring and gates, not live AI writing quality.

Checks cover threshold, dated source freshness, retained evidence/quotes, source independence, obvious unsupported figures, claim-to-paragraph linkage, category, four-part completeness/length, headline/body topical consistency, slug, conflicts, quotation matching, source-copy overlap, local/published near-duplicate coverage, safe front matter/Markdown, conservative risk and a completed reviewed illustration. The published index must be refreshed within 24 hours before approval/export. Publisher validation runs again during ZIP construction and will run again on actual upload.

**Evidence linkage is not factual verification.** These deterministic checks cannot prove a paraphrase is entailed, detect every unsupported assertion, determine legal fairness, or certify originality. Every material claim requires an explicit human attestation against the cited sources, plus whole-article and visual review. SENSITIVE stories require two independent source groups per claim and a substantive editorial note. Court directions, disputed allegations and figures must not be reported as findings of fact. Sensitive risk cannot be downgraded below the server's conservative classification.

Politics is a core category. The Publisher's authoritative spelling **Explainer** (singular) is preserved; it corresponds to the requested Explainers category. Article formats enforce Breaking 250–400, Standard 400–650, Important 550–800, Explainer 700–1,200 and Deep analysis 1,200–2,000 words in this bounded V1.

## Visuals

The system produces a structured **Awaiting visual** brief rather than inventing a working image-generation service. No image-generation API is connected. The brief requires non-documentary illustration, no fabricated event photography/evidence/documents/seals and the caption **Pakistan Report illustration.**

An editor uploads a finished PNG/JPEG/WebP, supplies alt text and confirms its suitability. Missing/unconfirmed images prevent Ready for Review and approval. Existing Publisher image validation is reused. The synthetic tests use a small deliberately simple test graphic, not a purported real-event image.

## Review and handoff

States: **Detected → Researching → Drafting → Needs Attention / Ready for Review → Approved / Rejected → Sent to Publisher**. A changed source/draft/visual invalidates old approval. Edits require the current revision, preventing stale-tab approvals. The queue shows sources, reasons, evidence excerpts, risk, checks, copy, visual and history. Headline/deck/body editing is available; advanced JSON editing supports claims and source mappings.

Approval only authorizes package creation. Export requires a matching approved revision and passing checks. The package is immutable and repeat export returns identical bytes; changing its schedule afterward is blocked. Once a package has been exported, later source updates lock a second delivery rather than automatically making another package. Manage any existing uploaded story in the Publisher.

The editor downloads the package, uploads it to the existing Batch Publisher, reviews its validation and explicitly approves scheduling there. This deliberate handoff does not weaken or replace Publisher authentication or validation. The newsroom never contacts the Publisher. The optional **Record Publisher handoff** action records the batch ID supplied by the editor; “Sent to Publisher” is an editor-reported receipt, not remotely verified publication status. All private provenance stays outside the public ZIP; source links remain in article copy.

## Security and reliability

Use a distinct random `NEWSROOM_PASSWORD` secret (at least 32 characters); username **editor**. Missing/short secrets fail closed. HTTPS Basic authentication protects every route, including source text and image downloads. Mutations require same-origin requests and a custom header. CSP disallows inline script, framing, arbitrary image hosts and external connections. The UI renders supplied text with `textContent` and never executes source HTML. Do not reuse or alter Publisher secrets.

For a future isolated trial only: configure `DRAFT_PROVIDER=openai-compatible`, `MODEL_ENDPOINT`, `MODEL_ALLOWED_HOSTS`, `MODEL_NAME`, and server-secret `MODEL_API_KEY` after explicitly choosing an approved provider. `MODEL_REQUESTS_PER_DAY` defaults to 10 and is capped at 30. Confirm source access/restrictions before enabling individual entries and `MONITOR_ENABLED=true`. No production settings were changed in this assignment.

Poll errors retain failure counts, messages and next-attempt times with backoff. Processing retries transient failures at most three times; interrupted Researching/Drafting work can resume, and exhaustion becomes Needs Attention. Human retry is explicit. SQLite transactions protect ingestion and asset/export changes; a single object serializes requests. Exact fingerprints, revisions and immutable exports protect repeated processing. There is intentionally no automatic public retry/publication path.

The application depends on the platform's free quotas. It does not buy a plan or a model subscription. Large sustained monitoring/review workloads may require reducing source frequency or retention; do not silently upgrade services. For this initial trial, monitor stored data and keep source count modest. Full model inputs contain retained source evidence, so provider privacy/retention terms must be reviewed before configuring an external model.

## Current limits and trial gate

See TEST-RESULTS.md for exact executed results. Live PBS/SBP connector attempts did not establish reliable source monitoring. No live model, generated editorial image, Cloudflare deployment or public article was tested or created. The local demo and deterministic full workflow are implemented; **a live production-news trial is not yet recommended** until an editor validates source access, chooses/configures the drafting provider, supplies reviewed visuals, and evaluates real drafts in the private queue. Continue to require human Publisher approval throughout Phase 1.
