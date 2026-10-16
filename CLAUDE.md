@AGENTS.md

## 分層依賴方向（最重要的規則）

```
src/app/  →  src/features/  →  src/domain/
                  ↓
             src/data/  →  src/domain/
```

- `domain/` 不能 import 任何其他層，也不能 import React Native。
- `data/` 負責 I/O（資料庫、HTTP）以及把外部格式（例如臺銀 CSV）轉成 `domain/` 型別。可以用 `domain/` 的型別、`Result` helper 和純查詢函式，但不做分帳、匯率換算這類業務計算。
- `features/` 負責把 `data/` 和 `domain/` 串起來（`services/` 是流程，`hooks/` 給元件用），元件只負責顯示。
- `app/` 的路由檔要盡量薄，只是把 `features/` 的元件組起來。
- `data/` 需要實作、`features/` 需要使用的介面放在 `domain/<模組>/ports.ts`（例如 `BotQuoteSource`、`BotQuoteCache`），不要定義在 `features/`，否則 `data/` 會反過來依賴 `features/`。

## 錯誤處理慣例

- `domain/` 與 parser 一律回傳 `Result`（`src/domain/common/result.ts`），不 throw。
- I/O 失敗（離線、逾時、HTTP 錯誤、CSV 格式不符）在 `data/` 用 throw 表示；`features/services/` 負責接住並改用快取或請使用者手動輸入，所以 `resolveFxRate`、`refreshBotQuoteCache` 都不會 throw。

## 金額與匯率

- 金額一律存成該幣別最小單位的整數（`amountMinor`），小數位數以 `domain/ledger/currency.ts` 的對照表為準（例如 TWD、IDR 是 0 位）。
- 匯率與臺銀報價一律用十進位字串，不要轉成 `number` 再存。
- 日期以臺灣時間的 `YYYY-MM-DD` 判斷（`domain/fx/taipeiDate.ts`），不要用裝置的時區。
- 新增臺銀支援的幣別時，`BOT_QUOTED_CURRENCIES`（`data/fx/botQuoteSource.ts`）和 `currency.ts` 要一起更新，測試會比對真實 CSV 檢查兩邊是否一致。

## 臺銀匯率來源

- 從開發機用 curl 或 Node 打 `rate.bot.com.tw`，會拿到 HTTP 200 的「Challenge Validation」HTML 頁面，不是 CSV，所以沒辦法在電腦上用指令驗證網址或下載新的 fixture（請用瀏覽器下載）。手機上 App 的 `fetch` 可以正常拿到 CSV（2026-10-16 實機確認）。萬一 App 也被擋，parser 會判定為格式錯誤，流程會退回快取。

## 測試

- 測試檔一律用 `.test.ts`（元件用 `.test.tsx`）結尾，不要用 jest-expo 文件範例的 `-test.ts`。
- `eslint.config.js` 用 `*.test.ts(x)` 判斷測試檔，讓測試檔不受 `domain/` 的 layer 限制（React Native 限制仍然有效）；檔名不符就會被當成一般檔案擋下。
- `data/fx/__fixtures__/*.csv` 是從臺銀直接下載的原始檔，保留 BOM 和 CRLF，用來測試 parser 的容錯，不要用編輯器重新存檔。
- `tsconfig.json` 的 `types` 只有 `jest`，要用 Node API 的測試輔助檔（例如 `botFixtures.ts`）需要在檔案開頭加 `/// <reference types="node" />`。
