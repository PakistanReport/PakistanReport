# GA4 setup and activation handoff

CURRENT CONFIGURATION: Production GA4 ID is G-8J4QNEXRW4 and analytics.enabled is true, as approved by the owner. Deployment remains on hold. Production-origin, consent and duplicate-inclusion guards are unchanged. Earlier disabled/unconfigured setup instructions below describe the previous preparation state and do not override this configuration.


Status: prepared in source, disabled, no real measurement ID, no deployment. Do not turn on collection or deploy merely because an account exists.

## Account-side steps for the owner

1. Sign in at https://analytics.google.com/ with the Google account intended to own publication analytics. In Admin, select an existing appropriate account or choose Create → Account. Name a new account Pakistan Report and review data-sharing choices.
2. Create/select a GA4 property named Pakistan Report. Set reporting timezone to Pakistan (GMT+05:00 / Asia/Karachi) and currency to PKR. Complete business/objective prompts accurately and review applicable terms.
3. In Admin → Data collection and modification → Data streams, choose Add stream → Web. Use HTTPS and hostname `pakistanreport.pakistanreportnews.workers.dev`; name it Pakistan Report website.
4. For minimal collection, switch Enhanced measurement off initially. The source's GA4 config supplies the initial page view; do not add another manual page-view tag. Optional scroll/download/form/history events are not required at launch.
5. Open the web stream and copy its `G-…` Measurement ID. Supply that ID only, not a password, access token, numeric property ID or GTM container ID.
6. Do not install a second snippet through Google Tag Manager, Cloudflare or a wizard. Leave advertising links, Google Signals, ad personalization and user-provided data collection disabled. Use no Meta Pixel.

Google's [setup guide](https://support.google.com/analytics/answer/9304153?hl=en), [Measurement ID location](https://support.google.com/analytics/answer/12270356?hl=en), and [Enhanced measurement guide](https://support.google.com/analytics/answer/9216061) describe these controls. Labels may vary with the account interface.

## Exact source configuration

See FILE-LOCATIONS.md for line numbers in this package. `_config.yml` is the only place to insert the production ID:

```yaml
analytics:
  enabled: false
  measurement_id: ""
```

Replace the empty string with the real G- ID; keep enabled false until activation is approved and build/privacy/consent checks are complete. The ID is public configuration, not a secret. No ID belongs in Wrangler, an article or a second layout copy.

`_includes/analytics.html` is included once in `_layouts/default.html` and once in the independent `_layouts/article.html`. Category/page layouts inherit default, so do not add extra includes there.

## Implemented first-party consent

A compact first-party notice provides equally styled Allow analytics / Decline buttons and a Privacy link. A permanent footer Analytics preferences button reopens it. `assets/js/analytics-consent.js` records a boolean choice and expiry in localStorage for 180 days; unknown, invalid or expired choices default to off. It restores the choice, monitors expiry, and synchronizes other tabs through storage events. The controller sends the existing `pakistan-report:analytics-consent` event; no default grant is supplied.

Decline/expiry sets the GA disable flag, attempts to clear accessible first-party `_ga` / `_ga_…` cookies at applicable host/domain/path scopes, and reloads if GA had started. Reload prevents the previously loaded script from continuing on that page. Requests already in flight and already collected data cannot be recalled. Browser restrictions can prevent cookie access or choice persistence; storage failures are handled without defaulting to consent.

Consent Mode calls are removed. No CMP, GTM container, Meta Pixel, advertising integration or second tracker exists. Direct GA4 gtag.js is served from Google's googletagmanager.com domain; that is not a GTM container. Production/ID/origin and duplicate guards remain intact. The privacy page documents actual local behaviour and does not invent an account retention setting.

## Before activation/deployment

- Inspect existing account-side injection so one page does not load two tags.
- Set/check `JEKYLL_ENV=production` in the actual Cloudflare build environment when activation is approved. Do not assume Workers sets it. Continue using the existing Jekyll/Workers pipeline; no hosting migration.
- Run a real Jekyll build with analytics disabled and check rendered HTML contains no analytics bootstrap/Google script. Verify production-enabled fixtures separately, without distributing a test measurement ID.
- Verify the implemented privacy text and consent controls in a real browser. Test no network calls when disabled, no ID, wrong origin, preview/development or consent withheld; permitted navigation should produce one expected page view.
- After approved deployment, confirm the intended property in Realtime/DebugView, then processed sessions, source/medium, pages, landing pages, country and returning-user metrics where available. Missing/delayed data is pending, not zero.
- Test a Facebook URL with `utm_source=facebook&utm_medium=social&utm_campaign=launch_v1&utm_content=STORY_FORMAT_VARIANT`; preserve canonical and existing query parameters. Do not tag internal links.
- Keep Search Console and Facebook's native Insights. Website arrivals and Facebook clicks are different measures. Do not mark measurement ready from a tag merely existing in source.

Real Jekyll rendering, Google network behaviour and production event collection have not been tested here. Local bootstrap tests mock the browser and never call Google.
