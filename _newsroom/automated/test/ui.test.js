import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { parseHTML } from "linkedom";
import { HTML, JS } from "../src/ui.js";
import { harness, completeVisual } from "./helpers.js";
import { important } from "./fixtures/events.js";
test("private Review Queue DOM renders evidence, checks and human approval controls", async () => {
  const s = harness();
  const [{ id }] = await s.ingest("sbp-fixture", [important]);
  await completeVisual(s, await s.process(id));
  const c = s.get(id);
  const { document } = parseHTML(HTML);
  const context = vm.createContext({
    document,
    console,
    Intl,
    Date,
    JSON,
    URL,
    File,
    TextEncoder,
    Uint8Array,
    structuredClone,
    setTimeout,
    clearTimeout,
    btoa,
    atob,
    confirm: () => false,
    prompt: () => null,
    fetch: async (path) => {
      if (path === "/api/status")
        return Response.json({ monitoring: false, draftProvider: "disabled" });
      if (path === "/api/sources") return Response.json(s.sources());
      if (path === "/api/candidates")
        return Response.json([
          {
            id,
            state: c.state,
            revision: c.revision,
            title: c.draft.headline,
            category: c.draft.category,
            risk: c.checks.risk.level,
            score: c.selection.score,
            simulation: true,
          },
        ]);
      if (path === "/api/candidates/" + id) return Response.json(s.get(id));
      throw Error("Unexpected UI fetch " + path);
    },
  });
  vm.runInContext(JS, context);
  await new Promise((r) => setTimeout(r, 30));
  const card = document.querySelector(".card");
  assert(card);
  card.click();
  await new Promise((r) => setTimeout(r, 30));
  assert(
    document.querySelector("#detail").textContent.includes("Source evidence"),
  );
  assert(
    document.querySelector("#detail").textContent.includes("Ready for Review"),
  );
  assert(document.querySelectorAll("input[type=checkbox]").length >= 10);
  const approve = [...document.querySelectorAll("button")].find(
    (b) => b.textContent === "Approve for Publisher package",
  );
  assert(approve && !approve.disabled);
  assert(
    !document.querySelector("#detail").textContent.includes("Publish Now"),
  );
  assert(
    !document.querySelector("#message").className.includes("error"),
    document.querySelector("#message").textContent,
  );
});
