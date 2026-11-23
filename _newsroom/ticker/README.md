# Pakistan news ticker

The site reads short event briefs from the `ticker-feed` branch. Sources and
timestamps are kept in audit records, not displayed. The feed is independent
of article publishing and the paused ChatGPT news alerts.

## Activate

1. Merge the implementation and allow the website's normal build to complete.
2. In repository Actions secrets, add `TICKER_OPENAI_API_KEY` using an API project
   with a budget you control. ChatGPT subscription access does not supply this key.
3. Set Actions variable `TICKER_ENABLED` to `true`. Optionally set `TICKER_MODEL`
   to a Responses API model supporting JSON output. The default is gpt-4.1-mini.
4. Run the workflow manually and inspect its audit artifact and output before
   relying on scheduled updates. Scheduled jobs then run every 15 minutes.

The connector cannot install account secrets. Scheduled GitHub Actions can be
delayed and are not a real-time delivery guarantee. A public repository is
required for the browser's raw feed URL. The ticker stays hidden until valid,
unexpired data is available. Expiry continues to work during collection failure.

## Editorial operation

Every run attempts all configured source pages and auto-discovers advertised
RSS/Atom feeds. Business, economy, technology and provincial sections have their
own pages in the roster. The directory includes the 31 local publishers and
earlier primary sources. International coverage can only establish events
directly concerning Pakistan. WealthPK aggregation must be traced to the origin.
Primary homepages are fallback discovery and can miss releases behind search,
JavaScript or PDF links. These gaps are recorded rather than labelled verified.
Add dated release/feed URLs to sources.json when a publisher provides them.

Models select leads, read accessible texts and produce 25–45-word briefs.
Each accepted brief has an exact excerpt in inspected evidence and an independent
second verification pass. This reduces errors but does not replace editorial
judgment. Inspect initial output carefully. The system does not require three
outlets for a ticker update. Copies and wire reports do not become independent
confirmation. Attribution remains in the brief when consequential.

Briefs expire six hours after a material update. Pinning affects order but never
extends expiry. Edit overrides.json to hide or pin event IDs, or pause the feed.
The previous feed remains intact after a failed run. Sources that are blocked,
unreadable, or too large are logged. No raw article texts are saved in the feed.

Costs scale with inspected pages, fresh candidates and verification calls.
Audit usage records contain model token counts. No arbitrary story quota is
applied. The run timeout bounds execution, and failures do not publish partial
results. Before activation, agree an API budget and review a trial day's usage.

The audit artifact contains source coverage, accepted/rejected decisions and
unresolved retrieval failures. Cached state retains evidence URLs and excerpts
for active briefs. These records follow repository Actions access permissions.

## Checks

Run `python -m unittest discover -s _newsroom/ticker -p 'test_*.py'` after
installing requirements, and `node --check assets/js/news-ticker.js`.
