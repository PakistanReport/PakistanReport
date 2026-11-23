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

    def test_verified_brief_public_feed_excludes_evidence(self):
        url = 'https://example.org/report'
        brief = 'Officials have approved a new local transport project in Pakistan following a review of its funding. Construction will begin after the remaining contracts have been awarded.'
        event = {'event_id': 'transport-project', 'text': brief, 'category': 'Policy',
                 'material_change': True, 'sources': [{'url': url, 'quote': 'approved a new local transport project'}]}
        replies = iter([{'urls': [url]}, {'events': [event]}, {'approved': True}])
        with tempfile.TemporaryDirectory() as folder:
            with patch.dict(run.os.environ, {'TICKER_OUTPUT': folder}), \
                    patch.object(run, 'discover', return_value=({'name':'Example'}, [{'url':url}])), \
                    patch.object(run, 'inspect', return_value={'url':url,'text':'Officials approved a new local transport project today.'}), \
                    patch.object(run, 'model', side_effect=lambda *_: next(replies)), \
                    patch.object(run.ROOT.__class__, 'read_text', autospec=True) as read:
                read.side_effect = lambda path, *a, **k: json.dumps([{'name':'Example'}]) if path.name == 'sources.json' else json.dumps({'paused':False,'hidden_event_ids':[],'pinned_event_ids':[]})
                run.main()
            public = json.loads((Path(folder)/'ticker.json').read_text())
            self.assertEqual(public['items'][0]['text'], brief)
            self.assertNotIn('sources', public['items'][0])


if __name__ == '__main__':
    unittest.main()
