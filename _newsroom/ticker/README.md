# Free Pakistan news ticker

This version makes no model API calls and needs no API key. Standard GitHub-hosted
Linux runners are free for public repositories. The publishing step refuses
private repositories. No paid services, artifacts or caches are configured.

Hourly collection attempts the 31 local outlets and the primary directory, records
candidate headlines and coverage gaps in the workflow run log, and publishes
only approved 25–45-word briefs. Discovery is automatic; editorial selection,
verification and original writing happen in ChatGPT or by an editor.

Edit approved.json to add a brief with id, text, expires_at (timezone required),
approved:true, and sources (original report URLs). Every brief must expire within
24 hours. Expired and hidden entries are removed automatically. Empty feeds keep
the website ticker hidden. Reader pages refresh every minute.

The scheduled workflow is independent of the paused ChatGPT news-alert task.
Sources and expiry metadata are retained in repository records, without visible
source names or times on the ticker. Candidate headlines are discovery leads and
are never published as verified briefs automatically.

Example approved.json structure (replace values with researched current events):
{"items":[{"id":"event-slug","text":"A researched original brief of 25–45 words.",
"expires_at":"2026-12-01T12:00:00+05:00","approved":true,
"sources":["https://example.org/original-report"]}]}

No briefs have been prefilled. The first real briefs need editorial preparation.
GitHub scheduling may be delayed. Some sources block requests or publish PDF-only
releases; these gaps appear in the workflow run log.
