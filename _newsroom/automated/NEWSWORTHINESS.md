# Mainstream story selection — mainstream-v1

Selection answers two questions: is there a plausible standalone mainstream story today, and what materially changed? It is conservative deterministic triage for research, not proof of truth, a model judgment, or permission to publish.

A candidate must contain an explicit substantive development in a headline or source-summary sentence and dated evidence no more than seven days old. The selection record retains that sentence and its observation ID as `materialChange` and `materialObservationId`, shown in the review screen. This is a source-derived account of the development, not a verified claim or invented explanation. Unknown formulations can be missed and editors should audit rejections.

Recognized event families cover major political/election results, consequential legislation and rulings, IMF/sovereign financing, monetary and public policy action, major corporate/technology changes, conflict/security developments and major disasters. World developments do not require Pakistan relevance or a Pakistani primary source. Neither source category nor ownership creates a relevance gate.

Routine statistics are not automatically stories. The reported PBS weekly SPI of 364.26 and 0.23% weekly change scores **0/65**, including with additional source ownership. Merely being nationwide, numerical, current and authoritative is insufficient. Statistical candidates need an explicit exceptional result (for example, inflation reaching a historical high), not a release date or index level. Such language remains a research signal to verify, not sufficient publication evidence.

Routine meetings, MoUs, ceremonies, courtesies, publicity, administrative proceedings, speculative plans and repetitive statements fail unless the same headline identifies a substantive enacted outcome. A cabinet meeting that actually passes a major tax bill may advance; a meeting to discuss tax policy does not. Unrelated observations cannot combine separate keywords into one supposed material event.

Scoring: substantive development 45, recognized significance 20, source authority at most 5, recency at most 5, additional source ownership 5 per extra group, capped at 15. There is no primary-source bonus, automatic novelty bonus, Pakistan-keyword bonus or article quota. More ownership is not asserted to be independent factual corroboration. Threshold remains 65; failure of the substantive-development gate cannot be rescued by the other factors.

On service startup, older unexported candidates are re-evaluated once. Old approvals are invalidated and revisions/history retained; routine SPI becomes Rejected. Editor rejections remain rejected. Exported packages/handoff history remain immutable. Restart the local newsroom after pulling this change to apply the policy to its stored queue.

## Discovery coverage assessment

Repository inspection, not a new live-source test: the eight-entry registry has only five polling connectors (SBP, PBS, FBR, Finance and Dawn). Four of those are economic/government institutions. Courts, PSX and Reuters are manual. Reuters is the only World-category entry, so **automated World discovery is missing**. There is no dedicated Technology connector and domestic politics/general-news discovery depends on one reporting feed. Earlier successful local retrieval is not evidence of complete coverage or hosted reliability.

Minimum additions before a broad shadow monitoring trial:

1. One permitted, reputable global general-news RSS/Atom discovery feed covering major conflicts and international developments; configure it as World with no Pakistan filter.
2. A second independently owned Pakistan general-news discovery feed with political, legal and security coverage. Ensure the resulting pair also covers major business and technology; add a dedicated feed only if that coverage remains absent.
3. Retain primary-document/manual intake for verification, and add accessible parliamentary, court, regulator or corporate publication endpoints when actually tested. Do not assume an HTML homepage is a useful dated event feed.

Each new endpoint needs a restrictions/robots review and successful parsing/current-date tests before enabling it. Reporting feeds remain headlines/links only; no newspaper full-text rewriting, paywall bypass or paid service is needed by this policy. No unverified endpoints were enabled or added. See [the subsequent 26-source access audit](RADAR-AUDIT.md) for permission decisions and the discovery/evidence separation. Source-health failures and category defaults still require editor oversight.

## Verification and operating boundary

- Automated Newsroom: **91 passed, 0 failed, 0 skipped**.
- Existing Publisher: **35 passed, 0 failed, 0 skipped**.
- Worker dry-run bundle: passed, monitoring and drafting remain disabled in committed configuration.
- Includes routine SPI, nationally scoped routine statistics, material statistical outliers, Pakistan/World event fixtures, routine PR negatives, significance over recency, sensitive conflict classification, non-pooling of unrelated reports and legacy-queue migration/idempotency.
- No model inference or credential access. Fixtures are deterministic and are not live-news verification.

Human approval, evidence checks, visual review and the existing final Publisher validation remain mandatory. The automated preparation lane and manually prepared Sol/Astra/editor batches continue to coexist; no unattended publishing path was introduced. Return to a supervised local Workers AI draft test with a genuinely consequential, well-evidenced candidate. Passing these selection tests does not establish model writing quality or readiness for autonomous publishing.
