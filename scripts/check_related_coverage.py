from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse, unquote
import sys
from collections import Counter

class Article(HTMLParser):
    def __init__(self):
        super().__init__()
        self.article = False
        self.section = None
        self.links = {"more": [], "related": []}
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "meta" and a.get("property") == "og:type" and a.get("content") == "article":
            self.article = True
        if tag == "section":
            if a.get("id") == "pr-related-coverage":
                self.section = "related"
            elif "related-stories" in a.get("class", "").split():
                self.section = "more"
        if tag == "a" and self.section:
            u = urlparse(a.get("href", ""))
            assert not u.netloc or u.netloc == "pakistanreport.pk", u
            self.links[self.section].append(unquote(u.path).rstrip("/") + "/")
    def handle_endtag(self, tag):
        if tag == "section":
            self.section = None

root = Path(sys.argv[1])
articles = {}
for path in root.rglob("index.html"):
    p = Article()
    p.feed(path.read_text(encoding="utf-8"))
    if p.article:
        articles["/" + path.parent.relative_to(root).as_posix().strip("/") + "/"] = p.links
assert articles, "No articles found"
incoming = Counter()
distribution = Counter()
for url, links in articles.items():
    more, related = links["more"], links["related"]
    assert len(more) <= 4 and len(related) <= 3, (url, links)
    combined = more + related
    assert len(set(combined)) == len(combined), (url, links)
    assert url not in combined, (url, links)
    assert all(x in articles for x in combined), (url, links)
    incoming.update(combined)
    distribution[len(related)] += 1
assert incoming and sum(k*v for k,v in distribution.items()) > 0
print("Articles:", len(articles), "Unique destinations:", len(incoming))
print("Related count distribution:", sorted(distribution.items()))
print("PASS: no duplicates, self-links or non-article destinations")

# Export actual rendered recommendations for editorial review.
import csv
with open("related-coverage-audit.csv", "w", encoding="utf-8", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["article", "more_from", "related_coverage"])
    for url, links in sorted(articles.items()):
        writer.writerow([url, " | ".join(links["more"]), " | ".join(links["related"])])
for url, links in sorted(articles.items()):
    if any(s in url for s in ("fuel-storage", "automobile-export", "alibaba", "kp-development-package", "petrol-price")):
        print("EDITORIAL SAMPLE:", url, links["related"])
