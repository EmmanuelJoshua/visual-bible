// node scripts/serve-export.mjs [dir] [port]: serves the static export (`npm run build` → out/).
// Python's http.server drops connections under the map's burst of requests; this doesn't.
import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.argv[2] ?? "out");
const port = Number(process.argv[3] ?? 4317);
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".txt": "text/plain", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg",
  ".glb": "model/gltf-binary", ".woff2": "font/woff2", ".ico": "image/x-icon", ".mp4": "video/mp4",
};
const send = (res, file) => {
  const st = statSync(file);
  if (st.isDirectory()) return send(res, join(file, "index.html"));
  res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream", "Content-Length": st.size, "Cache-Control": "no-cache" });
  createReadStream(file).pipe(res);
};
createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = normalize(join(root, path));
  if (!file.startsWith(root)) return res.writeHead(403).end();
  try {
    send(res, file);
  } catch {
    try {
      // /explore → explore.html
      send(res, file.replace(/\/$/, "") + ".html");
    } catch {
      res.writeHead(404).end("not found");
    }
  }
}).listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));
