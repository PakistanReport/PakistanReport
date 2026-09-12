# Executed verification — 2026-09-12

## Passed

- 35 automated tests (`npm test`): ZIP upload; two articles/images; whole-batch rejection without partial storage; required title/category; malformed YAML/JSON; missing/wrong/corrupt images; invalid time/slug/package paths; duplicate paths/slugs and cross-batch reservations; preservation of body; quoted YAML date handling; approval; Publish Now; independent batches; private API/image access; CSRF; missing/weak password; atomic publication; archive/discard; retained audit.
- Actual local Cloudflare **workerd** runtime, SQLite Durable Object and HTTP endpoints: upload two disposable stories, Approve & Schedule, automatic alarms, both Published, correct `_posts/` and `assets/images/` entries, exactly two simulated GitHub commits.
- Separate **125-second** scheduled alarm run passed in 125.95 seconds, without manually invoking the alarm handler. GitHub API remained simulated.
- Lost GitHub update response recovered through persisted candidate ancestry; retry created no duplicate commit. Concurrent editorial change preserved through non-forced update/retry. Transient failure retries; permanent image collision becomes Failed; six-attempt exhaustion becomes Failed; interrupted Publishing state recovers. These failure scenarios use a simulated GitHub service and SQLite-backed state.
- Wrangler deployment dry run succeeded: approximately 265 KiB uncompressed / 65 KiB gzipped, one SQLite Durable Object binding and a five-minute watchdog cron.
- Public homepage HTTP HEAD returned 200. This is reachability evidence only, not deployment/build certification.
- Existing tracked production files are unchanged. Search Console verification remains the original Git blob `e9448047390aa699150b064b619e416131887d8b`. All additions are under the already-excluded `_newsroom/publisher/` directory.

## Not completed

- Browser-rendered review, layout and click-flow verification: Playwright browser downloads timed out; an alternate local Chromium executable could not launch (SIGTRAP). A runnable browser test is included, but no screenshot or visual-pass claim is made.
- Deployment into the owner's Cloudflare account; real Worker secret installation; private production login; real timed commits to main; Cloudflare build logs; live disposable article URLs; public test cleanup. Cloudflare account access and a repository-scoped runtime GitHub token were unavailable. No genuine or disposable production content was changed.
- Public Search Console response contents were not verified; the repository file is untouched.

## Reproduce

```sh
cd _newsroom/publisher
npm ci
npm test
npm run check
LONG_ALARM_TEST=1 node --test test/runtime.test.js
npx playwright install chromium
node test/browser.js
```

Node 22+ required (Node SQLite support). The browser test takes about two minutes and uses the same local Worker with a simulated GitHub service. `PUBLISHER_CHROMIUM_EXECUTABLE` can point to an installed compatible Chromium binary. Test dependencies never enter the deployed Worker bundle.

Run the production two-story smoke test in README.md after setup. Do not equate local simulation with a completed production launch.
