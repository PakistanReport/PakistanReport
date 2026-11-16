# Deploy the regular Chat publisher

This is a separate Worker named `pakistan-report-chat-publisher`. The existing publisher and the website keep their current Cloudflare deployments. The default destination is the GitHub branch `chat-publishing-test`.

## Cloudflare setup

Use Wrangler from a terminal with Node.js and access to your Cloudflare account. From a clone of PakistanReport/PakistanReport on the `chat-publishing-test` branch:

```bash
cd _newsroom/publisher-service
npx wrangler login
npx wrangler deploy --config chat-worker.wrangler.toml
npx wrangler secret put GITHUB_TOKEN --config chat-worker.wrangler.toml
npx wrangler secret put CHAT_PUBLISHER_API_KEY --config chat-worker.wrangler.toml
```

Use a GitHub fine-grained credential with Contents read/write scoped to `PakistanReport/PakistanReport`. For CHAT_PUBLISHER_API_KEY, use a different random secret of at least 32 characters and save it in your password manager. Enter each value at Wrangler's prompt. The publish route fails closed until both secrets are configured.

You can also create a standalone Worker named `pakistan-report-chat-publisher` in the Cloudflare dashboard, paste the entire `chat-worker.mjs` file into its editor, and deploy. Under **Settings → Variables and Secrets**, add the same two values as **Secrets**. Open `/health` on the deployed Worker URL and check for `{"ok":true}`. This verifies the Worker is reachable.

## Regular ChatGPT setup

1. Open the GPT editor. Create a GPT named **Pakistan Report** with sharing set to **Only me** and **Image generation** enabled.
2. Add an Action. Paste `chat-action.openapi.yaml` into the schema editor, replacing the example server URL with the actual Worker origin. Select **API Key → Bearer** authentication and enter the same value as CHAT_PUBLISHER_API_KEY.
3. Add the following to the GPT instructions.

> Help me draft Pakistan Report articles and generate clearly labeled editorial illustrations. Only call publishPakistanReportArticle when I explicitly ask to publish the final article and its selected image. Pass the exact final article body, an existing Pakistan Report category, and the selected image's real conversation file reference in openaiFileIdRefs. Stop if the image reference is unavailable or ambiguous. Report the returned GitHub commit and destination branch. A test-branch commit is a test. Verify the public article and its image before saying a production article is live.

## Test and go live

Generate a fresh sample image in the private GPT, draft a short sample article using category Business, then tell it to publish both. Open the returned commit: on `chat-publishing-test`, it should contain one unpublished file under `_posts/` and the corresponding image under `assets/images/`. Check that the article references the exact image path and that GitHub renders the same image.

After that test passes, set the plain-text Worker variable `CHAT_PUBLISHER_BRANCH` to `main` and deploy that setting. If you manage deployment with Wrangler, change the value in `chat-worker.wrangler.toml` before deploying again. For the first real article, verify the commit and then open the public article and image on pakistanreport.pk after the normal Cloudflare build.
