"""Authenticated Pakistan Report image uploader. Deploy as HTTPS service with secrets."""
import base64
import hashlib
import hmac
import os
import re
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
import httpx

app = FastAPI(title="Pakistan Report Publisher", version="1.0.0")
REPOSITORY = os.getenv("REPOSITORY", "PakistanReport/PakistanReport")
MAX_BYTES = 8 * 1024 * 1024

class UploadImage(BaseModel):
    branch: str = Field(min_length=1, max_length=120)
    filename: str = Field(pattern=r"^[a-z0-9][a-z0-9-]*\.webp$")
    image_base64: str
    sha256: str | None = None

@app.post("/upload-image")
async def upload_image(request: UploadImage, authorization: str | None = Header(default=None)):
    key = os.getenv("PUBLISHER_API_KEY")
    token = os.getenv("GITHUB_TOKEN")
    if not key or not token:
        raise HTTPException(503, "Service credentials are not configured")
    if not authorization or not hmac.compare_digest(authorization, "Bearer " + key):
        raise HTTPException(401, "Unauthorized")
    branch = request.branch
    if branch in ("main", "master") or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._/-]*", branch) or ".." in branch or "//" in branch:
        raise HTTPException(400, "Uploads require a valid editorial branch, not main")
    try:
        image = base64.b64decode(request.image_base64, validate=True)
    except Exception:
        raise HTTPException(400, "Invalid base64 image")
    if not 30 <= len(image) <= MAX_BYTES or image[:4] != b"RIFF" or image[8:12] != b"WEBP":
        raise HTTPException(400, "Expected a valid-sized WebP container")
    digest = hashlib.sha256(image).hexdigest()
    if request.sha256 and not hmac.compare_digest(digest, request.sha256.lower()):
        raise HTTPException(400, "SHA-256 mismatch")
    path = "assets/images/" + request.filename
    url = f"https://api.github.com/repos/{REPOSITORY}/contents/{path}"
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    async with httpx.AsyncClient(timeout=40) as client:
        existing = await client.get(url, headers=headers, params={"ref": branch})
        if existing.status_code not in (200, 404):
            raise HTTPException(502, "Unable to check destination branch/path")
        if existing.status_code == 200:
            raise HTTPException(409, "Image already exists; refusing to overwrite")
        response = await client.put(url, headers=headers, json={
            "message": f"Add approved editorial image {request.filename}",
            "content": request.image_base64,
            "branch": branch,
        })
    if response.status_code != 201:
        raise HTTPException(502, "GitHub rejected image commit")
    result = response.json()
    return {"path": path, "branch": branch, "sha256": digest, "commit_sha": result["commit"]["sha"], "bytes": len(image)}
