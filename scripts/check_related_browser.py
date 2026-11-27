import csv
from collections import Counter
from pathlib import Path
from playwright.sync_api import sync_playwright

rows = list(csv.DictReader(open("related-coverage-audit.csv", encoding="utf-8")))
related = Counter(x for row in rows for x in row["related_coverage"].split(" | ") if x)
print("Related-only unique destinations:", len(related))
for topic in ("solar", "railway", "digital-payment", "stock-market", "remittance", "foreign-exchange-reserve", "privatisation"):
    for row in [r for r in rows if topic in r["article"]][:3]:
        print("NEW TOPIC SAMPLE:", row["article"], row["related_coverage"])
samples = [r for r in rows if any(s in r["article"] for s in ("automobile-export-incentives", "advance-fuel-storage", "kp-development-package", "alibaba-developing", "reduces-petrol-price"))]
samples += [next(r for r in rows if not r["related_coverage"])]
Path("recommendation-screenshots").mkdir(exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch()
    for width in (390, 1280):
        page = browser.new_page(viewport={"width": width, "height": 900})
        page.route("**/*", lambda route: route.abort() if not route.request.url.startswith("http://127.0.0.1:8765/") else route.continue_())
        for i, row in enumerate(samples):
            page.goto("http://127.0.0.1:8765" + row["article"], wait_until="load")
            more = page.locator("section.related-stories")
            rel = page.locator("#pr-related-coverage")
            assert more.count() == 1 and more.is_visible(), row
            assert rel.count() == bool(row["related_coverage"]), row
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), (width, row)
            if rel.count():
                assert rel.is_visible(), row
                assert rel.evaluate("(el) => !!(el.compareDocumentPosition(document.querySelector('footer')) & Node.DOCUMENT_POSITION_FOLLOWING)"), row
                columns = rel.locator(".pr-related-list").evaluate("(el) => getComputedStyle(el).gridTemplateColumns.split(' ').length")
                assert columns == (1 if width <= 700 else 3), (width, columns)
                rel.screenshot(path=f"recommendation-screenshots/{width}-{i}-related.png")
            more.screenshot(path=f"recommendation-screenshots/{width}-{i}-more.png")
            print("BROWSER PASS:", width, row["article"])
        page.close()
    browser.close()
