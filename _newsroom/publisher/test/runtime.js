import { Miniflare } from "miniflare";
import { build } from "esbuild";
import { FakeGitHub } from "./helpers.js";
export async function runtime() {
  const bundle = await build({
    entryPoints: ["src/worker.js"],
    bundle: true,
    format: "esm",
    write: false,
    platform: "browser",
  });
  const gh = new FakeGitHub();
  const mf = new Miniflare({
    modules: true,
    script: bundle.outputFiles[0].text,
    compatibilityDate: "2026-09-12",
    durableObjects: { PUBLISHER: { className: "Publisher", useSQLite: true } },
    bindings: {
      GITHUB_TOKEN: "simulated-server-secret",
      PUBLISHER_PASSWORD: "local-test-password-not-production-123456789",
    },
    outboundService: async (request) => {
      try {
        const r = await gh.fetch(request.url, {
          method: request.method,
          body: request.method === "GET" ? undefined : await request.text(),
        });
        return r;
      } catch (e) {
        console.error("Fake GitHub adapter:", e.message);
        throw e;
      }
    },
  });
  await mf.ready;
  return { mf, gh };
}
