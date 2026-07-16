// Lokaler Frontend-Dev-Server fuer schnelles Testen ohne CI-Wartezeit.
// Wird von Tauri automatisch als "beforeDevCommand" gestartet (siehe
// tauri.conf.json) - haengt an devUrl (http://localhost:1420) und liefert
// src/ direkt aus, damit `npm run dev` das echte Tauri-Fenster oeffnet.
// Bindet auf 0.0.0.0, damit dasselbe auch vom Handy im selben WLAN unter
// http://<PC-LAN-IP>:1420 im Browser erreichbar ist (ohne natives Tauri-
// Fenster - invoke()-Aufrufe laufen dort nur ueber die tauri-shim.js-
// Mocks, echte Wiedergabe/Downloads brauchen das native Fenster).
// Live-Reload ohne WebSocket-Bibliothek: der Client pollt alle 500ms einen
// Zeitstempel; aendert sich eine Datei in src/, steigt er, und die Seite
// laedt automatisch neu.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..", "src");
const port = 1420;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const LIVERELOAD_SNIPPET = `
<script>
(function () {
  let last = null;
  setInterval(async () => {
    try {
      const res = await fetch("/__livereload");
      const t = await res.text();
      if (last !== null && t !== last) location.reload();
      last = t;
    } catch (_) {}
  }, 500);
})();
</script>
</body>`;

let latestChange = String(Date.now());
fs.watch(root, { recursive: true }, () => {
  latestChange = String(Date.now());
});

function localLanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return null;
}

const server = http.createServer((req, res) => {
  if (req.url === "/__livereload") {
    res.writeHead(200, { "Content-Type": "text/plain", "Cache-Control": "no-store" });
    res.end(latestChange);
    return;
  }

  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.join(root, urlPath);

  // Kein Verlassen von src/ erlauben.
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found: " + urlPath);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const headers = {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    };
    if (ext === ".html") {
      const html = data.toString("utf-8").replace("</body>", LIVERELOAD_SNIPPET);
      res.writeHead(200, headers);
      res.end(html);
      return;
    }
    res.writeHead(200, headers);
    res.end(data);
  });
});

server.listen(port, "0.0.0.0", () => {
  const lan = localLanIp();
  console.log(`\nDev-Server laeuft:`);
  console.log(`  PC:    http://localhost:${port}`);
  if (lan) console.log(`  Handy: http://${lan}:${port}  (im selben WLAN)`);
  console.log(`\nAenderungen an Dateien in src/ laden automatisch neu.\n`);
});
