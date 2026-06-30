import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";
const TFL_STATUS_URLS = [
  "https://api.tfl.gov.uk/Line/Mode/tube/Status",
  "https://api.tfl.gov.uk/Line/Mode/elizabeth-line/Status",
];
const CACHE_MS = Math.max(Number(process.env.CACHE_SECONDS || 30), 10) * 1000;
const ROOT = fileURLToPath(new URL(".", import.meta.url));

const LINES = [
  { id: "bakerloo", name: "Bakerloo", colour: "#B36305", zones: "Zones 1-5" },
  { id: "central", name: "Central", colour: "#E32017", zones: "Zones 1-6" },
  { id: "circle", name: "Circle", colour: "#FFD300", zones: "Zones 1-2" },
  { id: "district", name: "District", colour: "#00782A", zones: "Zones 1-6" },
  {
    id: "elizabeth",
    name: "Elizabeth line",
    colour: "#6950A1",
    zones: "Zones 1-6+",
  },
  {
    id: "hammersmith-city",
    name: "Hammersmith & City",
    colour: "#F3A9BB",
    zones: "Zones 1-3",
  },
  { id: "jubilee", name: "Jubilee", colour: "#A0A5A9", zones: "Zones 1-6" },
  {
    id: "metropolitan",
    name: "Metropolitan",
    colour: "#9B0056",
    zones: "Zones 1-6+",
  },
  { id: "northern", name: "Northern", colour: "#000000", zones: "Zones 1-5" },
  { id: "piccadilly", name: "Piccadilly", colour: "#003688", zones: "Zones 1-6" },
  { id: "victoria", name: "Victoria", colour: "#0098D4", zones: "Zones 1-3" },
  {
    id: "waterloo-city",
    name: "Waterloo & City",
    colour: "#95CDBA",
    zones: "Zone 1",
  },
];

let cachedTfL = null;
let cachedAt = 0;

function sendJson(response, status, body, pretty = false) {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "public, max-age=20",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body, null, pretty ? 2 : 0));
}

function sendText(response, status, body) {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "text/plain; charset=utf-8",
  });
  response.end(body);
}

async function getTfLStatus() {
  const now = Date.now();
  if (cachedTfL && now - cachedAt < CACHE_MS) {
    return cachedTfL;
  }

  cachedTfL = (await Promise.all(TFL_STATUS_URLS.map(async (url) => {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`TfL returned HTTP ${response.status}`);
    }

    return response.json();
  }))).flat();
  cachedAt = now;
  return cachedTfL;
}

function statusTone(severity) {
  if (severity >= 10) return "good";
  if (severity >= 6) return "warning";
  if (typeof severity === "number") return "bad";
  return "unknown";
}

function normalizeStatus(line, live) {
  const status = live?.lineStatuses?.[0];
  const statusText = status?.statusSeverityDescription || "Unknown";
  const severity = status?.statusSeverity ?? null;

  return {
    id: line.id,
    name: line.name,
    colour: line.colour,
    zones: line.zones,
    status: statusText,
    severity,
    tone: statusTone(severity),
    disrupted: statusText !== "Good Service",
    reason:
      status?.reason ||
      (statusText === "Good Service"
        ? "No current disruptions reported by TfL."
        : "TfL has not provided additional details."),
    validityPeriods: status?.validityPeriods || [],
  };
}

function selectedLineIds(searchParams) {
  const lineParam = searchParams.get("lines");
  if (!lineParam) return null;

  return new Set(
    lineParam
      .split(",")
      .map((line) => line.trim())
      .filter(Boolean),
  );
}

async function tubeStatusPayload(searchParams) {
  const tflData = await getTfLStatus();
  const liveById = new Map(tflData.map((line) => [line.id, line]));
  const requestedIds = selectedLineIds(searchParams);

  const selectedLines = LINES.filter((line) => !requestedIds || requestedIds.has(line.id))
    .map((line) => normalizeStatus(line, liveById.get(line.id)));

  let lines = selectedLines;
  if (searchParams.get("show") === "issues") {
    lines = lines.filter((line) => line.disrupted);
  }

  const issueCount = selectedLines.filter((line) => line.disrupted).length;

  return {
    updatedAt: new Date().toISOString(),
    source: "Transport for London Unified API",
    sourceUrls: TFL_STATUS_URLS,
    summary: {
      selected: selectedLines.length,
      returned: lines.length,
      goodService: selectedLines.length - issueCount,
      issues: issueCount,
      message:
        issueCount === 0
          ? "All selected TfL lines are reporting good service."
          : `${issueCount} selected TfL line${issueCount === 1 ? " has" : "s have"} reported issues.`,
    },
    lines,
  };
}

function contentType(pathname) {
  switch (extname(pathname)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
    case ".mjs":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".png":
      return "image/png";
    default:
      return "application/octet-stream";
  }
}

async function serveStatic(requestUrl, response) {
  const pathname = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": contentType(filePath),
      "Cache-Control": "public, max-age=60",
    });
    response.end(body);
  } catch {
    sendText(response, 404, "Not found");
  }
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    response.end();
    return;
  }

  if (requestUrl.pathname === "/healthz") {
    sendJson(response, 200, { ok: true, updatedAt: new Date().toISOString() });
    return;
  }

  if (requestUrl.pathname === "/api/tube-status.json") {
    try {
      const pretty = requestUrl.searchParams.get("pretty") === "1";
      sendJson(response, 200, await tubeStatusPayload(requestUrl.searchParams), pretty);
    } catch (error) {
      sendJson(response, 502, {
        updatedAt: new Date().toISOString(),
        error: "TfL data unavailable",
        message: error.message,
      });
    }
    return;
  }

  if (request.method === "GET") {
    await serveStatic(requestUrl, response);
    return;
  }

  sendText(response, 405, "Method not allowed");
});

server.listen(PORT, HOST, () => {
  console.log(`Tube status server running at http://${HOST}:${PORT}`);
  console.log(`JSON endpoint: http://${HOST}:${PORT}/api/tube-status.json`);
});
