# Pakistan Report Cloudflare image gateway

This is an **un-deployed prototype**, committed to the bridge feature branch. It requires a separate Cloudflare account and an attachment-capable ChatGPT custom tool. It does **not** use Supabase or Wonder and Whim.

## Deploy

1. Review security and code; add rate limiting and integration tests before public deployment.
2. In a Cloudflare account, deploy this Worker using Wrangler from this folder.
3. Configure Worker secrets with `wrangler secret put GITHUB_TOKEN` (fine-grained token, Contents read/write only for PakistanReport/PakistanReport) and `wrangler secret put UPLOAD_API_KEY` (long random value).
4. Configure a ChatGPT-compatible custom integration with a file-capable upload action. It must send `multipart/form-data` to `POST /upload-image` with `image` (WebP file), `branch` (existing editorial branch) and `filename` (lowercase slug .webp), authenticated by the API key. Connecting custom integrations requires user/platform authorization.

The Worker rejects non-editorial branches and overwrites, and checks the RIFF/WEBP container signature. These checks are **not** a full image decoder. The Worker does not publish to main.

**Current blocker:** The ChatGPT GitHub connector available in this conversation cannot send an attached image as multipart data, and no Cloudflare deployment connector is available. The Worker cannot be deployed or connected by merely committing this code.
