#!/usr/bin/env python3
"""Read-only checks for built Jekyll sitemap and indexable HTML documents."""
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse, unquote
from xml.etree import ElementTree as ET

class Head(HTMLParser):
    def __init__(self):
        super().__init__()
        self.canonicals = []
        self.robots = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "link" and "canonical" in a.get("rel", "").lower().split():
            self.canonicals.append(a.get("href", ""))
        if tag == "meta" and a.get("name", "").lower() in ("robots", "googlebot"):
            self.robots.append(a.get("content", ""))

def file_for(root, path):
    p = root / path.lstrip("/")
    for f in (p / "index.html", p):
        if f.is_file():
            return f
    return None

def main():
    root = Path(sys.argv[1] if len(sys.argv) > 1 else "_site")
    sitemap = root / "sitemap.xml"
    if not sitemap.is_file():
        sys.exit("ERROR: built sitemap.xml missing")
    urls = []
    for node in ET.parse(sitemap).iter():
        if node.tag.endswith("}loc") or node.tag == "loc":
            if node.text:
                urls.append(node.text.strip())
    problems = []
    html_count = 0
    for url in urls:
        parsed = urlparse(url)
        if parsed.netloc not in ("pakistanreport.pk", "www.pakistanreport.pk"):
            problems.append(("unexpected sitemap hostname", url))
            continue
        file = file_for(root, unquote(parsed.path))
        if file is None:
            problems.append(("sitemap target missing from build", url))
            continue
        if file.suffix != ".html" or re.fullmatch(r"/google[0-9a-f]+\\.html", parsed.path):
            continue
        html_count += 1
        parser = Head()
        parser.feed(file.read_text(encoding="utf-8", errors="replace"))
        if len(parser.canonicals) != 1:
            problems.append(("expected one canonical tag", url))
        elif parser.canonicals[0].rstrip("/") != url.rstrip("/"):
            problems.append(("canonical differs from sitemap URL", url))
        if any(re.search(r"\bnoindex\b", r, re.I) for r in parser.robots):
            problems.append(("noindex page included in sitemap", url))
    print("Sitemap URLs:", len(urls))
    print("Sitemap HTML pages inspected:", html_count)
    print("Sitemap/indexing errors:", len(problems))
    for reason, url in problems[:100]:
        print("ERROR", reason, url)
    if len(problems) > 100:
        print("ERROR ... additional errors:", len(problems)-100)
    return 1 if problems else 0

if __name__ == "__main__":
    sys.exit(main())
