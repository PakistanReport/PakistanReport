# Pakistan Report — first-party analytics consent implemented locally

Deployment remains on hold. GA4 configuration is enabled for G-8J4QNEXRW4, but the production build/origin/ID guards and affirmative consent guard must all pass before Google loads. No account changes or deployment occurred.

Implemented: compact consent notice; equally styled Allow analytics and Decline buttons; permanent footer Analytics preferences control; localStorage choice lasting 180 days; expiry and cross-tab handling; withdrawal disable flag, accessible GA-cookie deletion attempts and reload if GA had loaded. No Consent Mode calls, CMP, GTM container, Meta Pixel, paid service or extra tracker. The Privacy Policy documents these behaviours and the publication email.

Existing post bodies and metadata, image assets, original CSS rules and navigation destinations remain unchanged. New styling is scoped to the consent notice/control. Newsroom files are excluded from the public Jekyll output; do not store secrets in a public repository.

## Local verification

Run `node _newsroom/check-analytics.cjs` and `node _newsroom/check-consent.cjs`. Both offline suites pass. They test unknown/declined/granted/expired/malformed choices, storage unavailable, expiry, footer interaction, repeat grants, duplicate installation, cross-tab withdrawal, cookie deletion attempts, disable/reload, ID/origin guards and absence of Consent Mode calls. They mock DOM/storage/cookies and do not load Google.

Real Jekyll build, rendered layout/accessibility and browser cookie/network semantics have not been tested. Browser restrictions may prevent clearing inaccessible cookies or persisting choices. Already-sent information and in-flight requests cannot be recalled. Third-party account retention settings remain unverified.

## Handoff and remaining blockers

- `_newsroom/GA4-SETUP.md` and FILE-LOCATIONS.md: setup and current source locations.
- `_newsroom/article-pattern.md.template`, SOURCING-STANDARD.md and RETROFIT-PRIORITIES.md: adopted new-article pattern and existing-article review queue; no mass edits.
- Real Ruby/Jekyll build and XML/metadata/output exclusion checks remain required.
- Real browser allow/decline/persistence/withdrawal, mobile layout/keyboard and network checks remain required, followed by approved production verification and actual GA4 event/acquisition reports.
- GA4 account settings/retention must be confirmed; any account-level changes need owner approval.
- Live website/Workers deployed commit, public pages and Facebook configuration/Insights remain unverified.
- Source retrofits and routine future editorial approvals are newsroom operations, not blanket launch blockers. Only identified material problems block release. One useful Explainer draft awaits review; see RELEASE-GATES.md.
- GitHub is accessible and the original ZIP matches main commit 9724cefdf75e106622b7d75e0f77aed30578c3ff. Do not write to main until build verification and explicit production approval. See `_newsroom/RELEASE-GATES.md` for the authoritative current scope and Facebook evidence.
