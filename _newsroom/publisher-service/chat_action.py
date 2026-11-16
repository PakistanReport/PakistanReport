"""Publish an approved ChatGPT draft and conversation image as one Git commit."""
import base64
import hashlib
import hmac
import os
import re
from datetime import datetime, timedelta, timezone
from io import BytesIO
from urllib.parse import quote, urlsplit

import httpx
from fastapi import APIRouter, Header, HTTPException
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field
import yaml

router = APIRouter()
REPO = "PakistanReport/PakistanReport"
PKT = timezone(timedelta(hours=5))
MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_PIXELS = 24_000_000
IMAGE_FORMATS = {"PNG", "JPEG", "WEBP"}


class ImageRef(BaseModel):
    download_link: str = Field(max_length=8192)


class Article(BaseModel):
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=100)
    title: str = Field(min_length=1, max_length=180)
    category: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9 &-]{0,59}$")
    description: str = Field(min_length=1, max_length=450)
    body_markdown: str = Field(min_length=1, max_length=70000)
    image_alt: str = Field(min_length=1, max_length=300)
    image_caption: str = Field(default="Pakistan Report AI-generated illustration.", max_length=300)
    openaiFileIdRefs: list[ImageRef] = Field(min_length=1, max_length=1)


def allowed_image_url(url: str) -> bool:
    try:
        target = urlsplit(url)
        host = target.hostname or ""
        port = target.port
    except ValueError:
        return False
    if target.scheme != "https" or target.username or target.password or port not in (None, 443):
        return False
    return bool(re.fullmatch(r"(?:files|sdmntpr[a-z0-9-]*)\.oaiusercontent\.com", host))


async def read_image(client: httpx.AsyncClient, url: str) -> bytes:
    if not allowed_image_url(url):
        raise HTTPException(400, "Use an image file reference supplied by ChatGPT.")
    try:
        async with client.stream("GET", url, follow_redirects=False) as response:
            if response.status_code != 200:
                raise HTTPException(422, "ChatGPT image link could not be read. Select the image again.")
            data = bytearray()
            async for chunk in response.aiter_bytes():
                data.extend(chunk)
                if len(data) > MAX_IMAGE_BYTES:
                    raise HTTPException(413, "Image exceeds 8 MiB.")
    except httpx.RequestError:
        raise HTTPException(502, "Could not download the conversation image.") from None
    try:
        with Image.open(BytesIO(data)) as image:
            if image.format not in IMAGE_FORMATS or image.width * image.height > MAX_PIXELS:
                raise ValueError
            if getattr(image, "n_frames", 1) != 1:
                raise ValueError
            output = BytesIO()
            image.convert("RGBA" if "A" in image.getbands() else "RGB").save(
                output, "WEBP", quality=88, method=4
            )
            return output.getvalue()
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError):
        raise HTTPException(422, "Expected a valid PNG, JPEG, or WebP still image.") from None


def git_blob_sha(data: bytes) -> str:
    return hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest()


def make_post(article: Article, image_path: str, date: datetime, published: bool) -> bytes:
    metadata = {
        "layout": "article",
        "title": article.title,
        "description": article.description,
        "category": article.category,
        "author": "Pakistan Report Editorial Desk",
        "date": date.strftime("%Y-%m-%d %H:%M:%S %z"),
        "published": published,
        "image": "/" + image_path,
        "image_alt": article.image_alt,
        "image_caption": article.image_caption,
    }
    if article.body_markdown.lstrip().startswith("---"):
        raise HTTPException(422, "Send the article body without front matter.")
    return ("---\n" + yaml.safe_dump(metadata, sort_keys=False, allow_unicode=True)
            + "---\n\n" + article.body_markdown.strip() + "\n").encode()


