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

## 畫面

- 介面文字一律繁體中文，錯誤代碼轉成訊息集中在 `features/ledger/components/messages.ts`，新增錯誤代碼時要一起補。
- 消費分類：代碼在 `domain/ledger/categories.ts`（存進資料庫的是代碼，只能新增不能改名或刪除），中文名稱在 `features/ledger/components/categories.ts`；清單以外的舊分類文字會原樣顯示。
- 文字欄位的字數上限在 `domain/ledger/textLimits.ts`（`TEXT_LIMITS`），輸入框的 `maxLength` 和建立／修改指令的檢查共用同一份；還原備份不檢查，舊資料超過上限也照常還原，`TextField` 會放寬 `maxLength` 避免 Android 截掉顯示的舊文字。新增文字欄位時要一起補上限。
- 書架的年月分組用 `tripMonthOf`（`features/ledger/services/ledgerOverview.ts`）：帳本設定手動指定的 `tripMonth` 優先，否則取最早一筆消費的當地月份，沒有消費時用建立帳本的月份。旅行月份不另外存自動算出的值，所以記帳、刪消費後會自動重新歸類。
- 帳本封面：存三個代碼（`domain/ledger/cover.ts`，和分類一樣只能新增、不能改名或刪除），顏色與名稱在 `features/ledger/components/coverStyles.ts`。`cover` 是 null 或代碼讀不回來的帳本，畫面一律用 `coverFromId(id)` 補一個固定的封面。
- 共用 UI 元件與主題色在 `src/shared/ui/`（只用 React Native 內建元件，不用 `@expo/ui`）。
- 日系手繪風格（設計稿：https://claude.ai/artifact/Bq5DkRzceSM8V5rzqG2HPD）：
  - 這一版固定和紙淺色（`app.json` 的 `userInterfaceStyle` 也是 `light`），`useTheme()` 不跟系統切換。
  - 字型是霞鶩文楷 TC＋Caveat，在 `src/app/_layout.tsx` 用 `useFonts` 載入完才收起啟動畫面。自訂字型不會從 `View` 繼承，也不能用 `fontWeight` 切粗體：自己寫 `<Text>` 時要指定 `fonts.regular`／`fonts.bold`（`shared/ui/fonts.ts`），不要加 `fontWeight`。Caveat（`fonts.accent`）的字形比字寬寬，右邊會被 Text 的框切掉，要加 `paddingRight: accentOverhang(fontSize)`。
  - 手繪線條是 react-native-svg 畫的抖動路徑（`shared/ui/sketch.ts` 純函式、`handDrawn.tsx` 元件），不用 SVG 濾鏡：react-native-svg 雖然有 `FeTurbulence`、`FeDisplacementMap` 元件，但都沒有實作（只會警告、不畫任何東西），設計稿裡的鉛筆抖動要用路徑本身做出來。鉛筆的顆粒與印章缺墨則是用 `Mask` 挖掉小點（`HandCircle`、`InkStamp`），小點合成一條 path，不要一點一個 `Circle`。
- 地圖分頁是手繪地球（`features/map/components/GlobeScreen.tsx`，投影在 `domain/map/globe.ts`，海岸線在 `worldOutline.ts`），只放大到城市大小；城市裡的日期篩選、當天路線、目前位置在「詳細地圖」（`/map?ledgers=…`，react-native-maps），從地球的消費卡片進去。
  - 地球每一格都重新投影整個世界：海岸線先用 `toSphere` 轉成球面向量，投影只剩乘法，路徑字串直接串接；改這段時注意 Hermes 沒有 JIT，比 Node 慢很多。
  - 地圖上的線（詳細地圖的當天路線）用 SVG 疊在 `MapView` 上，地圖移動時用 `pointForCoordinate` 重新換算位置（`DayMap`）：react-native-maps 的 `Polyline`、`Polygon` 在 iOS 實機上都畫不出來（2026-10-29 確認）。
  - 動畫與拖曳狀態放在 `useGlobeMotion` 的 class 裡，畫面只拿快照：React Compiler 的 lint 不允許 render 時讀 ref（連把 ref 傳給 `PanResponder.create` 也算）。系統開啟「減少動態效果」時不擺動、視角直接跳到目標。
- 帳本內頁、統計、帳本設定、個人記帳、備份、詳細地圖，以及三個分頁都隱藏導覽列（`src/app/_layout.tsx`、`src/app/(tabs)/_layout.tsx`），頁首自己畫（`shared/ui/PageHeader.tsx`）；這類畫面讀取失敗時要用 `PageMessage`，不然沒有返回鍵可以離開。新增／編輯消費是 modal，保留原生導覽列（左右放取消、儲存）。
- 操作成功的短提示用 `useToast()`（`shared/ui/Toast.tsx`，掛在最外層 layout，換頁後仍看得到）；錯誤訊息照舊放在畫面上（`ErrorText`），不要只用提示。
- `Screen` 的捲動區設了 `keyboardShouldPersistTaps="handled"`，點按鈕不會自動收鍵盤；`Button`、`SmallButton` 已經會先收，自己用 `Pressable` 做送出按鈕時要呼叫 `Keyboard.dismiss()`；按下後會冒出新輸入欄位、要接著打字的按鈕（「新增成員」「手動修改匯率」）用 `Button` 的 `keepKeyboard`，新欄位用 `autoFocus` 接手。
- 選年月的設定（旅行月份、個人記帳的月份…）一律用 `MonthSwitcher`（`shared/ui/MonthPicker.tsx`）：左右箭頭一次移一個月，點中間的年月打開選單直接挑；之後新增類似的時間設定也用它，不要另外做。月份加減用 `shiftMonth`（`domain/ledger`）。
- 單邊的虛線、點線用 `DashedLine`（`handDrawn.tsx`）：React Native 的 `borderStyle: "dashed"` 在 iOS 只有四邊同寬時才有效。
- 畫面讀資料用 `useFocusedQuery`（`src/shared/hooks/`），每次回到畫面都會重新讀取，寫入後不用另外通知其他畫面。
- 新增路由後，`tsc` 會因為 typed routes 型別過期而報錯，要先跑一次 `npx expo start` 重新產生 `.expo/types/router.d.ts`。

