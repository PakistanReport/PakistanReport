#!/usr/bin/env python3
"""Validate the draft-only discovery pilot against the generated Jekyll output."""
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

class Inspector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = set()
        self.robots = []
        self.in_head = False
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "head": self.in_head = True
        if tag == "a": self.links.add(urlparse(a.get("href", "")).path)
        if tag == "meta" and self.in_head and a.get("name", "").lower() == "robots":
            self.robots.append(a.get("content", ""))
    def handle_endtag(self, tag):
        if tag == "head": self.in_head = False

def main():
    root = Path(sys.argv[1] if len(sys.argv) > 1 else "_site")
    preview = root / "indexing-pilot-preview" / "index.html"
    assert preview.exists(), "Pilot preview not generated"
    html = preview.read_text(encoding="utf-8")
    parser = Inspector()
    parser.feed(html)
    assert len(parser.robots) == 1 and "noindex" in parser.robots[0].lower(), "Pilot preview must have one noindex tag in head"
    assert not re.search(r"Missing post record for", html), "Pilot contains a missing post URL"
    expected = [
        "/business/colgate-palmolive-pg-karachi-assets-deal/",
        "/business/engro-fertilizers-mari-energies-community-development/",
        "/business/frieslandcampina-engro-nine-month-profits/",
        "/business/giz-support-300-sindh-businesses-environment/",
        "/business/pakistan-225-billion-battery-factory-awaits-policy-approval/",
        "/economy/china-kuwait-pakistan-loan-rollovers/",
        "/economy/ecc-supplementary-grants-defence-projects/",
        "/economy/ecc-water-infrastructure/",
        "/economy/fbr-super-tax-phase-out-kati-karachi/",
        "/economy/imf-tax-base-economic-reforms/",
    ]
    for path in expected:
        assert path in parser.links, "Missing pilot article link: " + path
        assert (root / path.lstrip("/") / "index.html").exists(), "Missing built article: " + path
    sitemap = (root / "sitemap.xml").read_text(encoding="utf-8")
    assert "/indexing-pilot-preview/" not in sitemap, "Pilot preview must not appear in sitemap"
    print("Pilot preview valid: 10 article links, noindex in head, excluded from sitemap")

if __name__ == "__main__":
    main()
