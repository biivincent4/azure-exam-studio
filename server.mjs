import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const files = {
  "/": ["index.html", "text/html"],
  "/index.html": ["index.html", "text/html"],
  "/styles.css": ["styles.css", "text/css"],
  "/app.js": ["app.js", "text/javascript"],
  "/core.js": ["core.js", "text/javascript"],
  "/questions.js": ["questions.js", "text/javascript"],
  "/bank-ai103.js": ["bank-ai103.js", "text/javascript"],
  "/bank-ai200.js": ["bank-ai200.js", "text/javascript"],
  "/bank-ai500.js": ["bank-ai500.js", "text/javascript"],
};
const root = new URL("./", import.meta.url);
const server = http.createServer(async (req, res) => {
  if (!["GET", "HEAD"].includes(req.method)) { res.writeHead(405, { Allow: "GET, HEAD" }); res.end(); return; }
  const path = new URL(req.url, "http://localhost").pathname;
  const file = Object.hasOwn(files, path) ? files[path] : undefined;
  if (!file) { res.writeHead(404); res.end("Not found"); return; }
  try {
    const content = await readFile(fileURLToPath(new URL(file[0], root)));
    res.writeHead(200, {
      "Content-Type": `${file[1]}; charset=utf-8`,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Cache-Control": "no-cache",
      "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'none'",
    });
    res.end(req.method === "HEAD" ? undefined : content);
  } catch (error) {
    console.error("Could not serve static asset:", error.message);
    res.writeHead(500); res.end("Asset unavailable");
  }
});
server.listen(Number(process.env.PORT || 4173), "127.0.0.1", () => {
  console.log(`Azure Exam Studio: http://127.0.0.1:${server.address().port}`);
});
