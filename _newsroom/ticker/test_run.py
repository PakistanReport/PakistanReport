import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('ticker_run', Path(__file__).with_name('run.py'))
run = importlib.util.module_from_spec(spec)
spec.loader.exec_module(run)


class TickerTests(unittest.TestCase):
    def test_feed_and_section_discovery(self):
        pages = {
            'https://example.org/': '<link type="application/rss+xml" href="/feed"><h2><a href="/policy">A material new policy announced today</a></h2>',
            'https://example.org/feed': '<rss><channel><item><title>Company announces significant new investment</title><link>https://example.org/investment</link></item></channel></rss>'}
        with patch.object(run, 'fetch', side_effect=lambda url: pages[url]):
            record, leads = run.discover({'name': 'Example', 'kind': 'newsroom', 'pages': ['https://example.org/']})
        self.assertEqual(record['pages'][0]['status'], 'checked')
        self.assertEqual({item['url'] for item in leads}, {'https://example.org/policy', 'https://example.org/investment'})

    def test_failures_recorded(self):
        with patch.object(run, 'fetch', side_effect=TimeoutError):
            record, leads = run.discover({'name': 'Blocked', 'kind': 'primary', 'pages': ['https://example.org/']})
        self.assertEqual(record['pages'][0]['status'], 'unavailable')
        self.assertEqual(leads, [])



if __name__ == '__main__':
    unittest.main()