async def commit_article(client: httpx.AsyncClient, article: Article, image: bytes,
                         token: str, branch: str, now: datetime) -> dict:
    prefix = f"https://api.github.com/repos/{REPO}"
    headers = {
        "Authorization": "Bearer " + token,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    async def github(method, path, payload=None, absent=False):
        try:
            response = await client.request(method, prefix + path, headers=headers, json=payload)
        except httpx.RequestError:
            raise HTTPException(502, "GitHub request failed. Check the branch before retrying.") from None
        if response.status_code == 404 and absent:
            return None
        if method == "PATCH" and response.status_code in (409, 422):
            raise HTTPException(409, "GitHub declined the branch update. Check its head and protections.")
        if not response.is_success:
            raise HTTPException(502, f"GitHub request failed ({response.status_code}).")
        return response.json()

    ref = quote(branch, safe="/")
    head = (await github("GET", f"/git/ref/heads/{ref}"))["object"]["sha"]
    stem = f"{now:%Y-%m-%d}-{article.slug}"
    post_path = f"_posts/{stem}.md"
    image_path = f"assets/images/{stem}.webp"
    post_result = {
        "branch": branch,
        "post_path": post_path,
        "image_path": "/" + image_path,
        "published_to_branch": branch == "main",
    }
    # Compare the same branch snapshot used as the proposed commit parent.
    old_post = await github("GET", f"/contents/{post_path}?ref={head}", absent=True)
    old_image = await github("GET", f"/contents/{image_path}?ref={head}", absent=True)
    post = make_post(article, image_path, now, branch == "main")
    if old_post or old_image:
        # Reuse the original timestamp to recognize an identical request after a retry.
        if old_post and old_image and old_image.get("sha") == git_blob_sha(image):
            try:
                original = base64.b64decode(old_post["content"]).decode("utf-8")
                old_date = yaml.safe_load(original.split("---\n", 2)[1])["date"]
                initial_time = datetime.strptime(str(old_date), "%Y-%m-%d %H:%M:%S %z")
                original_post = make_post(article, image_path, initial_time, branch == "main")
            except (KeyError, IndexError, TypeError, ValueError, yaml.YAMLError):
                original_post = b""
            if old_post.get("sha") == git_blob_sha(original_post):
                return {**post_result, "already_present": True}
        raise HTTPException(409, "An article or image with this slug already exists for today.")

    base_tree = (await github("GET", f"/git/commits/{head}"))["tree"]["sha"]
    image_blob = await github("POST", "/git/blobs", {
        "encoding": "base64", "content": base64.b64encode(image).decode(),
    })
    tree = await github("POST", "/git/trees", {
        "base_tree": base_tree,
        "tree": [
            {"path": post_path, "type": "blob", "mode": "100644", "content": post.decode()},
            {"path": image_path, "type": "blob", "mode": "100644", "sha": image_blob["sha"]},
        ],
    })
    commit = await github("POST", "/git/commits", {
        "message": f"Publish {article.slug}", "tree": tree["sha"], "parents": [head],
    })
    await github("PATCH", f"/git/refs/heads/{ref}", {"sha": commit["sha"], "force": False})
    return {**post_result, "commit": f"https://github.com/{REPO}/commit/{commit['sha']}"}


@router.post("/publish-article")
async def publish_article(article: Article, authorization: str = Header(default="")):
    key = os.environ.get("CHAT_PUBLISHER_API_KEY")
    token = os.environ.get("GITHUB_TOKEN")
    branch = os.environ.get("CHAT_PUBLISHER_BRANCH", "chat-publishing-test")
    if not key or not token or branch not in {"chat-publishing-test", "main"}:
        raise HTTPException(503, "Chat publisher is not configured.")
    if not hmac.compare_digest(authorization.encode(), ("Bearer " + key).encode()):
        raise HTTPException(401, "Unauthorized.")
    async with httpx.AsyncClient(timeout=httpx.Timeout(12, connect=4), follow_redirects=False) as client:
        image = await read_image(client, article.openaiFileIdRefs[0].download_link)
        return await commit_article(client, article, image, token, branch, datetime.now(PKT))
