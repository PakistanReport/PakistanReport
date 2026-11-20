# Editorial discovery pilot — review before deployment

This is a **draft-only**, deliberately limited internal-link pilot for 10 affected articles (5 Business, 5 Economy) selected from the November 19 Search Console export and ranked recovery CSV. The existing website already has archive links and four same-category related-story links per article. The goal is to test *prominence*, not to repair nonexistent orphan pages.

- `_data/indexing_pilot.yml`: selected article URLs, reviewed against the GSC-affected list.
- `indexing-pilot-preview.html`: Jekyll-generated HTML with live article titles and dates from `site.posts`, no global navigation link, sitemap exclusion, and noindex instruction.
- No existing homepage, article, category, footer, or pagination templates are changed.
- **Do not merge or deploy** the preview as an SEO intervention. It is intentionally not linked from the live site and will not increase crawl discovery until an editor approves real placement.
- After approval, consider a restrained section-page link or editorially relevant related-story placement for these ten posts. Do not auto-insert links into unrelated copy.
- Measure Google Search Console crawl/indexing status for this group against a comparable unaffected control group for 2–4 weeks. No indexing guarantee.

## Selected URLs

- /business/colgate-palmolive-pg-karachi-assets-deal/
- /business/engro-fertilizers-mari-energies-community-development/
- /business/frieslandcampina-engro-nine-month-profits/
- /business/giz-support-300-sindh-businesses-environment/
- /business/pakistan-225-billion-battery-factory-awaits-policy-approval/
- /economy/china-kuwait-pakistan-loan-rollovers/
- /economy/ecc-supplementary-grants-defence-projects/
- /economy/ecc-water-infrastructure/
- /economy/fbr-super-tax-phase-out-kati-karachi/
- /economy/imf-tax-base-economic-reforms/

## Acceptance criteria

1. All 10 target URLs resolve to actual `site.posts` and render linked titles.
2. Preview is absent from sitemap and not linked from production navigation.
3. Existing indexing, canonical and pagination audits pass.
4. Human approves any actual visible placement before merging.
