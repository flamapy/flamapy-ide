import http from "http";
import url from "url";
import { WebSocketServer } from "ws";
import { setupWSConnection } from "y-websocket/bin/utils";

const port = process.env.COLLAB_PORT || 1234;
const host = process.env.COLLAB_HOST || "127.0.0.1";

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
    });
    res.end();
    return;
  }

  if (req.url === "/health") {
    res.writeHead(200, {
      "Content-Type": "text/plain",
      "Access-Control-Allow-Origin": "*",
    });
    res.end("ok");
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("not found");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  const parsedUrl = url.parse(req.url, true);
  const docName = (parsedUrl.pathname || "").slice(1) || "default";

  setupWSConnection(ws, req, {
    docName,
  });
});

server.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`[collab] listening on ws://${host}:${port}`);
});
