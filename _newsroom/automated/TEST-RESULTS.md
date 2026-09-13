# Executed verification — 12 September 2026

- `npm test`: **44 passed, 0 failed, 0 skipped**. Includes 25 editorial/service cases, 17 connector/provider cases, one actual workerd HTTP workflow and one Review Queue DOM test.
- `npm run test:publisher`: **35 passed, 0 failed, 0 skipped**, including actual workerd alarms and simulated GitHub atomic commits/recovery.
- `npm run check`: successful Wrangler dry-run; approximately 958 KiB bundle, 243 KiB gzip. No deployment.
- Deterministic end-to-end: synthetic primary input → meaningful event selection → retained evidence → original structured draft response → editorial checks + reviewed image → Ready for Review → explicit human attestations/approval → ZIP accepted by the existing Publisher validator. Repeat export is byte-identical. No public publishing request is made.
- Negative fixtures: routine MoU rejected; two reports cluster; sensitive conflicting figures remain attributed and require corroboration plus human review; insufficient sourcing blocks readiness. Malformed input, fabricated evidence, unsupported figures, duplicate coverage, stale revisions, source restrictions, retry exhaustion, post-export changes and editor rejection are covered.
- Private HTTP tests reject unauthenticated and cross-origin/missing-action-header mutations. DOM testing exercises actual review controls; this is not a full browser visual/layout test.
- Actual one-shot live connector attempts: PBS feed at 2026-09-12T17:51:19Z failed with network failure/timeout; SBP index at 17:51:31Z returned HTTP 403. Restrictions were not bypassed. **Live monitoring has not been established.**
- Draft generation in tests uses a deterministic provider double with synthetic evidence, not a live model. Adapter behavior is tested with mocked HTTP. No live model quality or AI-image-generation claim is made. Incomplete visuals block approval.
- Production file comparison against fetched `origin/main` is unchanged for articles, assets, configuration, layouts/includes and Search Console verification. Existing Publisher files are unchanged against `publisher-mvp`. No real articles, production secrets, main branch or live Worker were modified.

The local/testable preparation-to-approved-package path passes. A live production-news trial still requires accessible reviewed sources, a deliberately configured model provider and editorial evaluation of real drafts. Monitoring and model calls ship disabled; no paid infrastructure has been activated.


## Discovery / evidence boundary verification — 13 September 2026

- Full Automated Newsroom suite: **107 passed, 0 failed, 0 skipped** (`npm test`).
- Full existing Publisher suite: **35 passed, 0 failed, 0 skipped** (`npm test` in `_newsroom/publisher`).
- Includes the actual local workerd private HTTP workflow and Review Queue DOM test, with synthetic evidence and mocked model/GitHub transports. No real model was invoked and no public article was written.
- Sixteen new tests cover three independently owned outlets forming one event, sister-outlet ownership caps, twenty timestamp refreshes preserving event age/revision, common headline aliases, high-volume ceremonial rejection, World eligibility, discarded discovery article text, rejected legacy reporting prose, structured-fact limits, two-owner research, primary-first provenance, exact model-input boundaries, visible conflicts, source-like wording, fail-closed permission checks and radar-only automatic polling.
- Existing mainstream-v1 selection fixtures still pass, including routine PBS weekly SPI scoring 0/65. Materiality cannot be rescued by popularity.
- Public source audit: **26 requested outlets assessed** through public pages/feed directories/available terms. No additional mainstream connector permission was established; none enabled. These are web audit observations, not successful live feed or hosted-network tests. Full decisions and first-party links: [RADAR-AUDIT.md](RADAR-AUDIT.md).
- No deployment, merge, public publication, production-secret changes, local credential access or model inference. Publisher implementation and all public-site paths remain unchanged from the starting branch commit `c66d62e`.

Next: a supervised local test using permitted event metadata and separately assembled primary/structured reporting evidence. Broad automatic monitoring remains blocked on permission-reviewed Pakistan and World feeds plus successful exact-endpoint/runtime tests. Similarity and provenance checks require human judgment and do not certify copyright compliance or factual truth.


## Desired radar expansion — 13 September 2026

- Full newsroom suite: **124 passed, 0 failed, 0 skipped** (`npm test`). Seventeen new expansion cases plus extended runtime/UI assertions; prior materiality, evidence isolation and Publisher-package tests remain passing.
- Full Publisher regression suite: **35 passed, 0 failed, 0 skipped** (`npm test` in `_newsroom/publisher`). Publisher implementation unchanged.
- Actual local workerd bundle/HTTP and Review Queue DOM tests passed with synthetic evidence and intercepted model/source/GitHub transports. Allowed transport assertions exclude the Publisher and any public-writing endpoint. No Wrangler dry-run or deployment command was run.
- Default `npm run test:live`: **33 disabled entries**, zero feed requests. This verifies that the probe cannot self-enable or self-authorize sources; it is not live feed verification. Approved/unapproved endpoint and failure-continuation cases use deterministic transport doubles.
- First-party ownership/brand pages were inspected through web retrieval. No new automated publisher-access permission was established. No article body was retained for discovery, real model invoked, public illustration generated, or production content/secret changed.
- Regression coverage includes five differently worded court headlines forming one event; shared/unknown ownership denying independent credit; routine multi-outlet meetings/SPI failing materiality; major court, IMF, company and World developments advancing; fixed 15-point prominence cap; explicit case/date/subject distinctions; bounded anchor clustering; all disabled sources failing before network; endpoint-bound permission; registry visibility; persistent editor rejection and protected export history.
- [DISCOVERY-EXPANSION.md](DISCOVERY-EXPANSION.md) contains the exact supervised real-event preparation and remaining permission, evidence, local-model and visual gates. No real-event drafting run was performed.
