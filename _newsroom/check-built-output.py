"""Required generated-output checks, not live/browser QA. Run after real Jekyll."""
from pathlib import Path
import json
import xml.etree.ElementTree as ET
from html.parser import HTMLParser

root = Path(__file__).resolve().parents[1]
site = root / '_site'
assert site.is_dir(), 'Run a real Jekyll build first'
for item in ['wrangler.jsonc', '_newsroom', 'README.md', 'Gemfile', 'node_modules', 'vendor']:
    assert not (site/item).exists(), f'Operational file exposed: {item}'
assert (site/'google75307899b867922a.html').read_bytes() == (root/'google75307899b867922a.html').read_bytes()
for item in ['sitemap.xml','feed.xml']:
    ET.parse(site/item)
assert 'https://pakistanreport.pakistanreportnews.workers.dev/sitemap.xml' in (site/'robots.txt').read_text()
for route in ['', 'pakistan','politics','economy','business','jobs','technology','world','explainer','about','contact','corrections','editorial-policy','privacy','terms']:
    assert (site/route/'index.html').is_file(), f'Missing route: {route}'
class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.canon=[]; self.ld=[]; self.in_ld=False; self.buffer=''
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if tag=='link' and a.get('rel')=='canonical': self.canon.append(a.get('href'))
        if tag=='script' and a.get('type')=='application/ld+json': self.in_ld=True; self.buffer=''
    def handle_data(self, data):
        if self.in_ld: self.buffer+=data
    def handle_endtag(self, tag):
        if tag=='script' and self.in_ld:
            self.ld.append(json.loads(self.buffer)); self.in_ld=False
articles=0
for file in site.rglob('*.html'):
    text=file.read_text()
    if '<html' not in text.lower(): continue
    p=Page(); p.feed(text)
    assert len(p.canon)==1 and p.canon[0].startswith('https://pakistanreport.pakistanreportnews.workers.dev/'), file
    assert text.count('window.pakistanReportAnalyticsInstalled = true')==1, file
    assert text.count('id="pr-analytics-notice"')==1, file
    assert 'gtag(\'consent\'' not in text, file
    for data in p.ld:
        if data.get('@type')=='NewsArticle':
            articles+=1
            for key in ['headline','datePublished','author','mainEntityOfPage']: assert data.get(key), (file,key)
assert articles >= 19, f'Expected the 19 existing articles, found {articles}'
print(f'PASS: generated routes/XML/robots/canonicals/JSON-LD, verification preservation, exclusion and single consent/analytics wiring; {articles} articles. Live QA still required.')
