// Snip backend: a single-file URL shortener. Links live in memory and reset on restart.
import { stat } from "node:fs/promises";
import { resolve, sep } from "node:path";

const PORT = Number(process.env.PORT) || 3000;
const BASE_URL = (
  process.env.BASE_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : `http://localhost:${PORT}`)
).replace(/\/+$/, "");
const PUBLIC_DIR = process.env.PUBLIC_DIR ? resolve(process.env.PUBLIC_DIR) : null;

const MAX_URL_LENGTH = 2048;
const CODE_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const CODE_LENGTH = 6;
const MAX_CODE_ATTEMPTS = 20;

const links = new Map(); // code -> link

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  return Response.json(data, { status, headers: CORS_HEADERS });
}

function error(message, status) {
  return json({ error: message }, status);
}

function randomCode() {
  let code = "";
  while (code.length < CODE_LENGTH) {
    const byte = crypto.getRandomValues(new Uint8Array(1))[0];
    // 248 = 62 * 4: rejecting larger bytes keeps the modulo unbiased.
    if (byte < 248) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return code;
}

function newCode() {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = randomCode();
    if (!links.has(code)) return code;
  }
  throw new Error("could not allocate a unique short code");
}

// Returns the normalized http(s) URL, or null when the input is not acceptable.
function parseHttpUrl(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return null;
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
}

async function createLink(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return error("Request body must be valid JSON", 400);
  }
  const url = parseHttpUrl(body?.url);
  if (!url) return error("url must be a valid http or https URL", 400);

  const code = newCode();
  const link = {
    code,
    url,
    shortUrl: `${BASE_URL}/${code}`,
    hits: 0,
    createdAt: new Date().toISOString(),
  };
  links.set(code, link);
  return json(link, 201);
}

function redirect(code) {
  const link = links.get(code);
  if (!link) return error("Link not found", 404);
  link.hits += 1;
  return new Response(null, { status: 302, headers: { ...CORS_HEADERS, Location: link.url } });
}

// Serves a file from PUBLIC_DIR, or returns null when none matches.
async function staticFile(pathname) {
  if (!PUBLIC_DIR) return null;
  let relative;
  try {
    relative = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (relative === "/") relative = "/index.html";

  const filePath = resolve(PUBLIC_DIR, "." + relative);
  if (!filePath.startsWith(PUBLIC_DIR + sep)) return null;

  try {
    const info = await stat(filePath);
    if (!info.isFile()) return null;
  } catch {
    return null;
  }
  return new Response(Bun.file(filePath));
}

async function handle(request) {
  const { pathname } = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (pathname === "/api/links") {
    if (request.method === "GET") return json([...links.values()]);
    if (request.method === "POST") return createLink(request);
    return error("Method not allowed", 405);
  }

  if (request.method === "GET") {
    const file = await staticFile(pathname);
    if (file) return file;
    return redirect(pathname.slice(1));
  }

  return error("Not found", 404);
}

const server = Bun.serve({
  port: PORT,
  fetch: handle,
  error(err) {
    console.error(err);
    return error("Internal server error", 500);
  },
});

console.log(
  `Snip backend listening on http://localhost:${server.port} (shortUrl base: ${BASE_URL}, PUBLIC_DIR: ${PUBLIC_DIR ?? "off"})`,
);
