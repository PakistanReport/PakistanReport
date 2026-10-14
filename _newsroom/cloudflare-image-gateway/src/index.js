// Pakistan Report image transfer gateway (Cloudflare Worker).
// Required secrets: GITHUB_TOKEN, UPLOAD_API_KEY. Never expose either to clients.
// Deploy separately and connect to a ChatGPT tool capable of sending file bytes.
const UPLOAD_HTML = "<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<title>Pakistan Report | Hero Image Upload</title>\n<style>\n:root{font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#172b29;background:#f2f6f4}*{box-sizing:border-box}\nbody{margin:0;padding:28px 14px}.wrap{max-width:650px;margin:30px auto;background:white;border:1px solid #dbe6e0;border-radius:18px;box-shadow:0 14px 40px #12372b12;overflow:hidden}\nheader{background:#075d44;color:white;padding:27px 30px}header h1{margin:0 0 8px;font-size:1.55rem}header p{margin:0;color:#e3f4ee;font-size:.95rem}\nmain{padding:28px 30px}label{display:block;font-weight:650;margin:17px 0 7px}input{display:block;width:100%;padding:12px;border:1px solid #a7bcb3;border-radius:9px;font:inherit;background:white}\ninput:focus{outline:3px solid #b9e6d6;border-color:#08795b}small{display:block;color:#536c63;margin-top:6px}\nbutton{margin-top:23px;background:#086747;color:white;border:0;border-radius:10px;padding:13px 18px;font:inherit;font-weight:700;width:100%;cursor:pointer}\nbutton:disabled{opacity:.6;cursor:wait}.status{margin-top:18px;padding:12px;border-radius:9px;background:#f1f6f4;white-space:pre-wrap;overflow-wrap:anywhere}.status[hidden]{display:none}\nfooter{padding:17px 30px;background:#f6faf8;color:#526b61;font-size:.85rem}a{color:#08765a}\n</style></head><body><div class=\"wrap\"><header><h1>Pakistan Report — Image Upload</h1><p>Upload an approved WebP hero image to its editorial GitHub branch.</p></header>\n<main><form id=\"upload\">\n<label for=\"key\">Upload access key</label><input id=\"key\" type=\"password\" autocomplete=\"off\" required placeholder=\"Enter your private upload key\"><small>Used only for this request; never saved by this page.</small>\n<label for=\"branch\">Editorial branch</label><input id=\"branch\" required pattern=\"editorial-[a-z0-9][a-z0-9._/-]*\" value=\"editorial-international-bonds-20261014\">\n<label for=\"filename\">Image filename</label><input id=\"filename\" required pattern=\"[a-z0-9][a-z0-9-]*\\.webp\" value=\"pakistan-international-bonds.webp\"><small>Destination: assets/images/&lt;filename&gt;</small>\n<label for=\"image\">Approved WebP image</label><input id=\"image\" type=\"file\" accept=\".webp,image/webp\" required><small>WebP only, maximum 8 MB. Existing files will not be overwritten.</small>\n<button id=\"send\" type=\"submit\">Upload image to GitHub</button></form><div id=\"status\" class=\"status\" role=\"status\" aria-live=\"polite\" hidden></div></main>\n<footer>Image upload only. The article remains unpublished until editorial checks and publishing are completed.</footer></div>\n<script>\nconst form=document.getElementById('upload'),status=document.getElementById('status'),button=document.getElementById('send');\nform.addEventListener('submit',async e=>{\ne.preventDefault();const image=document.getElementById('image').files[0];\nif(!image||image.size>8*1024*1024){status.hidden=false;status.textContent='Choose a WebP image smaller than 8 MB.';return;}\nbutton.disabled=true;status.hidden=false;status.textContent='Uploading image to GitHub…';\nconst data=new FormData();data.append('image',image);data.append('branch',document.getElementById('branch').value.trim());data.append('filename',document.getElementById('filename').value.trim());\ntry{const response=await fetch('/upload-image',{method:'POST',headers:{Authorization:'Bearer '+document.getElementById('key').value},body:data});const result=await response.json();\nif(!response.ok)throw new Error(result.error||'Upload failed');\nstatus.textContent='Image uploaded successfully!\\nGitHub path: '+result.path+'\\nBranch: '+result.branch+'\\nCommit: '+result.commit_sha+'\\n\\nThe article is not published yet.';\ndocument.getElementById('key').value='';\n}catch(err){status.textContent='Upload failed: '+err.message;}finally{button.disabled=false;}\n});\n</script></body></html>";
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
    const url = new URL(request.url);
    if ((url.pathname === "/" || url.pathname === "/upload") && request.method === "GET") return new Response(UPLOAD_HTML, {headers: {"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer","content-security-policy":"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"}});
    if (url.pathname !== "/upload-image" || request.method !== "POST") return json({error: "Not found"}, 404);
    if (request.headers.get("origin") && request.headers.get("origin") !== url.origin) return json({error: "Invalid origin"}, 403);
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
