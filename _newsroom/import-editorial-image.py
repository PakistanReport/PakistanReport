#!/usr/bin/env python3
"""Import an approved GitHub-hosted WebP into an existing editorial branch.

Run in the repository root. Intended for GitHub Actions with env inputs.
Never publishes or modifies an article, and never writes to main.
"""
import hashlib
import os
from pathlib import Path
import re
import urllib.parse
import urllib.request

MAX_BYTES = 8 * 1024 * 1024
ROOT = Path.cwd().resolve()


def repository_path(value, prefix, suffix):
    if not value or value.startswith("/") or "\\" in value:
        raise ValueError("Invalid repository path")
    path = Path(value)
    if ".." in path.parts or not value.startswith(prefix) or not value.endswith(suffix):
        raise ValueError(f"Expected path under {prefix} ending in {suffix}")
    resolved = (ROOT / path).resolve()
    if not resolved.is_relative_to(ROOT):
        raise ValueError("Path escapes repository")
    return resolved


def allowed_url(value):
    url = urllib.parse.urlparse(value)
    host = (url.hostname or "").lower()
    if url.scheme != "https" or url.username or url.password or url.port not in (None, 443):
        return False
    return host == "github.com" or host.endswith(".githubusercontent.com")


class SafeRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not allowed_url(newurl):
            raise ValueError("Image redirect outside approved GitHub hosts")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def main():
    post_path = repository_path(os.environ["POST_PATH"], "_posts/", ".md")
    image_path = repository_path(os.environ["IMAGE_PATH"], "assets/images/", ".webp")
    url = os.environ["IMAGE_URL"]
    if not allowed_url(url):
        raise ValueError("Image must be hosted on HTTPS GitHub attachment URLs")
    if not post_path.is_file():
        raise ValueError("Article does not exist on this branch")

    article = post_path.read_text(encoding="utf-8")
    expected_reference = "/" + image_path.relative_to(ROOT).as_posix()
    if not re.search(r"(?m)^image:\\s*['\\\"]?" + re.escape(expected_reference) + r"['\\\"]?\\s*$", article):
        raise ValueError("Article image front matter does not match destination")

    opener = urllib.request.build_opener(SafeRedirects)
    request = urllib.request.Request(url, headers={"User-Agent": "PakistanReport-editorial-image-import/1.0"})
    with opener.open(request, timeout=30) as response:
        payload = response.read(MAX_BYTES + 1)
    if len(payload) > MAX_BYTES or len(payload) < 30:
        raise ValueError("Image is empty or exceeds 8 MiB")
    if payload[:4] != b"RIFF" or payload[8:12] != b"WEBP":
        raise ValueError("Image is not a WebP file")
    digest = hashlib.sha256(payload).hexdigest()
    expected_sha = os.environ.get("EXPECTED_SHA256", "").strip().lower()
    if expected_sha and digest != expected_sha:
        raise ValueError("Image SHA-256 mismatch")
    image_path.parent.mkdir(parents=True, exist_ok=True)
    image_path.write_bytes(payload)
    print(f"Validated WebP: {len(payload)} bytes; SHA-256 {digest}; {expected_reference}")


if __name__ == "__main__":
    main()
