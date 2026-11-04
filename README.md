# 北京，一九八九 — An Ordinary Spring

線上試玩：<https://game.lijiabao.uk/beijing1989/>

**前提**：歷史的結果已經確定。你扮演一個普通人——看到了什麼、相信了什麼、幫助了誰，以及最後留下了什麼。

這是一款「歷史敘事＋城市探索＋人物命運模擬」遊戲，不是生存遊戲，也不是射擊遊戲。

## 目前可玩：第一章（1989 年 4 月 17 日晚）
一名虛構的北京大學學生：宿舍 → 布告欄上的悼念大字報（胡耀邦於 4/15 逝世）→ 和同學談話 → 帶著一封信或一壺熱水騎車出校門 → 城裡的街道（報刊亭、喇叭、下夜班的工人、往南走的學生）→ 聽、談、記日記，或回家。約 10～20 分鐘，四種結局。

操作：WASD／方向鍵或左下搖桿移動，E／空白鍵或右下按鈕互動，滾輪或雙指縮放。

## 設計原則
- **歷史固定，個人故事分岔。** 不改寫歷史結果；選擇只改變人際關係、隨身物品和日記。
- **有限資訊下的選擇。** 傳言只能相信、轉述，或自己去確認。
- **沒有戰鬥、沒有死亡分數、沒有「歷史正確選項」。**
- **真實人物不編台詞。** 不替任何真實人物（包括遇難者）編寫對話或行動；真實人物只會以有出處的引文出現。本章所有角色皆為虛構。
- **史料可查。** 每個事件標示「史實／證言／虛構」和確認程度（documented / testimony / uncertain），遊戲中可打開「史料」查看來源。

## 史料政策
- 事件資料在 `data/events/*.json`，每筆有日期、地點、`sources[]`、`confidence`。
- 史實事件至少一個可公開查閱的來源；只有一個證言來源的標 `testimony`；無法確認的標 `uncertain`。
- 參考圖片只用自由授權素材，記錄在 [docs/references.md](docs/references.md)。現代 OSM 不是 1989 年的北京，不直接匯入。

## 結構
| 路徑 | 內容 |
|---|---|
| `src/render` | Three.js 場景（校園、街道）、道具 |
| `src/play` | 移動、操作、對話執行器 |
| `src/save` | 本機存檔（章節、旗標、物品、關係、日記） |
| `src/ui` | 史料檢視 |
| `data/events` | 歷史事件與章節表 |
| `data/dialogue` | 資料驅動的對話樹 |
| `tools/` | 離線地圖管線（佔位） |
| `docs/` | [design](docs/design.md)、[timeline](docs/timeline.md)、[references](docs/references.md) |

## 開發
```
npm ci
npm run dev        # 本機
npm run build      # 型別檢查＋建置
npm run validate   # 資料檢查
npm run smoke      # Puppeteer 跑一遍第一章（需 Chrome，CHROME_PATH 可指定）
```

Copyright (c) 2026 李家宝. All rights reserved. 部分技術模式來自同作者的 shanghaisurvival，見 [NOTICE.md](NOTICE.md)。
