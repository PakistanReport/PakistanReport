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