## 錯誤處理慣例

- `domain/` 與 parser 一律回傳 `Result`（`src/domain/common/result.ts`），不 throw。
- I/O 失敗（離線、逾時、HTTP 錯誤、CSV 格式不符）在 `data/` 用 throw 表示；`features/services/` 負責接住並改用快取或請使用者手動輸入，所以 `resolveFxRate`、`refreshBotQuoteCache` 都不會 throw。

## 金額與匯率

- 金額一律存成該幣別最小單位的整數（`amountMinor`），小數位數以 `domain/ledger/currency.ts` 的對照表為準（例如 TWD、IDR 是 0 位）。
- 匯率與臺銀報價一律用十進位字串，不要轉成 `number` 再存。
- 日期以臺灣時間的 `YYYY-MM-DD` 判斷（`domain/fx/taipeiDate.ts`），不要用裝置的時區。
- 新增臺銀支援的幣別時，`BOT_QUOTED_CURRENCIES`（`data/fx/botQuoteSource.ts`）和 `currency.ts` 要一起更新，測試會比對真實 CSV 檢查兩邊是否一致；幣別選單的中文名稱在 `features/ledger/components/currencies.ts`，也要補（測試會檢查每個幣別都有名稱）。

## 資料庫（`src/data/db/`、`src/data/repositories/`）

- repository 只依賴 `SqlExecutor`（`data/db/sqlDatabase.ts`），不直接用 expo-sqlite；App 端用 `fromExpoSqlite` 包裝，測試用 `testDatabase.ts`（better-sqlite3）跑真正的 SQLite。SQL 參數一律用位置參數 `?`，兩邊的具名參數語法不同。
- 需要 transaction 時，在 `db.transaction(tx => ...)` 裡用 `createRepositories(tx)` 重新建立 repository，查詢才會經過同一個 transaction。
- id 與時間戳記由呼叫端（features）產生後傳入，repository 不自行產生。
- migration 只能新增，不可修改已發佈的；版本記在 `PRAGMA user_version`。
- 分攤規則存在 `expenses.split` JSON 欄位，裡面的成員 ID 沒有外鍵保護；查「成員是否被引用」要用 `json_each`（見 `memberRepository.isReferenced`）。
- 帳本有兩種 `kind`：`shared`（分帳）與 `personal`（個人分頁新增的消費，整個 App 只有一本、只有「我」一位成員，由部分唯一索引保證）。`ledgers.list()` 不帶參數會包含個人帳本（備份要用），畫面上的帳本列表要用 `list({ kind: "shared" })`。個人消費的付款人與分攤固定是「我」，只能透過 `personalCommands` 修改。
- 成員的 `isSelf` 標記「我」（每本帳本最多一位），個人分頁用它算出我在各分帳帳本負擔的金額；沒有標記的帳本不算進個人花費。
- 備份檔格式在 `data/backup/backupFile.ts`。`*Record` 新增或修改欄位（通常伴隨 migration）時，要同步更新它的解析，必要時提高 `BACKUP_VERSION`，並確認舊版備份仍能還原；備份還原會保留原本的 id，同一份備份重複還原會被略過。
- `occurred_at_ms`、`settled_at_ms` 是排序用欄位，由 repository 從帶時區的時間字串算出，不要直接用 `occurred_at` 文字排序（不同時區的字串順序不等於時間順序）。

## 臺銀匯率來源

- 從開發機用 curl 或 Node 打 `rate.bot.com.tw`，會拿到 HTTP 200 的「Challenge Validation」HTML 頁面，不是 CSV，所以沒辦法在電腦上用指令驗證網址或下載新的 fixture（請用瀏覽器下載）。手機上 App 的 `fetch` 可以正常拿到 CSV（2026-10-16 實機確認）。萬一 App 也被擋，parser 會判定為格式錯誤，流程會退回快取。

## 測試

- 測試檔一律用 `.test.ts`（元件用 `.test.tsx`）結尾，不要用 jest-expo 文件範例的 `-test.ts`。
- `eslint.config.js` 用 `*.test.ts(x)` 判斷測試檔，讓測試檔不受 `domain/` 的 layer 限制（React Native 限制仍然有效）；檔名不符就會被當成一般檔案擋下。
- `data/fx/__fixtures__/*.csv` 是從臺銀直接下載的原始檔，保留 BOM 和 CRLF，用來測試 parser 的容錯，不要用編輯器重新存檔。
- 資料庫測試用的 better-sqlite3 需要 Node 22 以上；用 Node 20 跑多個 Jest worker 會直接 SIGSEGV，沒有錯誤訊息。IDE 的 Jest 外掛若用 nvm 預設版本，要確認預設是 22。
- `tsconfig.json` 的 `types` 只有 `jest`，要用 Node API 的測試輔助檔（例如 `botFixtures.ts`）需要在檔案開頭加 `/// <reference types="node" />`。
