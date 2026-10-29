-- 國家、城市、機場（資料來自 GeoNames，每月由排程更新；網頁查詢只讀這裡）
CREATE TABLE IF NOT EXISTS countries (
  code TEXT PRIMARY KEY,          -- ISO 國家代碼，例如 JP
  name_zh TEXT NOT NULL,          -- 繁體中文名稱（沒有時是英文）
  name_en TEXT NOT NULL,
  population INTEGER NOT NULL DEFAULT 0,
  synced_month TEXT               -- 城市與機場最後更新的月份，例如 2026-10；NULL 表示還沒抓過
);

CREATE TABLE IF NOT EXISTS cities (
  id INTEGER PRIMARY KEY,         -- GeoNames 的 geonameId
  country TEXT NOT NULL,
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  admin TEXT NOT NULL DEFAULT '', -- 省、州、縣（同名城市時辨認用）
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  population INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS cities_by_country ON cities (country, population DESC);

CREATE TABLE IF NOT EXISTS airports (
  iata TEXT PRIMARY KEY,
  country TEXT NOT NULL,
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS airports_by_country ON airports (country);

-- 更新進度，例如 countries_month = 2026-10
CREATE TABLE IF NOT EXISTS sync_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
