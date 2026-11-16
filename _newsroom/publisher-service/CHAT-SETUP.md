# Publish from regular ChatGPT

Run this from `_newsroom/publisher-service` on an HTTPS host. This entry point also serves the existing image-upload endpoint.

```bash
python -m pip install -r chat-requirements.txt
uvicorn chat_app:app --host 0.0.0.0 --port "${PORT:-8000}"
```

Set these in the host's secret/configuration settings.

| Setting | Value |
| --- | --- |
| GITHUB_TOKEN | Fine-grained credential scoped to Contents read/write on PakistanReport/PakistanReport |
| CHAT_PUBLISHER_API_KEY | A high-entropy secret used only for this action |
| CHAT_PUBLISHER_BRANCH | chat-publishing-test for verification, or main after verification |

In ChatGPT, create a private Pakistan Report GPT and enable image generation. Add an Action and paste `chat-action.openapi.yaml` after replacing the example server with the deployed HTTPS origin. Set Action authentication to API Key, Bearer, and enter the value of CHAT_PUBLISHER_API_KEY in the authentication dialog.

Use these instructions for the GPT:

> Help me draft Pakistan Report articles and generate clearly labeled editorial illustrations. Only call publishPakistanReportArticle when I explicitly ask to publish the final article and its selected image. Pass the exact final article body and the selected image's real conversation file reference in openaiFileIdRefs. If the image reference is unavailable or ambiguous, stop and tell me. Report the returned commit and branch. Say the article is live only after verifying the public article URL and that its image loads.

Test by generating a fresh image in that GPT and publishing a sample article. Confirm GitHub returns a single commit on `chat-publishing-test` containing both files, and compare the image with the one in Chat. The test branch marks the post unpublished. Then change CHAT_PUBLISHER_BRANCH to main for editorial use and check the deployed article and image after the first real publication.

The server accepts ChatGPT file download links on the documented OpenAI file domain and on its asset subdomains. It does not follow redirects. GitHub paths are derived from the slug and Pakistan publication date. A batch with occupied paths is rejected unless both files match the original publication.
