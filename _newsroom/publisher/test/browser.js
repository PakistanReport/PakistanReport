import { runtime } from "./runtime.js";
import { fixture } from "./helpers.js";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
const { mf, gh } = await runtime();
let browser;
try {
  await mkdir("test-output", { recursive: true });
  const origin = (await mf.ready).origin;
  browser = await chromium.launch({ headless: true,
    executablePath: process.env.PUBLISHER_CHROMIUM_EXECUTABLE, args: ["--no-sandbox"] });
  const context = await browser.newContext({
    httpCredentials: {
      username: "publisher",
      password: "local-test-password-not-production-123456789",
    },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin);
  await page.getByText("No batches yet.").waitFor();
  const f = fixture(125000);
  await page
    .locator("#zip")
    .setInputFiles({
      name: "two-story-test.zip",
      mimeType: "application/zip",
      buffer: Buffer.from(f.zip()),
    });
  await page.getByRole("button", { name: "Upload & Validate" }).click();
  await page.getByRole("button", { name: "Approve & Schedule" }).waitFor();
  await page.screenshot({ path: "test-output/review.png", fullPage: true });
  await page.getByRole("button", { name: "Approve & Schedule" }).click();
  await page.locator(".badge.Scheduled").first().waitFor();
  page.on("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Publish Now", exact: true })
    .first()
    .click();
  for (let i = 0; i < 30; i++) {
    await page.getByRole("button", { name: "Refresh status" }).click();
    if ((await page.locator(".badge.Published").count()) === 1) break;
    await page.waitForTimeout(300);
  }
  if ((await page.locator(".badge.Published").count()) !== 1)
    throw Error("Publish Now did not finish");
  console.log(
    "Browser upload, review, approval and Publish Now passed. Waiting for the second real local alarm (about two minutes).",
  );
  await page.screenshot({ path: "test-output/scheduled.png", fullPage: true });
  await writeFile(
    "test-output/browser-progress.json",
    JSON.stringify({ status: "waiting for scheduled item", origin }),
  );
  const deadline = Date.now() + 140000;
  while (Date.now() < deadline) {
    await page.waitForTimeout(2000);
    await page.getByRole("button", { name: "Refresh status" }).click();
    if ((await page.locator(".badge.Published").count()) === 2) break;
  }
  if ((await page.locator(".badge.Published").count()) !== 2)
    throw Error("Scheduled article did not publish");
  if (gh.updates !== 2) throw Error("Unexpected duplicate commits");
  const imgs = await page
    .locator(".story img")
    .evaluateAll((nodes) => nodes.map((n) => n.complete && n.naturalWidth > 0));
  if (imgs.some((x) => !x)) throw Error("Broken preview image");
  await page.screenshot({ path: "test-output/published.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-output/mobile.png", fullPage: true });
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "PASS: two disposable stories Published via automatic workerd alarms; exactly two atomic simulated GitHub commits; images render; desktop/mobile review; no browser JavaScript errors.",
  );
} finally {
  await browser?.close();
  await mf.dispose();
}
