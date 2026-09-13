# Discovery access audit — 13 September 2026

## Decision and scope

**No additional mainstream source is enabled.** The 26 requested outlets were assessed using public feed directories, homepages and available first-party terms. Public RSS availability is a useful technical lead, but it does not alone settle permission for automated commercial-newsroom discovery. Unclear permission is a pending decision, not a finding that the source forbids all automation. This is an operational access assessment, not a legal opinion.

The observations below are web-retrieval results, **not successful SourceClient polling or Cloudflare-hosted tests**. Search/web retrieval errors do not establish that an origin blocks Cloudflare. No newspaper article crawler, model call, paid service or production change was used. Where permission remained unresolved, no feed polling or robots probing was undertaken merely to prove technical access. Robots must additionally permit the exact endpoint before any approved source can be polled.

“Disabled” means not approved for this project's automatic monitoring. Sources absent from the runtime registry stay absent; this audit is not a list of enabled connectors. Existing Dawn and Reuters entries remain disabled by default. A previously enabled reporting connector now also needs a documented `discoveryPermission` record before it can make a network request.

## Pakistan radar

| Source | Public mechanism / audit result | Automatic monitoring decision and minimum next step |
|---|---|---|
| Dawn | Existing RSS endpoint `/feeds/home`; [terms](https://www.dawn.com/terms/) restrict non-personal use. | Disabled; obtain written permission covering this use. Earlier Node retrieval proves only technical access. |
| Geo News | [Official RSS directory](https://www.geo.tv/rss) accessible; category feeds advertised. | Disabled; establish permitted newsroom use and then test exact feed/robots. |
| The Express Tribune | [Official RSS directory](https://tribune.com.pk/rss) accessible; [copyright policy](https://tribune.com.pk/copyrights) requires consent for reuse. | Disabled; clarify permission for retained discovery metadata, then test feed. |
| ARY News | [Homepage](https://arynews.tv/) accessible; attempted `/rss-feeds/` retrieval failed. | Disabled; no suitable feed and permission combination established. Ask for an official permitted feed. |
| The News International | [Official RSS directory](https://www.thenews.com.pk/rss) accessible, including World. | Disabled; use scope not established. Confirm permission and exact endpoints. |
| Dunya News | [Homepage](https://dunyanews.tv/) accessible; attempted `/en/RSS` retrieval failed. | Disabled; a dated permitted feed remains unverified. |
| Samaa TV | [Homepage](https://www.samaa.tv/) returned HTTP 403 through web retrieval. | Disabled; no bypass or alternate identity attempted. Seek an expressly offered feed and permission. |
| Aaj News | [English homepage](https://english.aaj.tv/) accessible. No permitted automated mechanism established. | Disabled; confirm an official metadata feed and terms. |
| 24 News HD | [Homepage](https://www.24newshd.tv/) accessible; no RSS mechanism established from retrieved page. | Disabled; public HTML is not an automation grant. |
| Hum News | [English homepage](https://humenglish.com/) accessible; feed/use scope not established. | Disabled; seek official metadata feed permission. |
| Business Recorder | [Homepage](https://www.brecorder.com/) accessible; `/feeds` retrieval unsuccessful. | Disabled; validate a specific offered feed and its permitted use. |
| ProPakistani | [Homepage](https://propakistani.pk/) accessible; attempted terms URL unsuccessful. | Disabled; technology/business coverage is attractive but access scope remains unresolved. |
| Pakistan Today | [Homepage](https://www.pakistantoday.com.pk/) accessible; no permitted feed established. | Disabled; confirm mechanism and permission. |
| The Nation | [Official RSS directory](https://www.nation.com.pk/rss) accessible, including international, politics and technology. | Disabled; obtain/establish permission for this use, then test feeds. Its editorial AI policy is not a grant to other publishers. |
| Jang | [RSS page](https://jang.com.pk/rss) accessible; Urdu material. | Disabled; permission and exact feed parsing unverified; English clustering does not support Urdu translation. |
| Express News / Daily Express | [Homepage](https://www.express.pk/) accessible; Urdu material. | Disabled; permitted feed unestablished and Urdu detection/translation unimplemented. |
| Daily Times | [Homepage](https://dailytimes.com.pk/) timed out through web retrieval. | Disabled; no reliable permitted mechanism established. Timeout is not proof of a permanent restriction. |
| Pakistan Observer | [Terms](https://pakobserver.net/term-and-conditions/) accessible; uses beyond personal non-business use require prior written consent. | Disabled; obtain permission; do not infer a feed grant from homepage availability. |
| BOL News | [Terms](https://www.bolnews.com/terms-of-service) accessible; copying/redistribution requires permission. | Disabled; specific automated metadata mechanism and permission unresolved. |
| GNN | [Terms](https://gnnhd.tv/terms-and-conditions) accessible; no express automated discovery grant established. | Disabled; attribution language alone is not sufficient to enable a crawler. |
| Public News | [Homepage](https://publicnews.com/) accessible; no permitted feed established. | Disabled; confirm mechanism/use scope. |
| Abb Takk | [Homepage](https://abbtakk.tv/) accessible; no permitted feed established. | Disabled; confirm mechanism/use scope. |
| Daily Pakistan | [Homepage](https://dailypakistan.com.pk/) advertises RSS; Urdu material. | Disabled; feed/use scope and Urdu processing remain unverified. |

Prioritize permission clarification for the explicitly advertised Geo, The News, Tribune and Nation feeds rather than inventing URLs or crawling article pages. This is a shortlist for review, not an authorization recommendation.

## World radar

| Source | Assessment | Decision / legitimate alternative |
|---|---|---|
| Reuters | [Terms](https://www.reuters.com/info-pages/terms-of-use/) restrict automated access and commercial RSS use without consent. [Licensed RSS delivery](https://liaison.reuters.com/page/rss-feeds-tech-notes) is not an established free entitlement. | Disabled/manual-only. Obtain explicit rights if available at no cost; do not subscribe or bypass authentication. |
| BBC | [Terms portal](https://www.bbc.com/usingthebbc/terms/) available; linked business-use terms could not be retrieved. | Disabled; newsroom-use permission remains unestablished. |
| CNN | Attempts to retrieve [RSS directory](https://edition.cnn.com/services/rss/) and [terms](https://www.cnn.com/terms) were unsuccessful. | Disabled; neither permitted use nor runtime reliability established. |

A narrow legitimate alternative is **USGS-authored earthquake data**: [official Atom feeds](https://earthquake.usgs.gov/earthquakes/feed/v1.0/atom.php), including significant-event feeds, and [USGS public-domain guidance](https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits). It can supply primary disaster evidence with credit, excluding third-party assets. The existing Atom parser can represent it; no USGS endpoint was polled or enabled here. It cannot replace a broad conflict/politics World radar, and a magnitude bulletin still needs materiality assessment. No aggregator or search-results scraping is proposed as a way around publisher restrictions.

## Minimum coverage still missing

1. Two permitted, independently owned Pakistan general-news feeds, including politics, courts, security and consequential public developments. An explicit RSS offer is a good starting point for scope confirmation.
2. One permitted broad World discovery feed, without any Pakistan keyword filter. Accessible primary organizations are useful research references, not substitutes for an independent global news agenda.
3. Confirm that the domestic pair includes major business and technology; add one permitted specialist only if necessary. Urdu sources require separately validated multilingual detection/clustering, which is not implemented here.

Ownership groups must be verified before approval. Conservatively group Geo / The News / Jang together; Tribune / Express together; Aaj / Business Recorder together pending current ownership confirmation. Do not count a shared wire report republished by unrelated websites as independently verified facts. The score measures editorial prominence, not proof of independent reporting. Unknown ownership is not a reason to invent separate groups.

## Permission configuration

Use the existing private Source registry JSON editor. An automatic reporting source requires `enabled`, `restrictionsReviewed`, an approved exact URL/host list, at least hourly polling and:

```json
{
  "purpose": "radar",
  "discoveryPermission": {
    "status": "approved",
    "basis": "Describe the actual permission covering automated headline/link discovery and retention for Pakistan Report.",
    "reference": "https://source.example/actual-permission-reference",
    "reviewedAt": "2026-09-13T00:00:00Z"
  }
}
```

This example is **not** permission and must not be copied as a substitute for one. The software validates that a review is documented; it cannot adjudicate the rights recorded by an editor. Do not put credentials or confidential permission correspondence in this field. Store a non-secret reference and concise scope. Each poll still checks robots, enforces bounded responses/intervals, does not follow redirects and records failure/backoff. No reporting article body is fetched by the connector.

## Implemented discovery / research boundary

- Registry purpose is `radar` or `evidence`. Official entries default to evidence/reference; the automatic monitoring tick selects radar entries only. Editors can explicitly poll a reviewed evidence source during research. Existing source failure history and backoff remain visible.
- Automatic reporting intake retains title, link, dates, source identity/ownership and content hash, not descriptions or article bodies. Incoming `text`/`document` fields cannot smuggle article text through discovery.
- Same-event clustering uses headline term overlap within 72 hours, with small explicit aliases (SBP/State Bank, PM/prime minister, rate units, ceasefire spelling). It does not ingest articles or use a model. Same-URL refreshes with unchanged content are idempotent and preserve the original event age; meaningful metadata changes invalidate earlier review. Different events can still require the existing manual split action.
- Additional ownership contributes 5 points per extra group, capped at 15, **only after materiality passes**. One outlet's repeat coverage and same-owner sister outlets cannot add prominence. All other `mainstream-v1` materiality rules remain unchanged, including routine SPI rejection and Pakistan-independent World eligibility.
- Independently retrieved primary documents produce individually identified bounded excerpt records, marked as awaiting claim verification. Reporting evidence requires editor-assembled factual records: `statement`, short exact `excerpt`, comparison `key` and `value`, plus the existing provenance attestation. Maximum 12 records, 25 words per excerpt and 100 excerpt words per source. These limits reduce collection, not grant legal rights.
- The adapter receives only evidence records with observation IDs, URLs, document hashes, timestamps, source ownership, excerpts and attribution flags. It does not receive discovery headlines, source summaries, selection sentences or full reporting articles. Primary records are first; reporting-only packets need at least two ownership groups. **Independent research is assisted/manual; automatic open-web research and primary-document search are not implemented.** Missing evidence blocks model input rather than substituting a rewrite.
- Claims cite observation IDs and exact excerpts. Each claim must have primary support or two reporting groups; sensitive claims require two groups. Explicit conflicting fact keys/values must remain represented and linked in the draft, with attribution and sensitive review. Semantic contradictions without matching keys remain a human research responsibility.
- Copied source headlines and fourteen-word retained-source matches block readiness. These checks flag suspicious wording; they cannot detect all close paraphrases, borrowed structure/analysis or establish copyright compliance. Human claim, whole-article and visual attestations remain mandatory. No source photographs are imported. Visual requirements retain “Pakistan Report illustration.”

## Supervised next test

Run the updated local tests, then manually assemble one consequential event from permitted discovery metadata and independently checked primary material. Inspect the structured packet and its source references before a separately authorized local drafting test. Stop at human review, with no Publisher contact. Broader automated local/hosted monitoring should wait for a permission-reviewed domestic pair plus a World feed and actual endpoint/robots/runtime tests. Nothing in this audit establishes hosted retrieval or real model quality.
