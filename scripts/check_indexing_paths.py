#!/usr/bin/env python3
"""Read-only audit of generated archive navigation and affected article discovery.

Usage: python3 scripts/check_indexing_paths.py _site [Table.csv]
Build first: bundle exec jekyll build

Exit nonzero only for broken generated archive links, not for an affected article
that simply lacks a direct link from a *numbered* archive (which is diagnostic).
"""
import csv
import re
import sys
from collections import defaultdict, deque
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlparse

ARCHIVE = re.compile(r"^/(?:latest|business|economy|world|pakistan|politics|technology|economy-business|pakistan-politics|iran-conflict)(?:/page/\d+)?/$")
PAGINATED = re.compile(r"/page/\d+/$")
HOSTS = {"pakistanreport.pk", "www.pakistanreport.pk"}

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.hrefs = []
    def handle_starttag(self, tag, attrs):
        if tag == "a":
            href = dict(attrs).get("href")
            if href:
                self.hrefs.append(href)

def normalize(href):
    u = urlparse(href)
    if u.scheme and u.scheme not in ("http", "https"):
        return None
    if u.netloc and u.netloc.lower() not in HOSTS:
        return None
    path = unquote(u.path or "/")
    if not path.startswith("/"):
        return None
    return path.rstrip("/") + "/"

def html_file(root, path):
    p = root / path.lstrip("/")
    for candidate in (p / "index.html", root / path.lstrip("/").rstrip("/")):
        if candidate.is_file():
            return candidate
    return None

def main():
    root = Path(sys.argv[1] if len(sys.argv) > 1 else "_site")
    if not root.is_dir():
        sys.exit("Missing built site: run bundle exec jekyll build first.")
    archives = {}
    for file in sorted(root.glob("**/index.html")):
        relative = file.relative_to(root).parent.as_posix()
        path = "/" if relative == "." else "/" + relative.strip("/") + "/"
        if ARCHIVE.fullmatch(path):
            parser = Links()
            parser.feed(file.read_text(encoding="utf-8", errors="replace"))
            archives[path] = {p for href in parser.hrefs if (p := normalize(href))}
    if not archives:
        sys.exit("No generated archives found: inspect Jekyll build configuration.")

    problems = []
    archive_graph = defaultdict(set)
    for source, links in archives.items():
        for target in links:
            if target in archives:
                archive_graph[source].add(target)
            # Check archive-to-archive and article-like links; ignore navigation
            # to external or non-HTML resources, and ordinary global nav links.
            if PAGINATED.search(target) and not html_file(root, target):
                problems.append(("broken pagination target", source, target))
        if PAGINATED.search(source) and not any(PAGINATED.search(x) for x in links):
            problems.append(("numbered archive has no pagination links", source, ""))

    seeds = [p for p in archives if not PAGINATED.search(p)]
    visited = set(seeds)
    queue = deque(seeds)
    while queue:
        for target in archive_graph[queue.popleft()]:
            if target not in visited:
                visited.add(target)
                queue.append(target)
    unreachable = sorted(set(archives) - visited)
    for path in unreachable:
        problems.append(("archive unreachable from section landing page", path, ""))

    print("Generated archive pages:", len(archives))
    print("Generated numbered archive pages:", sum(bool(PAGINATED.search(p)) for p in archives))
    print("Archive pages reachable from section landing pages:", len(visited))
    if len(sys.argv) > 2:
        with open(sys.argv[2], newline="", encoding="utf-8-sig") as f:
            rows = list(csv.DictReader(f))
        if not rows or "URL" not in rows[0]:
            sys.exit("Expected Search Console CSV with URL column.")
        affected = {p for row in rows if (p := normalize(row["URL"]))}
        affected_archives = affected & set(archives)
        affected_articles = {p for p in affected if not PAGINATED.search(p) and p not in archives}
        # Direct links from archive cards are distinct from homepage and related links.
        linked = set().union(*(links for links in archives.values()))
        missing_build = sorted(p for p in affected if not html_file(root, p))
        not_linked = sorted(affected_articles - linked)
        print("Affected URLs:", len(affected))
        print("Affected articles / other non-archive URLs:", len(affected_articles))
        print("Affected archive pages generated:", len(affected_archives))
        print("Affected URLs absent from build:", len(missing_build))
        print("Affected non-archive URLs not linked directly from archives:", len(not_linked))
        for p in missing_build:
            print("MISSING_BUILD", p)
        for p in not_linked:
            print("NOT_LINKED_FROM_ARCHIVE", p)
        # Missing build is a warning: historical removed URLs can legitimately
        # be redirected, which needs separate deployed-site verification.
    for reason, source, target in problems:
        print("ERROR", reason, source, target)
    print("Structural archive errors:", len(problems))
    return 1 if problems else 0

if __name__ == "__main__":
    sys.exit(main())
