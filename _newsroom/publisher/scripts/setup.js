// Run on your own computer. Secrets go directly to Wrangler stdin, never to disk or Git.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
const publisherDir = fileURLToPath(new URL("..", import.meta.url));
function run(args, input) {
  const r = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["wrangler", ...args],
    {
      cwd: publisherDir,
      stdio: input === undefined ? "inherit" : ["pipe", "inherit", "inherit"],
      input,
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    },
  );
  if (r.status !== 0) process.exit(r.status || 1);
}
async function secret(prompt) {
  if (!process.stdin.isTTY)
    throw Error("Use an interactive terminal for secure token entry");
  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  let value = "";
  return new Promise((resolve) => {
    const listener = (chunk) => {
      for (const c of chunk.toString()) {
        if (c === "\u0003") {
          process.stdin.setRawMode(false);
          process.exit(1);
        }
        if (c === "\r" || c === "\n") {
          process.stdin.off("data", listener);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (c === "\u007f") {
          value = value.slice(0, -1);
        } else value += c;
      }
    };
    process.stdin.on("data", listener);
  });
}
console.log(
  "Deploys only the separate pakistan-report-publisher Worker. Keep your Cloudflare account on Workers Free. Does not deploy or modify the public news Worker.",
);
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const answer = await new Promise((r) =>
  rl.question("Confirm this account uses Workers Free (type FREE): ", r),
);
rl.close();
if (answer !== "FREE") process.exit(1);
run(["login"]);
run(["whoami"]);
const token = await secret(
  "Paste a fine-grained GitHub token for PakistanReport/PakistanReport, Contents read/write only (hidden): ",
);
if (!token.trim()) throw Error("Token required");
const password = randomBytes(36).toString("base64url");
// Deployed worker denies every request until secrets are configured.
run(["deploy"]);
run(
  ["secret", "bulk"],
  JSON.stringify({ GITHUB_TOKEN: token.trim(), PUBLISHER_PASSWORD: password }),
);
console.log("\nSave this Publisher sign-in in your password manager now.");
console.log("Username: publisher\nPassword: " + password);
console.log(
  "Open the pakistan-report-publisher workers.dev URL printed above. The public pakistanreport Worker is unchanged.",
);
