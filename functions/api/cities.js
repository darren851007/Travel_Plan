/* GET /api/cities — 新增行程表單用的國家與城市清單（不需要登入） */
import { json } from "../../lib/http.js";
import { CITIES, COUNTRIES } from "../../lib/cities.js";

export const onRequestGet = () => json({ countries: COUNTRIES, cities: CITIES });
