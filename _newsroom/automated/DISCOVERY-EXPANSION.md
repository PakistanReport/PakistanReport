# Supervised discovery expansion

Based on `aa6960499f4b64d404c5827571c085289b289637`, on `newsroom-phase1`. No production deployment, main merge, model inference, public content or Publisher transport is part of this change.

## Registry and coverage

The runtime registry now contains **33 disabled entries**: all 21 requested priority Pakistan sources, Jang and Express ownership/reference companions, Reuters/BBC/CNN, APP and the six existing primary institutions. The private Source registry renders editorial role, priority tier, coverage topics, ownership/review state, permission state and blocking reason. Missing permission is visible rather than represented by a missing source.

| Tier / role | Entries |
|---|---|
| Priority 1 Pakistan | Dawn, Geo, Express Tribune, ARY, The News, Dunya, Samaa, Aaj, 24 News HD, Hum |
| Priority 2 Pakistan | Business Recorder, ProPakistani, Pakistan Today, The Nation |
| Priority 3 Pakistan | Daily Times, Pakistan Observer, BOL, GNN, Public News, Abb Takk, Daily Pakistan |
| Additional ownership/reference companions | Jang, Express News / Daily Express |
| World radar gap | Reuters, BBC, CNN |
| Evidence/reference | APP, PBS, SBP, FBR, Finance Division, Supreme Court, PSX |

No new feed endpoint was guessed. Where the previous audit established only a homepage or RSS directory, the runtime connector is **manual**, and `discovery.endpoint` is null. `url` is then a source-reference URL, not an approved polling endpoint. The existing Dawn feed and primary connector URLs are preserved, disabled by default. See [RADAR-AUDIT.md](RADAR-AUDIT.md) for individual access decisions. APP is a reporting/reference source, not automatically primary evidence or a source of reusable article prose.

Every desired entry has `desiredEditorialRole`, `priorityTier`, `coverage`, `ownership`, `discovery`, `discoveryPermission`, `enabled`, `restrictionsReviewed` and `disabledReason`. All approved permission endpoints are currently null. Old stored source choices are preserved; newly introduced metadata fills absent fields and new entries are inserted disabled. This does not silently approve or enable existing configurations.

Reporting polling now requires permission for the **exact URL and all allowed hosts**, in addition to the existing status, basis, reference and review date. Changing the URL/host list without a matching permission record fails before network access. Robots, redirects, response bounds and intervals still apply. A review record documents a human decision; it cannot prove the legal validity of that decision.

`npm run test:live` no longer sets `enabled` or `restrictionsReviewed` itself. It reports disabled entries and only probes explicitly enabled, validated source configurations. The exported `probeSources` function can receive a separately reviewed source list for a later supervised diagnostic. No credentials are accepted by the probe. In this assignment its default run reported **33 disabled entries**, not successful live polling.

## Ownership and prominence

First-party brand information was checked on 13 September 2026:

