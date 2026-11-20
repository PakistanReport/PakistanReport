#!/usr/bin/env python3
"""Check the public article index against the generated Jekyll site."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse
import sys

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.robots = []
        self.canonicals = []
        self.in_head = False
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "head": self.in_head = True
        if tag == "a": self.links.append(urlparse(attrs.get("href", "")).path)
        if self.in_head and tag == "meta" and attrs.get("name", "").lower() == "robots":
            self.robots.append(attrs.get("content", ""))
        if self.in_head and tag == "link" and attrs.get("rel") == "canonical":
            self.canonicals.append(attrs.get("href", ""))
    def handle_endtag(self, tag):
        if tag == "head": self.in_head = False

def parse(path):
    assert path.exists(), "Missing generated file: " + str(path)
    p = Links()
    p.feed(path.read_text(encoding="utf-8"))
    return p

def main():
    root = Path(sys.argv[1] if len(sys.argv) > 1 else "_site")
    index = parse(root / "article-index" / "index.html")
    article_links = [p for p in index.links if p.startswith(("/business/", "/economy/", "/pakistan/", "/politics/", "/world/", "/technology/")) and len([part for part in p.split("/") if part]) >= 2]
    assert len(article_links) == 250, f"Expected 250 linked articles, got {len(article_links)}"
    assert len(set(article_links)) == 250, "Duplicate article links in index"
    for url in article_links:
        assert (root / url.lstrip("/") / "index.html").exists(), "Missing built article: " + url
    assert len(index.robots) == 1 and "index" in index.robots[0].lower() and "noindex" not in index.robots[0].lower(), "Index must be indexable"
    assert index.canonicals == ["https://pakistanreport.pk/article-index/"], "Wrong article-index canonical"
    sitemap = (root / "sitemap.xml").read_text(encoding="utf-8")
    assert "https://pakistanreport.pk/article-index/" in sitemap, "Index missing from sitemap"
    latest = parse(root / "latest" / "index.html")
    assert "/article-index/" in latest.links, "Article index not linked from first Latest page"
    print("Article index valid: 250 unique reachable article links; indexable, canonical, sitemap and Latest page link verified")

if __name__ == "__main__":
    main()
