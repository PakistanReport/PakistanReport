import { test } from "node:test";
import assert from "node:assert/strict";
import { runtime } from "./runtime.js";
import { fixture } from "./helpers.js";
test(
  "actual workerd HTTP upload and automatic alarm publication",
  { timeout: process.env.LONG_ALARM_TEST ? 180000 : 30000 },
  async () => {
    const { mf, gh } = await runtime();
    try {
      const headers = {
        Authorization:
          "Basic " +
          btoa("publisher:local-test-password-not-production-123456789"),
        Origin: "https://publisher.example",
        "X-Publisher-Action": "1",
      };
      const call = (path, body) =>
        mf.dispatchFetch("https://publisher.example" + path, {
          method: body === undefined ? "GET" : "POST",
          headers: {
            ...headers,
            "Content-Type":
              body instanceof Uint8Array
                ? "application/zip"
                : "application/json",
          },
          body:
            body === undefined
              ? undefined
              : body instanceof Uint8Array
                ? body
                : JSON.stringify(body),
        });
      const upload = await call(
        "/api/batches",
        fixture(process.env.LONG_ALARM_TEST ? 125000 : 3000).zip(),
      );
      assert.equal(upload.status, 201, await upload.clone().text());
      const b = await upload.json();
      assert.equal(
        (await call("/api/batches/" + b.id + "/approve", {})).status,
        200,
      );
      let list;
      for (let i = 0; i < (process.env.LONG_ALARM_TEST ? 750 : 50); i++) {
        list = await (await call("/api/batches")).json();
        if (list[0].items.every((j) => j.status === "Published")) break;
        await new Promise((r) => setTimeout(r, 200));
      }
      assert(
        list[0].items.every((j) => j.status === "Published"),
        JSON.stringify(list),
      );
      assert.equal(gh.updates, 2);
      assert.equal(
        (await call("/api/items/" + list[0].items[0].id + "/image")).status,
        200,
      );
      assert.equal(
        (await mf.dispatchFetch("https://publisher.example/api/batches"))
          .status,
        401,
      );
    } finally {
      await mf.dispose();
    }
  },
);
