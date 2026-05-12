import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || 4173);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = normalize(join(root, requestedPath));

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(body);
  } catch {
    const fallback = await readFile(join(root, "index.html"));
    response.writeHead(200, { "Content-Type": contentTypes[".html"] });
    response.end(fallback);
  }
});

server.listen(port, () => {
  console.log(`Smart Home app running at http://localhost:${port}`);
});
