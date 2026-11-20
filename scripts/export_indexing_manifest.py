#!/usr/bin/env python3
"""Export compact read-only build manifest for offline GSC comparison."""
import csv
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse, unquote

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links=[]
    def handle_starttag(self, tag, attrs):
        if tag=="a":
            href=dict(attrs).get("href","")
            if href:
                u=urlparse(href)
                if (not u.netloc or u.netloc.lower() in ("pakistanreport.pk","www.pakistanreport.pk")) and (not u.scheme or u.scheme in ("http","https")) and u.path.startswith("/"):
                    self.links.append(unquote(u.path).rstrip("/")+"/")

def main():
    root=Path(sys.argv[1] if len(sys.argv)>1 else "_site")
    output=Path(sys.argv[2] if len(sys.argv)>2 else "audit-manifest")
    output.mkdir(parents=True,exist_ok=True)
    files=sorted(root.rglob("index.html"))
    with (output/"pages.csv").open("w",newline="") as f:
        w=csv.writer(f)
        w.writerow(("path","archive_link_count"))
        for file in files:
            p="/"+file.parent.relative_to(root).as_posix().strip("/")+"/"
            if p=="//":p="/"
            parser=Links()
            parser.feed(file.read_text(encoding="utf-8",errors="replace"))
            w.writerow((p,len(parser.links)))
    with (output/"archive_links.csv").open("w",newline="") as f:
        w=csv.writer(f)
        w.writerow(("source","target"))
        for file in files:
            p="/"+file.parent.relative_to(root).as_posix().strip("/")+"/"
            if p=="//":p="/"
            if not any(p.startswith("/"+x+"/") for x in ("latest","business","economy","world","pakistan","politics","technology","economy-business","pakistan-politics","iran-conflict")):continue
            parser=Links()
            parser.feed(file.read_text(encoding="utf-8",errors="replace"))
            for target in sorted(set(parser.links)):
                w.writerow((p,target))
    import shutil
    shutil.copy2(root/"sitemap.xml",output/"sitemap.xml")
    print("Exported compact manifest for",len(files),"generated HTML pages")
if __name__=="__main__":
    main()
