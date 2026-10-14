# Pakistan Report image upload service — prototype

Authenticated POST /upload-image accepts a base64-encoded WebP and commits it to assets/images/ on an editorial branch. It rejects main/master and existing files.

Run with Python FastAPI, httpx, uvicorn. Set PUBLISHER_API_KEY and GITHUB_TOKEN as **private server environment variables**. The GitHub token needs Contents read/write on PakistanReport/PakistanReport. Never commit credentials.

POST JSON: {"branch":"editorial-international-bonds-20261014","filename":"pakistan-international-bonds.webp","image_base64":"<base64 WebP>","sha256":"<optional digest>"}

This is **not** yet a connected ChatGPT plugin. It must be hosted over HTTPS, connected as a ChatGPT-compatible tool with attachment-byte handoff, and secured/tested before production use. ChatGPT's currently installed GitHub connector cannot transfer the attached image bytes to this endpoint. Do not merge or deploy without security review, rate limiting and tests.
