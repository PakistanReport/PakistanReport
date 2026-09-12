import { Miniflare } from "miniflare";
import { build } from "esbuild";
import {
  sources,
  important,
  economyDocument,
  economyDraft,
} from "./fixtures/events.js";
import { randomBytes } from "node:crypto";
export const PASSWORD = randomBytes(36).toString("base64url");
export async function runtime() {
  const built = await build({
    entryPoints: ["src/worker.js"],
    bundle: true,
    format: "esm",
    platform: "browser",
    write: false,
  });
  const calls = [];
  let modelCalls = 0;
  const mf = new Miniflare({
    modules: true,
    script: built.outputFiles[0].text,
    compatibilityDate: "2026-09-12",
    durableObjects: { NEWSROOM: { className: "Newsroom", useSQLite: true } },
    bindings: {
      NEWSROOM_PASSWORD: PASSWORD,
      MONITOR_ENABLED: "false",
      DRAFT_PROVIDER: "openai-compatible",
      MODEL_ENDPOINT: "https://model.example/v1/chat/completions",
      MODEL_ALLOWED_HOSTS: "model.example",
      MODEL_API_KEY: "fake-local-model-secret",
      MODEL_NAME: "fixture",
      MODEL_REQUESTS_PER_DAY: "10",
    },
    outboundService: async (request) => {
      calls.push({ method: request.method, url: request.url });
      const u = new URL(request.url);
      if (u.hostname === "model.example") {
        modelCalls++;
        const payload = await request.json();
        const c = JSON.parse(payload.messages[1].content);
        return Response.json({
          choices: [{ message: { content: JSON.stringify(economyDraft(c)) } }],
        });
      }
      if (u.hostname === "api.github.com") {
        if (request.method !== "GET") throw Error("PUBLIC WRITE ATTEMPT");
        return Response.json({
          sha: "fixture-coverage",
          tree: [],
          truncated: false,
        });
      }
      if (u.pathname === "/robots.txt")
        return new Response("User-agent: *\nAllow: /");
      if (u.hostname === "sbp.example" && u.pathname === "/policy-decision")
        return new Response(
          "<html><body><main>" + economyDocument + "</main></body></html>",
          { headers: { "Content-Type": "text/html" } },
        );
      throw Error("Unapproved test network request " + request.url);
    },
  });
  await mf.ready;
  const origin = "https://newsroom.example";
  const call = (path, body, headers = {}) =>
    mf.dispatchFetch(origin + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: "Basic " + btoa("editor:" + PASSWORD),
        Origin: origin,
        "X-Newsroom-Action": "1",
        "Content-Type":
          body instanceof Uint8Array ? "image/png" : "application/json",
        ...headers,
      },
      body:
        body === undefined
          ? undefined
          : body instanceof Uint8Array
            ? body
            : JSON.stringify(body),
    });
  return { mf, calls, call, modelCalls: () => modelCalls };
}
export async function seed(call) {
  await call("/api/sources", sources[0]);
  await call("/api/coverage/refresh", {});
  const response = await call("/api/ingest", {
    sourceId: sources[0].id,
    items: [
      {
        ...important,
        publishedAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ],
  });
  if (!response.ok) throw Error(await response.text());
  return (await response.json())[0].id;
}