- [Jang Advertising Solutions](https://solutions.jang.com.pk/) lists Jang, The News and Geo within its portfolio.
- [Tribune's about page](https://tribune.com.pk/about) identifies Daily Express and Express News as fellow brands.
- [Aaj's contact page](https://english.aaj.tv/contact-us) identifies Recorder Television Network; its site links Business Recorder among its brands. The conservative Recorder grouping remains.

These relationships are encoded by source ID and canonical hostname so changing an `owner` label does not create independence. They are conservative editorial grouping decisions, not a comprehensive beneficial-ownership investigation. Other reporting ownership is unknown until explicitly reviewed with a group and public reference. A bare legacy `owner` string no longer earns reporting independence. Documented ownership must also be present in retained reporting evidence snapshots; re-confirm old evidence after an ownership review where necessary.

The same ownership helper is used by ranking, evidence packets and claim verification. Multiple same-group outlets cannot corroborate each other. Unknown groups receive no independent-source credit. Primary institutional evidence remains eligible under the existing rules. Syndicated reports still require human scrutiny: distinct ownership does not prove separate reporting.

Materiality remains `mainstream-v1`; authority remains capped at **5**, additional ownership at **15**, and the threshold at **65**. No quota or Pakistan filter for World was introduced. The routine weekly SPI case remains **0/65**. Prominence is computed only after a concrete material development passes.

## Event identity

Headline overlap and the 72-hour window remain. The matcher additionally normalizes SC/top court, IHC/LHC and common ruling verbs. Explicit conflicting case identifiers, calendar dates, court identities, legal subjects and a small set of places/actions prevent obvious false merges. Numeric casualty or rate differences alone do not split an event; those may be conflicting reports needing review. Date clues support ISO and day-month-year numeric forms, not arbitrary natural-language dates.

Cross-URL observations must match the candidate's first observation rather than any loosely related intermediate headline. This prevents a broad bridge headline from joining unrelated legal events. Timestamp-only refresh idempotency and manual splitting remain. Same-URL updates retain the existing conservative review-invalidation behavior; rolling liveblogs and unclear event boundaries still need human inspection. There is no model clustering, general named-entity extractor, Urdu translation or guarantee of perfect deduplication.

## Business, Technology and World gaps

Business Recorder is explicitly marked for economy, markets, companies, energy and banking; ProPakistani for technology, telecom, digital economy and material business developments. Both remain disabled. Each needs an expressly offered public mechanism, permission for this exact use, exact endpoint/host review and successful robots/parser/runtime checks. They are desirable coverage gaps, not added feeds masquerading as working coverage.

Reuters remains manual/disabled. BBC and CNN are disabled placeholders. A future permission-reviewed RSS/Atom source can be configured with `category: World` and `purpose: radar` using the existing connector. A broad independent World feed remains missing. USGS can supplement disaster evidence but cannot fill that gap. Current source pages or brand-policy retrieval do not establish Cloudflare-hosted feed access.

## One supervised real-event test: prepared, not executed

Keep `MONITOR_ENABLED=false`. Use the real local newsroom, not the synthetic demo. On Windows PowerShell use `npm.cmd` when execution policy blocks `npm.ps1`. Do not read or share credentials through this workflow.

1. Choose one **current, consequential** development whose material change can be stated in one or two sentences: for example an enacted major policy or consequential ruling, not a routine release. No current event has been selected or verified by this assignment; this is a preparation gate, not a claimed real-event result.
2. Under **Import source input**, enter only metadata you are permitted to record under the corresponding source identities. Use **Detect candidates**. Inspect the resulting event, date, material-change sentence, score and ownership groups. Split unrelated observations if needed. The editor must confirm that the event deserves coverage before continuing; the existing **Research & Draft** action is the explicit next action, with monitoring left off.
3. Independently collect primary evidence. Import the relevant primary-source metadata and inspect clustering, then use **Confirm source evidence** to attach checked primary material. If primary evidence is unavailable, record independently assembled short reporting facts with documented ownership and attribution. Do not paste article bodies or descriptions. For sensitive stories the existing two-group-per-claim rule remains.
4. Use **Download private provenance record** to inspect source URLs, dates and documents. The existing adapter constructs the structured packet from those evidence records; discovery headlines are excluded. Do not proceed while evidence is insufficient or ownership is unreviewed.
5. Only in the owner's credential-configured local checkout, after the preceding human confirmation, use **Research & Draft** once with the previously selected Workers AI provider/model. Credential availability, free allocation and model response quality were not inspected or tested here. No inference has been run by this assignment.
6. Audit every claim, date, number, source reference, lead, headline, context, predicted next step and suspicious source-like wording. Retain uncertainty and conflicts. Inspect the visual brief only. **Stop at human review**: do not approve a Publisher package, export, hand off, schedule, publish or generate a public image.

The existing visual gate requires a completed reviewed illustration for **Ready for Review**. Because this test must not generate a hero image, it may correctly remain **Needs Attention / Awaiting visual** even with a good draft. Do not weaken that requirement or label the draft fully ready. Failed factual/editorial checks likewise remain blocking.

## Verification

See [TEST-RESULTS.md](TEST-RESULTS.md) for the final executed counts. Tests use synthetic headlines, synthetic evidence and intercepted transports. They cover five-to-one clustering, ownership caps, routine rejection, IMF/business/World materiality, SPI, explicit event distinctions, source-permission failures, evidence isolation, visible registry gaps and restart/history protection. Local workerd tests assert that no Publisher or public-writing transport is contacted. No hosted-network claim, real draft-quality claim or copyright certification follows from these tests.


## Files changed

All paths are relative to `_newsroom/automated/`:

- Documentation: `DISCOVERY-EXPANSION.md`, `RADAR-AUDIT.md`, `NEWSWORTHINESS.md`, `README.md`, `TEST-RESULTS.md`.
- Source: `src/radar-catalog.js`, `src/ownership.js`, `src/registry.js`, `src/selection.js`, `src/editorial.js`, `src/evidence.js`, `src/sources.js`, `src/service.js`, `src/ui.js`.
- Diagnostic script: `scripts/live-sources.js`.
- Tests: `test/expansion.test.js`, `test/radar.test.js`, `test/fixtures/events.js`, `test/runtime.test.js`, `test/ui.test.js`.

The generic drafting adapter `src/provider.js`, Worker configuration and Publisher code were inspected and remain unchanged.
