/* ============================================================
   本機伺服器（npm start）— 提供網頁，並讓網頁上的「Notion 連結」面板可以操作
   只接受這台電腦的連線；金鑰存在 .env，不會傳回網頁
   ============================================================ */
import http from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadEnv,
  connectNotion,
  disconnectNotion,
  notionStatus,
  setupNotion,
  syncToFile,
  resetDataFile,
} from "./notion.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT) || 3000;

/* 只公開網頁需要的檔案，.env、scripts、.git 等一律讀不到 */
const PUBLIC = ["index.html", `css${sep}`, `js${sep}`];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

loadEnv();

/* ---------- API ---------- */

let busy = false;

const actions = {
  "GET status": () => notionStatus(),

  "POST connect": async ({ token, page }) => {
    await connectNotion(token, page);
    return notionStatus();
  },

  "POST disconnect": async () => {
    disconnectNotion();
    return notionStatus();
  },

  /* 建立表單、同步都要花時間，一次只做一件 */
  "POST setup": exclusive(async () => {
    await setupNotion();
    return notionStatus();
  }),

  "POST sync": exclusive(async () => {
    const { destinations, warnings } = await syncToFile();
    return { destinations: destinations.map((d) => d.name), warnings };
  }),

  "POST reset": async () => {
    resetDataFile();
    return { ok: true };
  },
};

function exclusive(fn) {
  return async (body) => {
    if (busy) throw Object.assign(new Error("正在處理上一個動作，請稍候"), { status: 409 });
    busy = true;
    try {
      return await fn(body);
    } finally {
      busy = false;
    }
  };
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 10_000) throw Object.assign(new Error("資料太大"), { status: 413 });
  }
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw Object.assign(new Error("資料格式錯誤"), { status: 400 });
  }
}

async function handleApi(req, res, action) {
  const handler = actions[`${req.method} ${action}`];
  if (!handler) return send(res, 404, { error: "找不到這個功能" });

  /* 防止其他網站偷偷呼叫：POST 必須來自本機網頁、而且是 JSON */
  if (req.method === "POST") {
    const allowed = [`http://localhost:${PORT}`, `http://${HOST}:${PORT}`];
    if (!allowed.includes(req.headers.origin) || !req.headers["content-type"]?.startsWith("application/json")) {
      return send(res, 403, { error: "只接受本機網頁的請求" });
    }
  }

  try {
    const body = req.method === "POST" ? await readJson(req) : {};
    send(res, 200, await handler(body));
  } catch (err) {
    send(res, err.status || 400, { error: err.message });
  }
}

function send(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}

/* ---------- 靜態檔案 ---------- */

async function handleStatic(req, res, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname === "/" ? "/index.html" : pathname);
  } catch {
    res.writeHead(400).end("Bad request");
    return;
  }
  const relative = normalize(decoded).replace(/^[/\\]+/, "");
  const isPublic = relative === "index.html" || PUBLIC.some((p) => p.endsWith(sep) && relative.startsWith(p));
  if (!isPublic || relative.split(sep).some((part) => part.startsWith(".") || part === "..")) {
    res.writeHead(404).end("Not found");
    return;
  }

  try {
    const file = await readFile(join(ROOT, relative));
    /* 同步後重新整理就要看到新資料，所以不快取 */
    res.writeHead(200, { "Content-Type": MIME[extname(relative)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(file);
  } catch {
    res.writeHead(404).end("Not found");
  }
}

/* ---------- 啟動 ---------- */

const server = http.createServer(async (req, res) => {
  /* 只回應以 localhost / 127.0.0.1 開啟的請求（避免 DNS rebinding） */
  if (![`localhost:${PORT}`, `${HOST}:${PORT}`].includes(req.headers.host)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  const api = pathname.match(/^\/api\/notion\/([a-z]+)$/);
  if (api) return handleApi(req, res, api[1]);
  if (req.method !== "GET") return res.writeHead(405).end();
  return handleStatic(req, res, pathname);
});

server.on("error", (err) => {
  console.error(err.code === "EADDRINUSE" ? `✗ ${PORT} 埠已被使用，可改用 PORT=3001 npm start` : `✗ ${err.message}`);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`旅遊網頁已啟動：http://localhost:${PORT}`);
  console.log("按 Ctrl+C 停止");
});
