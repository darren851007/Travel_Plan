/* ============================================================
   Notion 同步資料 — 由 npm run notion:sync 自動產生，請勿手動修改
   有這份資料時，網頁會改用 Notion 的內容取代內建範例
   ============================================================ */
window.Trip = window.Trip || {};

Trip.dataSource = { type: "notion", syncedAt: "2026-10-27T01:21:18.903Z" };

/* 準備清單的共用項目已包含在各國清單裡 */
Trip.config.checklistBefore = [];
Trip.config.checklistAfter = [];

Trip.destinations = [
  {
    "id": "korea",
    "name": "韓國",
    "flag": "🇰🇷",
    "title": "韓國冬日小旅行",
    "tagline": "首爾古宮、釜山海景",
    "art": "heroSeoul",
    "startDate": "2026-12-18",
    "flights": {
      "outbound": {
        "airline": "中華航空",
        "number": "CI 160",
        "from": {
          "code": "TPE",
          "city": "台北桃園",
          "time": "08:20",
          "terminal": "第一航廈"
        },
        "to": {
          "code": "ICN",
          "city": "首爾仁川",
          "time": "11:45",
          "terminal": "第一航廈"
        },
        "duration": "2h 25m",
        "seat": "32A",
        "baggage": "託運 23kg"
      },
      "inbound": {
        "airline": "中華航空",
        "number": "CI 189",
        "from": {
          "code": "PUS",
          "city": "釜山金海",
          "time": "13:30",
          "terminal": "國際線"
        },
        "to": {
          "code": "TPE",
          "city": "台北桃園",
          "time": "15:10",
          "terminal": "第一航廈"
        },
        "duration": "2h 40m",
        "seat": "26C",
        "baggage": "託運 23kg"
      }
    },
    "days": [
      {
        "city": "首爾",
        "theme": "抵達首爾 · 弘大散步",
        "items": [
          {
            "time": "08:20",
            "title": "桃園機場出發",
            "note": "提早 2 小時到機場報到",
            "transport": [
              "flight"
            ],
            "must": false
          },
          {
            "time": "12:30",
            "title": "仁川機場 → 首爾站",
            "note": "搭 AREX 直達車約 43 分鐘",
            "transport": [
              "arex"
            ],
            "must": false
          },
          {
            "time": "14:30",
            "title": "弘大入住",
            "note": "放行李、休息一下",
            "transport": [
              "subway"
            ],
            "must": false
          },
          {
            "time": "16:00",
            "title": "延南洞 & 京義線林蔭道",
            "note": "小店、咖啡廳一路逛",
            "transport": [
              "walk"
            ],
            "must": true
          },
          {
            "time": "19:00",
            "title": "韓式烤肉晚餐",
            "note": "五花肉配大醬湯",
            "transport": [
              "walk"
            ],
            "must": false
          }
        ]
      },
      {
        "city": "首爾",
        "theme": "古宮與韓屋",
        "items": [
          {
            "time": "09:30",
            "title": "景福宮",
            "note": "穿韓服免門票，10:00 看守門將換班",
            "transport": [
              "subway"
            ],
            "must": true
          },
          {
            "time": "12:00",
            "title": "土俗村蔘雞湯",
            "note": "排隊名店，早點去",
            "transport": [
              "walk"
            ],
            "must": false
          },
          {
            "time": "14:00",
            "title": "北村韓屋村",
            "note": "注意住宅區要保持安靜",
            "transport": [
              "walk"
            ],
            "must": true
          },
          {
            "time": "16:30",
            "title": "益善洞韓屋街",
            "note": "下午茶、拍照",
            "transport": [
              "bus"
            ],
            "must": false
          },
          {
            "time": "19:00",
            "title": "廣藏市場",
            "note": "綠豆煎餅、麻藥紫菜包飯",
            "transport": [
              "subway"
            ],
            "must": false
          }
        ]
      },
      {
        "city": "首爾",
        "theme": "明洞 · 南山塔",
        "items": [
          {
            "time": "10:00",
            "title": "明洞逛街",
            "note": "美妝、街頭小吃",
            "transport": [
              "subway"
            ],
            "must": false
          },
          {
            "time": "14:00",
            "title": "南山纜車",
            "note": "從明洞步行到纜車站",
            "transport": [
              "walk",
              "cable"
            ],
            "must": false
          },
          {
            "time": "15:00",
            "title": "N 首爾塔",
            "note": "看夕陽和首爾夜景",
            "transport": [
              "cable"
            ],
            "must": true
          },
          {
            "time": "19:00",
            "title": "東大門",
            "note": "DDP 夜間燈光、宵夜",
            "transport": [
              "bus"
            ],
            "must": false
          }
        ]
      },
      {
        "city": "釜山",
        "theme": "搭 KTX 到釜山 · 海雲台",
        "items": [
          {
            "time": "08:30",
            "title": "首爾站搭 KTX",
            "note": "約 2.5 小時，記得先訂票",
            "transport": [
              "train"
            ],
            "must": false
          },
          {
            "time": "11:30",
            "title": "西面入住",
            "note": "先寄放行李",
            "transport": [
              "subway"
            ],
            "must": false
          },
          {
            "time": "13:30",
            "title": "海雲台海岸列車",
            "note": "Blue Line Park，建議先預約",
            "transport": [
              "train"
            ],
            "must": true
          },
          {
            "time": "16:00",
            "title": "青沙浦踏石展望台",
            "note": "腳下就是海",
            "transport": [
              "walk"
            ],
            "must": false
          },
          {
            "time": "18:30",
            "title": "廣安里海灘",
            "note": "看廣安大橋點燈",
            "transport": [
              "subway"
            ],
            "must": true
          }
        ]
      },
      {
        "city": "釜山",
        "theme": "甘川洞 · 南浦洞",
        "items": [
          {
            "time": "10:00",
            "title": "甘川文化村",
            "note": "彩色房子、小王子雕像",
            "transport": [
              "bus"
            ],
            "must": true
          },
          {
            "time": "13:00",
            "title": "BIFF 廣場",
            "note": "黑糖餅、魚板",
            "transport": [
              "bus"
            ],
            "must": false
          },
          {
            "time": "15:00",
            "title": "札嘎其市場",
            "note": "韓國最大的海鮮市場",
            "transport": [
              "walk"
            ],
            "must": false
          },
          {
            "time": "18:00",
            "title": "釜山塔",
            "note": "龍頭山公園看夜景",
            "transport": [
              "walk"
            ],
            "must": false
          }
        ]
      },
      {
        "city": "釜山",
        "theme": "最後採買 · 回家",
        "items": [
          {
            "time": "09:00",
            "title": "退房",
            "note": "",
            "transport": [
              "walk"
            ],
            "must": false
          },
          {
            "time": "09:30",
            "title": "西面地下街採買",
            "note": "伴手禮、零食",
            "transport": [
              "walk"
            ],
            "must": false
          },
          {
            "time": "11:00",
            "title": "西面 → 金海機場",
            "note": "預留 2.5 小時辦理退稅與登機",
            "transport": [
              "subway",
              "train"
            ],
            "must": false
          },
          {
            "time": "13:30",
            "title": "起飛回台北",
            "note": "",
            "transport": [
              "flight"
            ],
            "must": false
          }
        ]
      }
    ],
    "lodgings": [
      {
        "city": "釜山",
        "name": "西面旅店 Seomyeon Stay",
        "address": "釜山市釜山鎮區 · 西面站附近（請填入完整地址）",
        "room": "雙人房 · 海景",
        "checkInTime": "15:00",
        "checkOutTime": "11:00",
        "bookingNo": "SM-20261221",
        "phone": "+82 51-000-0000",
        "mapQuery": "西面站 釜山"
      },
      {
        "city": "首爾",
        "name": "弘大旅店 Hongdae Stay",
        "address": "首爾市麻浦區 · 弘大入口站附近（請填入完整地址）",
        "room": "雙人房 · 含早餐",
        "checkInTime": "15:00",
        "checkOutTime": "11:00",
        "bookingNo": "HD-20261218",
        "phone": "+82 2-0000-0000",
        "mapQuery": "弘大入口站"
      }
    ],
    "checklist": [
      {
        "id": "406284fb099e817c87def81d17422447",
        "text": "護照",
        "hint": "效期 6 個月以上"
      },
      {
        "id": "406284fb099e8188aa37e77d1aba28c2",
        "text": "機票訂位確認",
        "hint": "線上報到、選位"
      },
      {
        "id": "406284fb099e8113ac22f09019e44691",
        "text": "住宿訂房確認",
        "hint": ""
      },
      {
        "id": "406284fb099e81c2958fe22cc12d31fc",
        "text": "確認入境規定",
        "hint": "K-ETA / 電子入境卡是否需要申請"
      },
      {
        "id": "406284fb099e810593dbdd617a673051",
        "text": "換韓元 / 開通海外刷卡",
        "hint": ""
      },
      {
        "id": "406284fb099e81d6a32cfed3b120d2ba",
        "text": "T-money 交通卡",
        "hint": ""
      },
      {
        "id": "406284fb099e81898ee3f9c8147a998b",
        "text": "預訂 KTX 首爾 → 釜山",
        "hint": "Korail 官網或 App"
      },
      {
        "id": "406284fb099e812d9c86e601dde0dbb0",
        "text": "轉接頭",
        "hint": "韓國 220V 圓孔插座"
      },
      {
        "id": "406284fb099e81c8bc3bd6567a40090e",
        "text": "網卡或 eSIM",
        "hint": ""
      },
      {
        "id": "406284fb099e8199bbb1ed76e1e94740",
        "text": "行動電源",
        "hint": "只能隨身帶上機，不可託運"
      },
      {
        "id": "406284fb099e8166afa7d2b69cae4fe9",
        "text": "羽絨外套、圍巾、手套",
        "hint": "12 月常在零度上下"
      },
      {
        "id": "406284fb099e816c889dd801bbdb56f4",
        "text": "常備藥品",
        "hint": ""
      },
      {
        "id": "406284fb099e81f28a8fcb07c20f39fa",
        "text": "旅遊平安險",
        "hint": ""
      }
    ]
  },
  {
    "id": "japan",
    "name": "日本",
    "flag": "🇯🇵",
    "title": "東京冬日小旅行",
    "tagline": "淺草、澀谷與東京鐵塔燈光",
    "art": "heroTokyo",
    "startDate": "2027-01-22",
    "flights": {
      "outbound": {
        "airline": "長榮航空",
        "number": "BR 198",
        "from": {
          "code": "TPE",
          "city": "台北桃園",
          "time": "08:50",
          "terminal": "第二航廈"
        },
        "to": {
          "code": "NRT",
          "city": "東京成田",
          "time": "13:10",
          "terminal": "第一航廈"
        },
        "duration": "3h 20m",
        "seat": "41A",
        "baggage": "託運 23kg"
      },
      "inbound": {
        "airline": "長榮航空",
        "number": "BR 197",
        "from": {
          "code": "NRT",
          "city": "東京成田",
          "time": "14:30",
          "terminal": "第一航廈"
        },
        "to": {
          "code": "TPE",
          "city": "台北桃園",
          "time": "17:35",
          "terminal": "第二航廈"
        },
        "duration": "4h 05m",
        "seat": "38C",
        "baggage": "託運 23kg"
      }
    },
    "days": [
      {
        "city": "東京",
        "theme": "抵達東京 · 淺草夜晚",
        "items": [
          {
            "time": "08:50",
            "title": "桃園機場出發",
            "note": "提早 2 小時到機場報到",
            "transport": [
              "flight"
            ],
            "must": false
          },
          {
            "time": "14:00",
            "title": "成田機場 → 上野",
            "note": "搭 Skyliner 約 41 分鐘",
            "transport": [
              "arex"
            ],
            "must": false
          },
          {
            "time": "15:00",
            "title": "上野入住",
            "note": "放行李、休息一下",
            "transport": [
              "walk"
            ],
            "must": false
          },
          {
            "time": "16:30",
            "title": "淺草寺 · 雷門",
            "note": "仲見世通吃人形燒",
            "transport": [
              "subway"
            ],
            "must": true
          },
          {
            "time": "19:00",
            "title": "晴空塔夜景",
            "note": "從隅田川散步過去",
            "transport": [
              "walk"
            ],
            "must": false
          }
        ]
      },
      {
        "city": "東京",
        "theme": "原宿 · 澀谷",
        "items": [
          {
            "time": "10:00",
            "title": "明治神宮",
            "note": "早上人少很清幽",
            "transport": [
              "train"
            ],
            "must": false
          },
          {
            "time": "12:00",
            "title": "原宿竹下通",
            "note": "可麗餅、古著",
            "transport": [
              "walk"
            ],
            "must": false
          },
          {
            "time": "15:00",
            "title": "SHIBUYA SKY",
            "note": "夕陽時段建議先預約",
            "transport": [
              "train"
            ],
            "must": true
          },
          {
            "time": "18:00",
            "title": "澀谷十字路口",
            "note": "從星巴克二樓往下看",
            "transport": [
              "walk"
            ],
            "must": false
          }
        ]
      },
      {
        "city": "東京",
        "theme": "築地 · 銀座 · 東京鐵塔",
        "items": [
          {
            "time": "09:30",
            "title": "築地場外市場",
            "note": "玉子燒、海鮮丼",
            "transport": [
              "subway"
            ],
            "must": false
          },
          {
            "time": "12:30",
            "title": "銀座散步",
            "note": "伊東屋文具、百貨",
            "transport": [
              "walk"
            ],
            "must": false
          },
          {
            "time": "16:00",
            "title": "東京鐵塔",
            "note": "傍晚點燈最漂亮",
            "transport": [
              "subway"
            ],
            "must": true
          },
          {
            "time": "19:00",
            "title": "六本木夜景",
            "note": "六本木 Hills 展望台",
            "transport": [
              "walk"
            ],
            "must": false
          }
        ]
      },
      {
        "city": "東京",
        "theme": "鎌倉 · 江之島",
        "items": [
          {
            "time": "09:00",
            "title": "搭電車往鎌倉",
            "note": "JR 橫須賀線約 1 小時",
            "transport": [
              "train"
            ],
            "must": false
          },
          {
            "time": "10:30",
            "title": "鶴岡八幡宮",
            "note": "小町通邊走邊吃",
            "transport": [
              "walk"
            ],
            "must": false
          },
          {
            "time": "13:00",
            "title": "江之電 · 鎌倉高校前",
            "note": "灌籃高手平交道",
            "transport": [
              "train"
            ],
            "must": true
          },
          {
            "time": "15:30",
            "title": "江之島",
            "note": "看海、吃魩仔魚丼",
            "transport": [
              "walk"
            ],
            "must": false
          }
        ]
      },
      {
        "city": "東京",
        "theme": "最後採買 · 回家",
        "items": [
          {
            "time": "09:30",
            "title": "退房",
            "note": "",
            "transport": [
              "walk"
            ],
            "must": false
          },
          {
            "time": "10:00",
            "title": "阿美橫丁採買",
            "note": "藥妝、零食",
            "transport": [
              "walk"
            ],
            "must": false
          },
          {
            "time": "11:30",
            "title": "上野 → 成田機場",
            "note": "搭 Skyliner，預留 2.5 小時登機",
            "transport": [
              "arex"
            ],
            "must": false
          },
          {
            "time": "14:30",
            "title": "起飛回台北",
            "note": "",
            "transport": [
              "flight"
            ],
            "must": false
          }
        ]
      }
    ],
    "lodgings": [
      {
        "city": "東京",
        "name": "上野旅店 Ueno Stay",
        "address": "東京都台東區 · 上野站附近（請填入完整地址）",
        "room": "雙人房",
        "checkInTime": "15:00",
        "checkOutTime": "10:00",
        "bookingNo": "UE-20270122",
        "phone": "+81 3-0000-0000",
        "mapQuery": "上野站"
      }
    ],
    "checklist": [
      {
        "id": "406284fb099e81ba992be4a8f0843bc5",
        "text": "護照",
        "hint": "效期 6 個月以上"
      },
      {
        "id": "406284fb099e81ba9aede0083bc4dc14",
        "text": "機票訂位確認",
        "hint": "線上報到、選位"
      },
      {
        "id": "406284fb099e8118949cda82be036fd3",
        "text": "住宿訂房確認",
        "hint": ""
      },
      {
        "id": "406284fb099e815598a0f8af241357c7",
        "text": "填寫 Visit Japan Web",
        "hint": "入境審查、海關 QR Code"
      },
      {
        "id": "406284fb099e8133b64be4a28e4a0e5d",
        "text": "換日圓 / 開通海外刷卡",
        "hint": ""
      },
      {
        "id": "406284fb099e81828007ce3960804288",
        "text": "Suica / PASMO 交通卡",
        "hint": "也可以加到手機錢包"
      },
      {
        "id": "406284fb099e81759e73c1065355f67f",
        "text": "網卡或 eSIM",
        "hint": ""
      },
      {
        "id": "406284fb099e81cf917af45dcb9c807a",
        "text": "行動電源",
        "hint": "只能隨身帶上機，不可託運"
      },
      {
        "id": "406284fb099e810587b7cd5874bf0f9a",
        "text": "羽絨外套、圍巾、手套",
        "hint": "12 月常在零度上下"
      },
      {
        "id": "406284fb099e8108819cf1c19ea0ed92",
        "text": "常備藥品",
        "hint": ""
      },
      {
        "id": "406284fb099e81169e4bfa338a8e8e1c",
        "text": "旅遊平安險",
        "hint": ""
      }
    ]
  }
];
