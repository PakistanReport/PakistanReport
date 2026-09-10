# Definitive V1 release gates — supersedes earlier checklists

Owner's latest scope controls this handoff. No further Facebook investigation, source retrofits, domain, monetisation or optional work.

## Before production
- Explicit owner approval to put this candidate into GitHub main and permit Cloudflare Workers production build/deployment. No remote writes have occurred.
- Explainer editorial approval granted; clean IMF URLs and three-column Markdown table checked. Included in _posts/2026-09-10-why-lower-inflation-does-not-necessarily-mean-lower-prices.md, published:true, dated 2026-09-10 12:37:55 +0500 at approved inclusion. No article-body rewrite. Production is still on hold.
- Recheck main remains 9724cefdf75e106622b7d75e0f77aed30578c3ff immediately before applying. If it moved, reconcile its actual changes before committing; never overwrite blindly.

## Deployment-time gates
Ruby/Bundler/Jekyll unavailable locally. Owner explicitly moved a real Jekyll build to deployment-time verification. No more installation attempts. Cloudflare's existing main-linked Workers build is the execution route after approval. Ensure JEKYLL_ENV=production when Jekyll runs; otherwise analytics is omitted by its intentional guard. Verify build/deploy logs and generated output. Build failure or an actual defect requires correction; the prior baseline's successful build does not certify this candidate.

After deployment, verify desktop/mobile, menu/category/navigation/trust pages, representative articles and images, verification file, canonical URLs, sitemap/feed/robots, and analytics consent/network/GA4 behavior. V1 is not complete until these checks pass. Analytics/privacy source remains frozen unless testing demonstrates a defect.

## Facebook closed at owner-approved scope
Contact category/email and Page status pass on supplied screenshots. Management context verified. Owner reports latest action-button screen shows no custom action button configured; adding one is not required. Public Page Transparency is not observable in the current interface. Remaining header/link/branding observations are not release gates under the owner's latest instruction. No further screenshots, UI/authentication, account changes or branding work. Cloud Browser limitation is not a blocker. No Facebook changes made.

## Post-launch newsroom operations
Routine source retrofits and future editorial approvals, worthwhile ongoing reporting, optional branding/domain/monetisation are not launch blockers. No material factual/legal/attribution problem in an existing article is established by this pass. Do not create filler. The one sourced Explainer is the proposed minimum to address the empty category, approved and included.
