// Tiny static server for local preview
const http = require("http");
const fs = require("fs");
const p = require("path");
const ROOT = p.join(__dirname, "..", "public");
const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".xml": "application/xml", ".svg": "image/svg+xml", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon" };
http.createServer((q, s) => {
  let u = decodeURIComponent(q.url.split("?")[0]);
  if (u.endsWith("/")) u += "index.html";
  let f = p.join(ROOT, u);
  fs.readFile(f, (e, d) => {
    if (e) { s.writeHead(404, { "Content-Type": "text/html" }); s.end("404 Not Found"); return; }
    s.writeHead(200, { "Content-Type": MIME[p.extname(f)] || "text/plain" });
    s.end(d);
  });
}).listen(7788, () => console.log("Preview server on http://localhost:7788"));
