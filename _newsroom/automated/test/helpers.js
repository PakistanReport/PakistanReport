import { DatabaseSync } from "node:sqlite";
import { Service } from "../src/service.js";
import { NOW, sources, documents, fixtureProvider } from "./fixtures/events.js";
import { template } from "../../publisher/src/template.js";
import { unzipSync } from "fflate";
export function storage() {
  const db = new DatabaseSync(":memory:");
  return {
    sql: {
      exec(q, ...a) {
        return db.prepare(q).all(...a);
      },
    },
    transactionSync(fn) {
      db.exec("BEGIN");
      try {
        const value = fn();
        db.exec("COMMIT");
        return value;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
}
export function harness(overrides = {}) {
  const db = storage();
  const s = new Service(db, {
    sources,
    now: () => NOW,
    provider: fixtureProvider,
    client: {
      document: async (obs) => {
        if (!documents[obs.url]) throw Error("Fixture evidence unavailable");
        return {
          text: documents[obs.url],
          method: "fixture-primary",
          retrievedAt: new Date(NOW).toISOString(),
        };
      },
    },
    ...overrides,
  });
  s.setSetting("coverageMeta", {
    at: NOW,
    method: "empty fixture index",
    count: 0,
  });
  return s;
}
export const image = () =>
  Object.entries(unzipSync(template(NOW))).find(([key]) =>
    key.endsWith(".png"),
  )[1];
export const visualMetadata = {
  kind: "illustration",
  caption: "Pakistan Report illustration.",
  alt: "Clearly illustrative synthetic green graphic used only for workflow testing.",
  reviewed: true,
  extension: "png",
};
export async function completeVisual(s, c) {
  return s.visual(c.id, c.revision, image(), visualMetadata);
}
export function approve(s, c, note = "") {
  return s.approve(c.id, c.revision, {
    claimIds: c.draft.claims.map((x) => x.id),
    reviewedArticle: true,
    reviewedVisual: true,
    sensitiveNote: note,
  });
}
