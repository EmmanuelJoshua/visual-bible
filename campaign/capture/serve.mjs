// Minimal static server for the Next export (python's http.server drops
// connections under the diorama's request burst). Usage: node serve.mjs <dir> <port>
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "../out");
const port = Number(process.argv[3] ?? 4318);
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".txt": "text/plain", ".png": "image/png",
  ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".glb": "model/gltf-binary",
  ".bin": "application/octet-stream", ".woff2": "font/woff2", ".ktx2": "image/ktx2", ".wasm": "application/wasm",
};

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = path.join(root, p);
  if (!file.startsWith(root)) return res.writeHead(403).end();
  try {
    if (fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  } catch {
    if (fs.existsSync(file + ".html")) file += ".html";
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return res.writeHead(404).end("not found");
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream",
      "Content-Length": st.size,
      "Cache-Control": "max-age=3600",
    });
    fs.createReadStream(file).pipe(res);
  });
}).listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));
