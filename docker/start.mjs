import { spawn } from "node:child_process";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const children = [];

function run(name, command, args) {
  const child = spawn(command, args, { stdio: "inherit" });
  child.on("exit", (code) => {
    console.error(`${name} exited with code ${code}; stopping container`);
    shutdown(1);
  });
  children.push(child);
}

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const webRoot = "apps/web/dist";
const webServer = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname.startsWith("/health") || url.pathname.startsWith("/v1")) {
    res.writeHead(404).end();
    return;
  }
  let file = normalize(join(webRoot, url.pathname === "/" ? "index.html" : url.pathname));
  if (!file.startsWith(webRoot) || !existsSync(file) || !statSync(file).isFile()) {
    file = join(webRoot, "index.html");
  }
  res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
});
webServer.listen(8080, () => console.log("web static server on :8080"));

run("api", "node", ["apps/api/dist/index.js"]);
run("worker", "node", ["apps/worker/dist/index.js"]);

function shutdown(code) {
  for (const child of children) child.kill("SIGTERM");
  webServer.close();
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
