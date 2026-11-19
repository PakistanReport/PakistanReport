#!/usr/bin/env python3
"""Read-only check of built Jekyll archives and article discovery links.

Usage:
  python3 scripts/check_indexing_paths.py _site [search-console/Table.csv]

Build first with: bundle exec jekyll build
No network calls, indexing directives, or production changes.
"""
import csv
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse, unquote

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hrefs = []
    def handle_starttag(self, tag, attrs):
        if tag == "a":
            href = dict(attrs).get("href")
            if href:
                self.hrefs.append(href)

def url_path(href):
    parsed = urlparse(href)
    if parsed.netloc and parsed.netloc not in ("pakistanreport.pk", "www.pakistanreport.pk"):
        return None
    return unquote(parsed.path or "/").rstrip("/") + "/"

def html_path(root, path):
    relative = path.lstrip("/")
    candidates = [root / relative / "index.html", root / relative.rstrip("/")]
    return next((p for p in candidates if p.is_file()), None)

def main():
    root = Path(sys.argv[1] if len(sys.argv) > 1 else "_site")
    if not root.is_dir():
        sys.exit("Build directory missing. Run bundle exec jekyll build first.")
    pages = sorted(root.glob("**/index.html"))
    archive_re = re.compile(r"^/(?:latest|business|economy|world|pakistan|politics|technology|economy-business|pakistan-politics|iran-conflict)/page/\d+/$")
    archive_paths = {}
    all_article_links = set()
    problems = []
    for file in pages:
        path = "/" + file.relative_to(root).parent.as_posix().strip("/") + "/"
        if path == "//":
            path = "/"
        if not archive_re.match(path):
            continue
        parser = Links()
        parser.feed(file.read_text(encoding="utf-8", errors="replace"))
        links = {p for href in parser.hrefs if (p := url_path(href))}
        archive_paths[path] = links
        for target in links:
            if target != path and not html_path(root, target):
                problems.append((path, target, "missing generated target"))
            if not archive_re.match(target) and not target.startswith(("/assets/", "/images/")):
                all_article_links.add(target)
        if not any(re.search(r"/page/\d+/$", link) for link in links):
            problems.append((path, "", "no numbered pagination link"))
    print(f"Built archive pagination pages: {len(archive_paths)}")
    print(f"Unique non-pagination links from archives: {len(all_article_links)}")
    if len(sys.argv) > 2:
        with open(sys.argv[2], newline="", encoding="utf-8-sig") as f:
            rows = list(csv.DictReader(f))
        affected = {url_path(row["URL"]) for row in rows if row.get("URL")}
        affected_articles = {p for p in affected if p and not re.search(r"/page/\d+/$", p) and p not in ("/economy-business/", "/pakistan-politics/")}
        absent = sorted(affected_articles - all_article_links)
        print(f"Affected non-pagination URLs: {len(affected_articles)}")
        print(f"Not directly linked from a numbered archive: {len(absent)}")
        for path in absent:
            print("NOT_LINKED", path)
        for path in sorted(affected & set(archive_paths)):
            if not archive_paths[path]:
                problems.append((path, "", "empty archive"))
        for path in sorted(affected):
            if not html_path(root, path):
                problems.append((path, "", "affected URL missing from build"))
    for source, target, reason in problems:
        print("ISSUE", reason, source, target)
    print(f"Problems: {len(problems)}")
    return 1 if problems else 0

if __name__ == "__main__":
    sys.exit(main())
