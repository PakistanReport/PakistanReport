"""Collect Pakistan news, inspect reports, verify briefs, and emit a public feed."""
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
import ipaddress
import socket

from bs4 import BeautifulSoup

ROOT = Path(__file__).parent
NOW = datetime.now(timezone.utc)
PKT = timezone(timedelta(hours=5))
AUDIT = {"started_at": NOW.isoformat(), "sources": [], "decisions": [], "usage": []}


def fetch(url):
    """Only retrieve public HTTP(S) source URLs, with a bounded response."""
    parsed = urlparse(url)
    if parsed.scheme != 'https' or parsed.username or parsed.password:
        raise ValueError('Invalid source URL')
    for address in socket.getaddrinfo(parsed.hostname, parsed.port or 443):
        if not ipaddress.ip_address(address[4][0]).is_global:
            raise ValueError('Source resolves to a non-public address')
    request = Request(url, headers={'User-Agent': 'PakistanReportTicker/1.0 (+https://pakistanreport.pk/contact/)'})
    with urlopen(request, timeout=20) as response:
        raw = response.read(2_000_001)
        if len(raw) > 2_000_000:
            raise ValueError('Source exceeds retrieval limit')
        content_type = response.headers.get('Content-Type', '')
        if not any(kind in content_type for kind in ('text/', 'xml', 'json')):
            raise ValueError('Unsupported content type; document needs manual inspection')
        return raw.decode('utf-8', errors='replace')


def inspect(url):
    soup = BeautifulSoup(fetch(url), 'html.parser')
    title = soup.title.get_text(' ', strip=True) if soup.title else ''
    for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'aside']):
        tag.decompose()
    article = soup.find('article') or soup.find('main') or soup
    text = article.get_text(' ', strip=True)
    if len(text) < 180:
        raise ValueError('Insufficient readable report text')
    # Date metadata is evidence only; the editor must distinguish original dates from updates.
    dates = [tag.get('content') for tag in soup.find_all('meta')
             if any(word in str(tag.get('property', tag.get('name', ''))).lower()
                    for word in ('date', 'published', 'modified'))]
    return {'url': url, 'title': title, 'dates': dates, 'text': text[:35000]}


def discover(source):
    record = {'name': source['name'], 'kind': source['kind'], 'pages': []}
    leads = {}
    for url in source['pages']:
        try:
            soup = BeautifulSoup(fetch(url), 'html.parser')
            feed = soup.find('link', type=re.compile(r'(rss|atom)'))
            if feed:
                try:
                    root = ET.fromstring(fetch(urljoin(url, feed['href'])))
                    for entry in root.iter():
                        if entry.tag.split('}')[-1] not in ('item', 'entry'):
                            continue
                        fields = {child.tag.split('}')[-1]: child for child in entry}
                        link, title = fields.get('link'), fields.get('title')
                        if link is not None and title is not None:
                            target = link.get('href') or link.text or ''
                            leads[urljoin(url, target)] = ''.join(title.itertext())
                except Exception:
                    pass  # HTML discovery remains available if the advertised feed fails.
            for heading in soup.find_all(re.compile('^h[1-4]$')):
                link = heading.find('a', href=True) or heading.find_parent('a', href=True)
                if link:
                    target = urljoin(url, link['href']).split('#')[0]
                    if urlparse(target).scheme == 'https':
                        leads[target] = heading.get_text(' ', strip=True)
            # Official portals often use lists rather than headline elements.
            if source['kind'] == 'primary':
                for link in soup.find_all('a', href=True):
                    label = link.get_text(' ', strip=True)
                    if len(label) > 35:
                        leads[urljoin(url, link['href'])] = label
            record['pages'].append({'url': url, 'status': 'checked' if leads else 'no_usable_leads', 'leads': len(leads)})
        except Exception as error:
            record['pages'].append({'url': url, 'status': 'unavailable', 'reason': type(error).__name__})
    return record, [{'url': url, 'headline': title, 'source': source['name'], 'kind': source['kind']}
                    for url, title in leads.items() if len(title) > 20]


def main():
    output = Path('ticker-output')
    output.mkdir(exist_ok=True)
    approved = json.loads((ROOT/'approved.json').read_text())
    overrides = json.loads((ROOT/'overrides.json').read_text())
    items = []
    for item in approved['items']:
        expires = datetime.fromisoformat(item['expires_at'].replace('Z', '+00:00'))
        if expires.tzinfo is None:
            raise ValueError('Expiry must include timezone')
        if expires <= NOW or item['id'] in overrides['hidden_event_ids']:
            continue
        if not 25 <= len(item['text'].split()) <= 45:
            raise ValueError('Briefs must contain 25–45 words')
        if not item.get('sources') or item.get('approved') is not True:
            raise ValueError('Each brief needs editorial approval and source records')
        if expires > NOW + timedelta(hours=24):
            raise ValueError('Brief expiry must be within 24 hours')
        items.append({key: item[key] for key in ('id', 'text', 'expires_at')})
    items.sort(key=lambda item: item['id'] not in overrides['pinned_event_ids'])
    if overrides['paused']:
        items = []
    (output/'ticker.json').write_text(json.dumps({'items': items}, ensure_ascii=False))
    # Sources are collected as leads only; they never become ticker briefs automatically.
    sources = json.loads((ROOT/'sources.json').read_text())
    candidates = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        for record, leads in pool.map(discover, sources):
            AUDIT['sources'].append(record)
            candidates.extend(leads)
    (output/'candidates.json').write_text(json.dumps(
        {'checked_at': NOW.isoformat(), 'coverage': AUDIT['sources'], 'leads': candidates},
        ensure_ascii=False))
    print(f'Collected {len(candidates)} leads; {len(items)} approved live briefs. No model API calls.')

if __name__ == '__main__':
    main()
