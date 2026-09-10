#!/usr/bin/env bash
# Build only. Never deploys, updates refs, or invokes Wrangler.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v ruby >/dev/null || { echo 'BLOCKED: Ruby is unavailable.' >&2; exit 2; }
command -v bundle >/dev/null || { echo 'BLOCKED: Bundler is unavailable.' >&2; exit 2; }
bundle check
JEKYLL_ENV=production bundle exec jekyll build
python3 _newsroom/check-built-output.py
