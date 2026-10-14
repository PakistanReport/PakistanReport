// Pakistan Report image transfer gateway (Cloudflare Worker).
// Required secrets: GITHUB_TOKEN, UPLOAD_API_KEY. Never expose either to clients.
// Deploy separately and connect to a ChatGPT tool capable of sending file bytes.
const MAX_BYTES = 8 * 1024 * 1024;
const repo = "PakistanReport/PakistanReport";
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {status, headers: {"content-type": "application/json", "cache-control": "no-store"}});
}
function b64(bytes) {
  let result = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    result += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(result);
}
export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname !== "/upload-image" || request.method !== "POST") return json({error: "Not found"}, 404);
    if (!env.UPLOAD_API_KEY || !env.GITHUB_TOKEN) return json({error: "Not configured"}, 503);
    const expected = "Bearer " + env.UPLOAD_API_KEY;
    if (request.headers.get("authorization") !== expected) return json({error: "Unauthorized"}, 401);
    if (Number(request.headers.get("content-length")) > MAX_BYTES + 100000) return json({error: "Too large"}, 413);
    const type = request.headers.get("content-type") || "";
    if (!type.startsWith("multipart/form-data")) return json({error: "multipart/form-data required"}, 415);
    let form;
    try { form = await request.formData(); } catch { return json({error: "Invalid multipart form"}, 400); }
    const file = form.get("image");
    const branch = String(form.get("branch") || "");
    const filename = String(form.get("filename") || "");
    if (!(file instanceof File)) return json({error: "Missing image file"}, 400);
    if (!/^editorial-[a-z0-9][a-z0-9._/-]*$/.test(branch) || branch.includes("..") || branch.includes("//")) return json({error: "Invalid editorial branch"}, 400);
    if (!/^[a-z0-9][a-z0-9-]*\.webp$/.test(filename)) return json({error: "Invalid WebP filename"}, 400);
    if (file.size < 30 || file.size > MAX_BYTES) return json({error: "Invalid image size"}, 413);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (new TextDecoder().decode(bytes.subarray(0, 4)) !== "RIFF" || new TextDecoder().decode(bytes.subarray(8, 12)) !== "WEBP") return json({error: "Invalid WebP header"}, 400);
    const path = "assets/images/" + filename;
    const endpoint = "https://api.github.com/repos/" + repo + "/contents/" + path;
    const headers = {"Authorization": "Bearer " + env.GITHUB_TOKEN, "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "pakistan-report-publisher"};
    const exists = await fetch(endpoint + "?ref=" + encodeURIComponent(branch), {headers});
    if (exists.status === 200) return json({error: "File exists; refusing overwrite"}, 409);
    if (exists.status !== 404) return json({error: "GitHub branch or file lookup failed"}, 502);
    const put = await fetch(endpoint, {method: "PUT", headers: {...headers, "Content-Type": "application/json"}, body: JSON.stringify({message: "Add approved image " + filename, content: b64(bytes), branch})});
    if (put.status !== 201) return json({error: "GitHub upload failed"}, 502);
    const result = await put.json();
    return json({path, branch, bytes: bytes.length, commit_sha: result.commit.sha}, 201);
  }
};
