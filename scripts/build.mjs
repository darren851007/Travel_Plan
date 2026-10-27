/* ============================================================
   打包：只把網頁需要的檔案複製到 dist/site（Cloudflare Worker 與 GitHub Pages 都用這份）
   （server/ 由 Worker 處理；.env 等其他檔案不會被上傳）
   ============================================================ */
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "dist/site");
const FILES = ["index.html", "privacy.html", "css", "js"];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const file of FILES) cpSync(join(ROOT, file), join(OUT, file), { recursive: true });

/* 安全標頭：不讓別的網站把頁面嵌進去、不送出完整來源網址 */
writeFileSync(
  join(OUT, "_headers"),
  `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Content-Security-Policy: frame-ancestors 'none'
`
);

console.log(`已打包到 dist/site：${FILES.join("、")}`);
