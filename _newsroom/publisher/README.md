# Pakistan Report Publisher — V1

Separate private Cloudflare Worker. ZIP → validate against GitHub → review → Approve & Schedule → Durable Object alarm → atomic article/image commit to `PakistanReport/PakistanReport:main` → existing Cloudflare build.

## One-time setup

Requires Node 22+ and a Cloudflare **Workers Free** account. No paid plan, R2, external database or scheduler is required. The setup script does not upgrade plans. It creates only `pakistan-report-publisher` and its SQLite Durable Object.

1. Clone this branch and run `cd _newsroom/publisher && npm ci`.
2. Create a fine-grained GitHub personal access token: resource owner PakistanReport; repository **PakistanReport/PakistanReport only**; repository **Contents: read and write**. No Actions, Administration or Workflows permission. Choose an expiry and rotate the Worker secret before expiry. The existing GitHub connector cannot supply a runtime credential.
3. Run `node scripts/setup.js`. Sign into your Cloudflare account when prompted, verify the account shown, and paste the GitHub token into the hidden prompt. Save the generated Publisher password in a password manager.
4. Open the separate `pakistan-report-publisher.<your-workers-subdomain>.workers.dev` URL printed by Wrangler. Browser sign-in: username `publisher`, generated password. HTTPS Basic authentication protects **every route**, image, template and API. A missing/short secret fails closed. Mutations also require the same Origin and a custom header. No GitHub token reaches the browser.
5. Confirm the existing **pakistanreport** Worker remains connected to GitHub `main`, with its existing Jekyll build producing `_site`. This project does not change that integration or its build settings. In your own account, run the two disposable-story smoke test below before using editorial content.

Secrets can be rotated with `npx wrangler secret put GITHUB_TOKEN` or `npx wrangler secret put PUBLISHER_PASSWORD` (use a randomly generated password of at least 32 characters). Do not put secrets in this public repository or ZIP packages. To stop automated publishing without deleting queued data, remove the `GITHUB_TOKEN` Worker secret. Due items will fail visibly and can be retried after restoring it.

## Daily use

1. Download the two-story template from the authenticated dashboard, or run `npm run example` to generate a ZIP dated tomorrow in Pakistan time.
2. Replace the disposable Markdown/image files with finished editorial content and update `manifest.json`.
3. Upload one ZIP. The **whole batch** must validate; rejected packages create no queue items.
4. Review titles, images, categories and Pakistan schedules. Click **Approve & Schedule**, then leave. Repeat for other independent batches.
5. Use **Publish Now** for an individual validated/scheduled story. Its front-matter publication timestamp becomes the current Pakistan time, so even tomorrow's filename can be published now. Jekyll uses the explicit front-matter date. After a first attempt, retries preserve the exact payload and timestamp.
6. Check status as needed. Archive stored files for completed batches to reclaim private storage; GitHub articles/images and audit history are retained. Discard an entirely unapproved batch to correct/re-upload it.

## Package format

ZIP root must contain `manifest.json`, `articles/`, and `images/`. No enclosing folder, macOS metadata, executable files or unlisted content. 1–20 stories; ZIP ≤24 MiB; expanded ≤32 MiB; each image ≤4 MiB; each Markdown ≤128 KiB. Private image storage is capped at 512 MiB. PNG/JPEG/WebP only.

```json
{
  "version": 1,
  "timezone": "Asia/Karachi",
  "name": "Morning Batch",
  "items": [
    {
      "article": "articles/2026-09-15-example-story.md",
      "image": "images/example-story.png",
      "schedule": "2026-09-15T10:30:00+05:00"
    }
  ]
}
```

```markdown
---
layout: article
title: "Your finished headline"
category: "Economy"
author: "Pakistan Report Editorial Desk"
description: "Your finished description."
published: true
image: "/assets/images/example-story.png"
image_alt: "A meaningful image description."
image_caption: "Your caption."
---

Your finished article body.
```

Categories, exactly as the repository: **Pakistan, Politics, Economy, Business, Technology, World, Jobs, Explainer**. Filenames are `YYYY-MM-DD-lowercase-hyphen-slug.md`; filename date matches the schedule's Pakistan date at upload. `date` is optional; if supplied, it must agree with the manifest and use `YYYY-MM-DD HH:mm:ss +0500`. No duplicate title/category data in the manifest. No custom `permalink` or `categories`; optional `slug` must match the filename. V1 rejects Liquid templates, YAML aliases, empty bodies, unclosed code fences and mismatched inline image references. Markdown is otherwise permissive; it is not an editorial or factual checker.

## Scheduling and failure behavior

SQLite stores private article/image payloads and independent batch records. An alarm wakes at the earliest due timestamp; it releases one article at a time, then schedules the next. The five-minute Cron Trigger repairs missing wake-ups after interruptions; it is not the primary scheduler. Nothing is committed early. An unavailable provider may cause delay; alarms are not a hard real-time guarantee. Public availability follows the existing Cloudflare build and is later than the commit time.

Validation happens before storing, before approval and before publishing. GitHub collision checks repeat against the latest main tree. Slugs, paths and images are also uniquely reserved across private batches. Article and image are one Git tree/commit. Ref updates are fast-forward only; an intervening editorial commit causes a safe retry. A persisted candidate commit SHA is reconciled against main ancestry after ambiguous responses. If files subsequently change, publication fails for human review rather than overwriting them.

Statuses: **Draft** while the package is being uploaded/checked (not a saved editable draft); **Validated**, **Scheduled**, **Publishing**, **Published**, **Failed**. Published means the atomic commit reached GitHub; it does **not** certify the Cloudflare build. Commit and normal article links are shown. Cloudflare build logs remain in the existing account dashboard.

Transient network/5xx/rate-limit/conflicting-ref failures retry up to six attempts with 30-second exponential backoff (capped at 15 minutes), honoring rate-limit delays. A recovered interrupted attempt counts toward that limit. Permanent collisions/permission errors become Failed immediately. History, errors, payload and commit journal remain available for manual retry. Platform free-quota exhaustion may prevent status updates until the quota resets; the cron watchdog resumes persisted work afterward.

## Verification and live smoke test

`npm test` runs validation, access-control, SQLite workflow, duplicate/retry/failure and real local workerd alarm tests. GitHub responses are simulated in these tests; **they are not production deployment evidence**. `npm run check` bundles a deployment dry run. `test/browser.js` runs the full browser workflow with one Publish Now item and another about two minutes ahead against local workerd (requires Playwright Chromium; see TEST-RESULTS.md).

After deployment, use two uniquely named disposable test articles and matching images. Schedule the second a few minutes ahead, approve, then Publish Now for the first. Close the dashboard and reopen after the schedule. Verify both GitHub commits contain only their corresponding `_posts/` and `assets/images/` pair; inspect the existing Cloudflare build logs; open both normal article URLs; retry/refresh and confirm no duplicate commits. Delete only those exact test posts/images together in a cleanup commit, then verify the public build. Never edit genuine stories or `google75307899b867922a.html`.

## Isolation and inspected baseline

Inspected main `14a6fcbc747218bfcd5ecbf100ccbedd35c87cc7`. Existing `_config.yml`: timezone Asia/Karachi, permalink `/:categories/:title/`, Jekyll 4.3, article layout, singular category. Existing `wrangler.jsonc`: Worker `pakistanreport`, static assets `_site`, auto-trailing-slash handling. There are no GitHub Actions workflows in the inspected tree; account-level Workers Builds settings/logs were not accessible. `_newsroom` is already excluded by Jekyll, so adding this utility changes no public build configuration. All production files, including Search Console verification, remain untouched.
