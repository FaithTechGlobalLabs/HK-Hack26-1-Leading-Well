# 產品需求文件（PRD）：Care Group Copilot

> 本文為 [PRD.md](PRD.md) 的繁體中文全文翻譯。欄位名稱、枚舉值、API 路徑、SQL 與測試腳本保留英文原文，以便與開發實作對照。

## 1. 執行願景與架構高度

### 1.1 策略成果（「目標背後的目標」）

小組組長每一季開始前，往往要花好幾個小時去猜哪些主題、討論形式和屬靈主題適合組員；而組員如果知道自己的名字會跟 AI 處理的記錄綁在一起，就不太敢分享脆弱的生活掙扎或代禱需要。

**Care Group Copilot** 的目標不只是做一個套上大型語言模型（LLM）的電子問卷。這個系統要建立一個**零知識牧養智能引擎**：在資料進入系統的那一刻，就把組員身份和組員的脆弱處境分開；把匿名化後的人生階段、信仰階段、偏好和代禱信號，轉化為小組層面的情境洞察；並生成可以直接執行、按週排好的季度計劃，讓組長在幾分鐘內審閱、調整並批准。

### 1.2 現狀與未來營運模式對比

| **面向** | **現狀（人手準備小組）** | **未來（Care Group Copilot MVP）** |
|---|---|---|
| **收集組員背景** | 非正式的關心問候或試算表；組員因為擔心隱私，會自我審查敏感的掙扎。 | 無需帳號的手機網頁連結／QR code 填寫，收集人口資料、人生階段、信仰階段和匿名代禱。 |
| **隱私與資料處理** | 真實姓名和個人筆記一起留在聊天記錄或組長的筆記本裡。 | **嚴格不可關聯的匿名**：沒有組員帳號、去除網絡元數據、在資料發送給 AI 前自動清除個人身份資訊（PII）。 |
| **代禱可見度** | 散落在冗長的群組聊天中，緊急的事項容易被淹沒。 | 專屬的**小組代禱牆**，顯示自動歸納的主題和去識別化的代禱卡，讓組員可以彼此代禱。 |
| **季度規劃** | 組長花 2 到 4 小時人手研究主題、撰寫每週議程。 | AI 綜合所有匿名化的小組信號，生成結構化的**按週季度計劃**（兼顧短期與長期），交由組長批准。 |

### 1.3 SMART 業務目標與成功指標

| **目標編號** | **業務目標** | **關鍵績效指標（KPI）** | **目標值（上線後 90 天）** | **量度方式** |
|---|---|---|---|---|
| **OBJ-01** | 大幅減少組長的季度準備工作量 | 從停止收集到計劃獲批准的時間中位數 | **≤ 30 分鐘**（比 2 小時基線減少 ≥ 75%） | 伺服器記錄組長操作時間戳 |
| **OBJ-02** | 透過心理安全感，讓組員最大程度坦誠 | 每個活躍小組的匿名填寫完成率 | 受邀組員中 **≥ 80%** 提交 | 提交數目對比組長申報的小組人數 |
| **OBJ-03** | 保證外部 LLM 接觸不到任何 PII | PII 洩露到 LLM 提示詞或持久儲存的比率 | **0.00%**（姓名、電話、郵箱、地址 100% 清除） | 自動化紅隊正則／NER 稽核測試 |
| **OBJ-04** | 交付實用、貼合情境的季度計劃 | 組長無需整份重新生成就批准計劃的比率 | **≥ 85%** 在修改不超過 3 週內容的情況下獲批准 | 計劃狀態轉換及修改差異記錄 |

### 1.4 三大基礎架構決策與取捨

1. **嚴格不可關聯的一次性提交模型 vs. 可長期追蹤的假名代號：**
   - **決策：** 強制採用嚴格不可關聯的提交方式：沒有組員帳號、沒有持久 cookie 或 localStorage 識別碼、不跨季度關聯同一位用戶。
   - **取捨：** 系統放棄追蹤個別組員跨季度的屬靈成長，換來的是在數學上無法進行身份關聯，也消除了組員害怕被 AI 建立個人檔案的顧慮。長期洞察改為在*小組整體層面*、透過各季度的快照來計算。
2. **在發送給 LLM 之前，於伺服器端用本地 NER + 確定性正則清除 PII：**
   - **決策：** 每一段自由文字在寫入數據庫或呼叫任何外部 LLM API *之前*，都必須先經過一個隔離、本地部署的 PII 清除器（命名實體識別 NER + 確定性規則）。未清除的原始文字永遠不會寫入硬碟或應用程式日誌。
   - **取捨：** 每次提交會增加約 150 至 300 毫秒的伺服器 CPU 延遲，並需要容器記憶體（NER 模型約 1.5 GB），但可以杜絕第三方接觸 PII，並符合嚴格的隱私期望。
3. **人工審核的結構化計劃生成 vs. 自主運作的組員聊天機械人：**
   - **決策：** AI 只用於後端資料匯總和生成結構化 JSON 計劃，並由組長審核。MVP 不包含任何訊息機械人（WhatsApp/Telegram），也不讓組員直接和 AI 對話。
   - **取捨：** 組長需要手動把匯出的計劃複製或分享到現有的群組聊天，但這避免了機械人 API 的審批瓶頸、牧養關懷中的對話幻覺風險，以及 MVP 期間維護多平台 webhook 的負擔。

## 2. 範圍邊界、角色與系統流程

### 2.1 MVP 範圍定義

**範圍內（v1.0 MVP）：**

- **組長認證與小組管理：** 組長使用免密碼的魔法連結（magic link）登錄；建立小組（Care Group）和季度收集週期；生成可分享的手機網址和 QR code。
- **嚴格不可關聯的組員填寫流程（手機網頁）：** 以手機為優先的三部分填寫，包括 (1) 基本資料（人口資料、人生階段、信仰階段）、(2) 季度小組偏好（主題、形式、頻率、聯誼與查經的比例）、(3) 匿名代禱事項（短期緊急需要和長期的生活／屬靈負擔）。
- **自動化 PII 清除流程：** 客戶端即時溫和提示，加上強制的伺服器端 NER／正則清除，之後才儲存和交給 AI 處理。
- **小組代禱牆：** 透過小組連結進入的唯讀手機網頁，顯示 AI 歸類的代禱主題，以及每項代禱經去識別化的簡短內容。
- **AI 按週季度計劃引擎：** 根據小組的人口組成、人生／信仰階段、季度偏好和代禱負擔，按情境生成結構化的 4 至 12 週季度計劃。
- **組長審閱、即時編輯與匯出：** 組長介面可以查看匯總後的小組洞察、即時編輯每週主題／問題／活動、批准最終計劃，並匯出為乾淨的文字／Markdown／PDF 以便分享。

**明確不在範圍內（延後到 MVP 之後）：**

- 訊息平台機械人整合（WhatsApp、Telegram、LINE、Discord、Slack）。
- 組員帳號、登錄、密碼找回或組員個人檔案。
- 跨季度追蹤個別組員。
- 讓組員直接與 AI 對話。
- 自動 SMS／郵件提醒群發或日曆邀請。

### 2.2 角色與存取控制矩陣

| **角色類型** | **角色名稱** | **認證機制** | **允許的功能** | **限制邊界** |
|---|---|---|---|---|
| **主要人類角色** | **小組組長** | 郵件魔法連結／OAuth（JWT 工作階段） | 建立小組／季度；設定人數；結束收集；查看匯總洞察和代禱牆；觸發／編輯／批准／匯出計劃。 | 不能查看未清除的原始提交；不能查看 IP 地址、確切時間戳或提交之間的關聯。 |
| **主要人類角色** | **小組組員** | 免認證的能力代號（透過網址／QR code 的 intake_token） | 提交匿名基本資料、季度偏好和代禱事項；查看小組代禱牆。 | 不能進入組長面板、小組分析或未批准的 AI 計劃草稿。 |
| **內部系統角色** | **PII 清除閘** | 內部服務網格／本地程序 | 檢查自由文字輸入，清除實體（[PERSON]、[PHONE]、[EMAIL]、[ADDRESS]），輸出清除後的文字。 | 無狀態；禁止把原始輸入寫入硬碟、遙測或錯誤日誌。 |
| **外部系統角色** | **LLM 生成引擎** | API 金鑰（零資料保留端點） | 接收匯總後的小組統計和已清除的代禱語料；回傳經結構驗證的按週 JSON 計劃。 | 不能直接存取數據庫或原始用戶請求。 |

### 2.3 端到端系統架構與資料流

```text
+------------------+       +-----------------------+       +------------------------+
| Care Group Member|       |  API Gateway / Edge   |       |  PII Redaction Gate    |
| (Mobile Browser) |       |  (Strip IP/UserAgent) |       |  (Local NER + Regex)   |
+--------+---------+       +-----------+-----------+       +-----------+------------+
         |                             |                               |
         | 1. POST /intake (Raw JSON)  |                               |
         +---------------------------->| 2. Forward stripped payload   |
         |                             +------------------------------>|
         |                             |                               | 3. Scrub PII entities
         |                             |                               |    (Never log raw text)
         |                             |       4. Persist Sanitized    |
         |                             |          Record + Jitter Time |
         |                             |<------------------------------+
         | 5. 201 Created (No Cookie)  |                               |
         |<----------------------------+                               |
         |                                                             |
+--------+---------+       +-----------------------+       +-----------+------------+
| Care Group Leader|       |   PostgreSQL (ZDR)    |       |  LLM Synthesis Engine  |
| (Mobile/Desktop) |       |   (Unlinked Tables)   |       |  (Structured JSON Out) |
+--------+---------+       +-----------+-----------+       +-----------+------------+
         |                             |                               |
         | 6. POST /seasons/:id/generate                               |
         +---------------------------->| 7. Fetch Cohort Stats +       |
         |                             |    Redacted Prayers (N >= 3)  |
         |                             +------------------------------>|
         |                             |                               | 8. Synthesize Weekly
         |                             |       9. Save Draft Plan      |    Plan (Short & Long
         |                             |<------------------------------+    Term Alignment)
         | 10. Render Draft Plan &     |                               |
         |     Prayer Themes for Edit  |                               |
         |<----------------------------+                               |
         | 11. Inline Edit & Approve   |                               |
         +---------------------------->| 12. Lock Plan & Enable Export |
```

**圖中步驟說明：**

| 步驟 | 說明 |
|---|---|
| 1 | 組員（手機瀏覽器）把原始 JSON 提交到 `POST /intake` |
| 2 | API 閘道／邊緣層去除 IP 和 User-Agent 後轉發 |
| 3 | PII 清除閘（本地 NER + 正則）清除個人實體，絕不記錄原始文字 |
| 4 | 儲存清除後的記錄，並對時間做隨機偏移 |
| 5 | 回傳 201 Created，不設任何 cookie |
| 6 | 組長（手機／電腦）呼叫 `POST /seasons/:id/generate` |
| 7 | 讀取小組統計和已清除的代禱（需 N ≥ 3） |
| 8 | LLM 生成引擎產出按週計劃（兼顧短期與長期） |
| 9 | 儲存計劃草稿 |
| 10 | 顯示計劃草稿和代禱主題供編輯 |
| 11 | 組長即時編輯並批准 |
| 12 | 鎖定計劃並開放匯出 |

## 3. 業務需求（BR-01 至 BR-07）

| **需求編號** | **業務需求陳述** | **理由與來源** | **優先級** | **驗收基準** |
|---|---|---|---|---|
| **BR-01** | 系統應讓組員無需建立帳號或附上姓名，即可提交基本資料、季度偏好和代禱事項。 | 消除組員對個人資料被餵給 AI 的恐懼，提高坦誠度和參與度。 | 必須有（P0） | 組員提交的資料中不儲存任何 PII 或工作階段識別碼。 |
| **BR-02** | 系統應收集結構化的組員基本資料，涵蓋人口資料、人生階段和信仰階段。 | 提供小組背景基礎，讓季度課程符合組員實際的成熟度和人生階段。 | 必須有（P0） | 每季都收集並匯總全部 3 個基本資料面向。 |
| **BR-03** | 系統應收集組員對下一季小組的偏好（主題、查經與團契的比例、活動）。 | 讓小組方向貼合組員的意願，而不是由組長自上而下地猜測。 | 必須有（P0） | 結構化的偏好分佈可供 AI 引擎使用。 |
| **BR-04** | 系統應收集匿名的自由文字代禱事項，並在交給 AI 或儲存之前清除所有 PII。 | 代禱事項反映了眼前的生活和屬靈挑戰，能給 AI 深入的背景，同時保護組員隱私。 | 必須有（P0） | 寫入數據庫前，測試用 PII 語料 100% 被清除。 |
| **BR-05** | 系統應顯示共享的小組代禱牆，呈現歸納後的主題和每項代禱經去識別化的簡短內容。 | 讓組員能有意義地彼此代禱，也讓組長了解小組的負擔。 | 必須有（P0） | 代禱牆顯示主題和去識別化卡片，不洩露身份。 |
| **BR-06** | 系統應把所有匿名化的基本資料、偏好和代禱資料，綜合成結構化的按週季度計劃。 | 直接減輕組長的準備負擔，同時讓短期和長期的聚會內容貼合組員需要。 | 必須有（P0） | 15 秒內生成完整的 W 週 JSON 議程。 |
| **BR-07** | 系統應要求組長明確審閱、可以即時編輯並批准，季度計劃才能定稿和匯出。 | 保留牧養監督、神學一致性和人對 AI 生成內容的問責。 | 必須有（P0） | 組長觸發「批准」之前，計劃一直處於草稿狀態。 |

## 4. 詳細功能需求（FR-01 至 FR-08）

### 模組 A：組長的小組與季度設置

**FR-01：建立小組與季度收集**

- **對應業務需求：** BR-01、BR-07
- **主要角色：** 小組組長
- **前置條件：** 組長已透過有效的魔法連結工作階段登錄。
- **輸入：** group_name（字串）、expected_headcount（整數，3–50）、season_title（字串）、duration_weeks（整數，4–12）、meeting_cadence（枚舉：WEEKLY 每週、BIWEEKLY 隔週）、intake_deadline（ISO-8601 日期）。
- **處理邏輯：**
   1. 驗證輸入限制，並生成一個加密安全、無法猜測的隨機 intake_token（128 位元、URL 安全的 Base64 字串）。
   2. 建立 care_group 和 season 記錄，狀態設為 INTAKE_OPEN（收集中）。
   3. 生成適合手機的分享路徑（/g/{intake_token}）和 SVG 格式的 QR code。
- **輸出：**
   - *成功：* HTTP 201，回傳季度面板，提供一鍵「複製邀請連結」和可下載的 QR code。
   - *錯誤：* 如果 duration_weeks 不在 [4, 12] 範圍內，或 expected_headcount < 3，回傳 HTTP 400 和欄位級別的驗證錯誤。

### 模組 B：嚴格不可關聯的組員填寫（手機優先網頁）

**FR-02：免認證的組員基本資料收集**

- **對應業務需求：** BR-01、BR-02
- **主要角色：** 小組組員
- **前置條件：** 組員在季度狀態為 INTAKE_OPEN 時，打開有效的 /g/{intake_token} 路徑。
- **輸入：**
   - age_bracket（年齡段）：枚舉（18-24、25-34、35-44、45-54、55+、PREFER_NOT_TO_SAY 不願透露）
   - life_stages（人生階段）：多選枚舉（SINGLE 單身、DATING_ENGAGED 拍拖／訂婚、NEWLY_MARRIED 新婚、PARENTING_YOUNG_KIDS 養育年幼子女、PARENTING_TEENS 養育青少年、EMPTY_NESTER 子女已離家、CAREGIVING_PARENTS 照顧父母、CAREER_TRANSITION 職業轉換、STUDENT 學生、RETIRED 退休）
   - faith_stage（信仰階段）：單選枚舉（EXPLORING_SEEKING 探索／慕道、NEW_BELIEVER 初信、GROWING_CONSISTENT 穩定成長、DEEPENING_MATURE 深化成熟、FEELING_DRY_BURNT_OUT 乾涸／耗盡、RETURNING_RECONNECTING 回歸／重新連結）
- **處理邏輯：**
   1. 顯示以手機為優先的分步介面（第 1 步，共 3 步），無需登錄或任何個人識別資料。
   2. 第 1 步的選擇只保留在瀏覽器記憶體中（React state／sessionStorage，提交後清除），直到 3 步填寫全部完成才一次提交。這樣每位組員的背景資料能跟他的季度偏好和代禱事項綁在同一份原子提交裡，但完全不會識別出這位組員*是誰*。
- **輸出：** 介面前進到第 2 步（季度偏好）。

**FR-03：季度小組偏好收集**

- **對應業務需求：** BR-03
- **主要角色：** 小組組員
- **前置條件：** 在目前的填寫流程中已完成第 1 步。
- **輸入：**
   - desired_topics（想學的主題）：從精選標籤中多選（最多 3 個）（BOOK_OF_BIBLE_STUDY 書卷查經、PRAYER_AND_SPIRITUAL_DISCIPLINES 禱告與屬靈操練、WORK_AND_FAITH 工作與信仰、RELATIONSHIPS_AND_FAMILY 關係與家庭、ANXIETY_AND_MENTAL_RESILIENCE 焦慮與心理韌性、APOLOGETICS_AND_DOUBT 護教與疑惑、SERVING_AND_OUTREACH 服事與外展、TOPICAL_SERIES 專題系列），另可加一個自訂主題標籤（最多 60 字元，會清除 PII）。
   - session_format_ratio（聚會形式比例）：滑桿（1 = 深度查經，到 5 = 關係分享與團契）。
   - social_gathering_interest（聯誼活動意願）：枚舉（NONE 不需要、ONCE_PER_SEASON 每季一次、MONTHLY 每月）。
- **處理邏輯：** 驗證選擇，並把填寫流程推進到第 3 步（匿名代禱事項）。
- **輸出：** 介面前進到第 3 步。

**FR-04：匿名代禱提交與即時隱私提示**

- **對應業務需求：** BR-01、BR-04
- **主要角色：** 小組組員
- **前置條件：** 在目前的填寫流程中已完成第 2 步。
- **輸入：** prayer_items：0 至 3 個代禱物件的陣列，每個包含：
   - category（類別）：枚舉（HEALTH_HEALING 健康醫治、WORK_FINANCES 工作財務、FAMILY_RELATIONSHIPS 家庭關係、SPIRITUAL_GROWTH 屬靈成長、ANXIETY_PEACE 焦慮與平安、GRATITUDE_PRAISE 感恩讚美、OTHER 其他）
   - time_horizon（時間範圍）：枚舉（IMMEDIATE_SHORT_TERM 即時／短期、ONGOING_LONG_TERM 持續／長期）
   - raw_text（原始文字）：自由文字（每項代禱最多 500 字元）
   - share_on_board（是否分享到代禱牆）：布林值（預設為 true；組員可以選擇清除後的代禱是否出現在共享的小組代禱牆上，或*只*作為 AI 季度規劃的私密背景）。
- **處理邏輯：**
   1. **客戶端溫和提示：** 用戶在 raw_text 中輸入時，在本地用輕量正則檢查大寫的雙詞人名模式、電話號碼或郵箱；顯示一個不阻擋操作的提示標籤：*「隱私提示：請避免使用真實姓名——我們的過濾器會在儲存前自動遮蓋姓名和聯絡方式。」*
   2. **原子提交（POST /api/v1/intake/{intake_token}）：** 邊緣代理在把資料轉發給後端之前，去除 X-Forwarded-For、CF-Connecting-IP、User-Agent 和 Referer 標頭。
   3. **伺服器端 PII 清除：** 後端把 custom_topic 和每一段 raw_text 交給 PII 清除閘處理（FR-05）。
   4. **時間戳偏移：** 對 created_at 加上隨機的時間偏移（在收集期間內 ±12 小時），讓組長無法把提交時間和看到某位組員用手機的時間對應起來。
   5. **持久化：** 在同一個數據庫交易中寫入清除後的 anonymous_submission 和 redacted_prayer_items，並立即從記憶體中丟棄原始資料。
- **輸出：**
   - *成功：* HTTP 201，回傳確認畫面，附上直接前往小組代禱牆的連結。
   - *錯誤：* 如果內容超出字數限制，回傳 HTTP 422；如果季度狀態已不是 INTAKE_OPEN，回傳 403。

**FR-05：自動化 PII 清除流程**

- **對應業務需求：** BR-04
- **主要角色：** PII 清除閘（系統）
- **前置條件：** 收到來自 FR-03 或 FR-04 的自由文字。
- **輸入：** raw_text（字串）。
- **處理邏輯：**
   1. 執行確定性的正則處理，把郵箱替換為 [EMAIL]、電話號碼替換為 [PHONE]、網址替換為 [LINK]、街道／單位號碼替換為 [ADDRESS]。
   2. 執行本地 NER 模型（Microsoft Presidio + spaCy en_core_web_trf／多語言 NER），偵測 PERSON（人名）、ORG（機構）、GPE（具體社區／工作地點）和 DATE_OF_BIRTH（出生日期）。
   3. 在同一份提交中，把偵測到的人名替換為一致、保留上下文的代號（例如 *"Pray for Sarah and Sarah's mom"* → *"Pray for [Person A] and [Person A]'s mom"*）。
   4. 為公開的小組代禱牆生成 brief_board_summary（簡短摘要，最多 140 字元，去除具體的情境識別資訊，但保留代禱負擔）。
- **輸出：** sanitized_text（清除後文字，供 AI 規劃使用）、brief_board_summary（供代禱牆使用）和 redaction_count（清除數量，僅作整數元數據）。

### 模組 C：小組代禱牆與主題歸納

**FR-06：顯示小組代禱牆**

- **對應業務需求：** BR-05
- **主要角色：** 小組組員、小組組長
- **前置條件：** 本季總提交數 ≥ 3（達到 k-匿名門檻）。
- **輸入：** intake_token（組長則用已認證的 season_id）。
- **處理邏輯：**
   1. 如果總提交數 < 3，顯示隱私保護提示：*「為保護大家的匿名性，至少 3 位組員提交後才會開放代禱牆。」*
   2. 提交數 ≥ 3 時，查詢所有 share_on_board = true 的 redacted_prayer_items。
   3. 按類別和 LLM 生成的**歸納主題標題**分組（例如 *「面對職業轉換與財務平安（4 項代禱）」*、*「家人健康與照顧者的力量（3 項代禱）」*）。
   4. 顯示每個主題區塊，下面是去識別化的簡短代禱卡（brief_board_summary + 時間範圍標記），並附有可互動的*「我已代禱」*計數器（以整數累加儲存，完全不追蹤用戶）。
- **輸出：** 以手機為優先的小組代禱牆，顯示主題分組和去識別化的代禱卡。

### 模組 D：AI 季度計劃生成與組長批准

**FR-07：按情境生成按週季度計劃**

- **對應業務需求：** BR-06
- **主要角色：** 小組組長（觸發）→ LLM 生成引擎
- **前置條件：** 組長已登錄；本季提交數 ≥ 3；組長點擊**「生成季度計劃」**（或**「按指引重新生成」**）。
- **輸入：**
   - 匯總後的小組分佈（年齡段、人生階段、信仰階段、形式滑桿平均值、最多人想學的主題）。
   - 全部 sanitized_text 代禱語料（包括 IMMEDIATE_SHORT_TERM 和 ONGOING_LONG_TERM 兩種時間範圍，也包括標記為 share_on_board = false 的項目）。
   - duration_weeks（W ∈ [4, 12]）和可選的 leader_steering_note（組長指引，例如 *「以雅各書為主，同時處理焦慮和育兒倦怠」*）。
- **處理邏輯：**
   1. 構建結構化的系統提示詞，指示 LLM 扮演一位有經驗的小組課程設計者。
   2. 強制**雙時間範圍校準**：
      - **第 1–3 週（短期校準）：** 直接回應緊急的 IMMEDIATE_SHORT_TERM 代禱負擔，建立心理安全感，並配合小組的 session_format_ratio。
      - **第 4 週至第 W 週（長期主線）：** 根據小組的 faith_stage 分佈和 ONGOING_LONG_TERM 人生階段挑戰，逐步建立屬靈深度。
   3. 強制輸出嚴格的 JSON 結構，包含 seasonal_arc_summary（季度主線摘要）和 weeks[]（長度正好是 W），每個週物件包含：week_number（週數）、title（標題）、core_theme（核心主題）、cohort_alignment_note（與小組情況的對應說明）、icebreaker（破冰）、scripture_or_reading_anchor（經文或閱讀依據）、discussion_questions（3–4 個開放式討論題）、group_prayer_focus（小組禱告重點）和 suggested_activity_or_social（建議活動或聯誼）。
   4. 用 JSON Schema 驗證輸出；結構不符時最多重試 2 次，之後才顯示友善的錯誤訊息。
- **輸出：** 儲存為 LEADER_REVIEW（組長審閱中）狀態的 seasonal_plan，並在組長工作台顯示結構化的按週時間線。

**FR-08：組長即時編輯計劃、批准鎖定與匯出**

- **對應業務需求：** BR-07
- **主要角色：** 小組組長
- **前置條件：** 已有處於 LEADER_REVIEW 狀態的 seasonal_plan。
- **輸入：** 組長對任何一週的標題、破冰、討論題、小組禱告重點的即時編輯，調整週次順序，或對單一週重新用 AI 生成（POST /api/v1/plans/{plan_id}/weeks/{week_num}/regenerate）。
- **處理邏輯：**
   1. 透過防抖（debounced）的 PATCH 請求自動儲存即時編輯。
   2. 組長點擊**「批准季度計劃」**時，把季度狀態轉為 APPROVED_ACTIVE（已批准、進行中），鎖定收集、不再接受新提交，並保存批准版本的快照（v1.0-approved）。
   3. 提供為手機分享優化的一鍵匯出格式：複製完整計劃（WhatsApp/Telegram 格式文字）、複製單週議程，以及下載可列印的 PDF。
- **輸出：** 已鎖定的 APPROVED_ACTIVE 季度計劃，以及可以直接分享的格式化內容。

## 5. 業務規則、決策邏輯與狀態轉換

### 5.1 業務規則與決策邏輯矩陣

| **規則編號** | **類別** | **條件（如果）** | **系統動作（那麼）** | **理由** |
|---|---|---|---|---|
| **BRULE-01** | 隱私／k-匿名 | submitted_cohort_count < 3 | 禁止顯示分項的基本資料圖表、代禱牆卡片和 AI 計劃生成。 | 防止組長在只有 1 或 2 份回應的小組中推斷出是誰寫的。 |
| **BRULE-02** | 隱私／邊緣去除 | 任何 HTTP 請求進入 /api/v1/intake/* 或 /api/v1/board/* | 反向代理在進入應用路由前，把 IP、User-Agent 和 Referer 標頭覆寫為空值。 | 保證網絡層面完全無法關聯身份。 |
| **BRULE-03** | 安全／危機防護 | raw_text 觸發高置信度的自我傷害或即時受虐分類器 | 照常清除 PII；在組長面板顯示匿名警示橫幅，並附上本地危機求助熱線。 | 在不破壞匿名性的前提下保護組員安全。 |
| **BRULE-04** | AI 生成配額 | 組長在一季內整份重新生成超過 5 次 | 停用整份重新生成按鈕；仍允許針對單週重新生成（每季最多 10 次）。 | 控制 LLM API 的 token 開支，同時保留組長的彈性。 |
| **BRULE-05** | 收集生命週期 | 季度轉為 APPROVED_ACTIVE | 對 /intake/{token} 的新組員提交回傳 410 Gone；代禱牆仍可閱讀。 | 組長確定季度安排後，凍結規劃基礎。 |

### 5.2 季度生命週期狀態轉換矩陣

| **目前狀態** | **觸發事件** | **守衛條件** | **下一個狀態** | **系統自動動作** |
|---|---|---|---|---|
| DRAFT（草稿） | 組長發佈季度 | duration_weeks 和標題有效 | INTAKE_OPEN | 啟用 intake_token 網址和 QR code。 |
| INTAKE_OPEN（收集中） | 組員提交填寫 | 資料有效且已清除 PII | INTAKE_OPEN | submission_count 加一；如果數目 ≥ 3，更新代禱牆主題。 |
| INTAKE_OPEN | 組長點擊「生成計劃」 | submission_count ≥ 3 | LEADER_REVIEW | 執行 FR-07 AI 生成；儲存按週計劃草稿。 |
| LEADER_REVIEW（組長審閱中） | 組長即時編輯某一週 | 計劃尚未批准 | LEADER_REVIEW | 自動儲存欄位差異；保留編輯歷史。 |
| LEADER_REVIEW | 組長點擊「批准計劃」 | 全部 W 週都不為空 | APPROVED_ACTIVE | 鎖定計劃版本；關閉收集網址；開放 WhatsApp/PDF 匯出。 |
| APPROVED_ACTIVE（已批准、進行中） | 季度結束日 + 14 天 | 定時清理任務執行 | ARCHIVED（已封存） | 保留匯總統計和已批准的計劃；按保留政策刪除逐項的自由文字代禱。 |

## 6. 資料字典、驗證規則與隱私結構

### 6.1 核心關聯式結構（零 PII 架構）

```sql
-- 1. Authenticated Leaders Only (Zero Member Records Exist in DB)
CREATE TABLE leaders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_hash TEXT UNIQUE NOT NULL,
    encrypted_email TEXT NOT NULL,
    display_name VARCHAR(80) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Care Groups
CREATE TABLE care_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leader_id UUID NOT NULL REFERENCES leaders(id) ON DELETE CASCADE,
    group_name VARCHAR(100) NOT NULL,
    expected_headcount SMALLINT NOT NULL CHECK (expected_headcount BETWEEN 3 AND 50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Seasonal Cycles
CREATE TABLE seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES care_groups(id) ON DELETE CASCADE,
    title VARCHAR(120) NOT NULL,
    intake_token VARCHAR(64) UNIQUE NOT NULL,
    duration_weeks SMALLINT NOT NULL CHECK (duration_weeks BETWEEN 4 AND 12),
    meeting_cadence VARCHAR(16) NOT NULL CHECK (meeting_cadence IN ('WEEKLY', 'BIWEEKLY')),
    status VARCHAR(24) NOT NULL DEFAULT 'INTAKE_OPEN',
    regeneration_count SMALLINT NOT NULL DEFAULT 0,
    intake_deadline TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Strictly Unlinked Anonymous Submissions (NO user_id, NO ip_address, NO device_id)
CREATE TABLE anonymous_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    age_bracket VARCHAR(24) NOT NULL,
    life_stages JSONB NOT NULL,          -- Array of validated life-stage enums
    faith_stage VARCHAR(32) NOT NULL,
    desired_topics JSONB NOT NULL,       -- Array of topic enums + PII-scrubbed custom topic
    session_format_ratio SMALLINT NOT NULL CHECK (session_format_ratio BETWEEN 1 AND 5),
    social_gathering_interest VARCHAR(24) NOT NULL,
    jittered_submitted_at TIMESTAMPTZ NOT NULL -- Randomized +/- 12h window
);

-- 5. Sanitized Prayer Requests (Post-PII Redaction Gate Only)
CREATE TABLE redacted_prayer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES anonymous_submissions(id) ON DELETE CASCADE,
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    category VARCHAR(32) NOT NULL,
    theme_cluster VARCHAR(100),          -- AI-assigned theme label for Prayer Board
    time_horizon VARCHAR(24) NOT NULL CHECK (time_horizon IN ('IMMEDIATE_SHORT_TERM', 'ONGOING_LONG_TERM')),
    sanitized_text TEXT NOT NULL,        -- Used for AI seasonal plan fine-tuning
    brief_board_summary VARCHAR(160) NOT NULL, -- Displayed on shared Group Prayer Board
    share_on_board BOOLEAN NOT NULL DEFAULT TRUE,
    prayed_count INTEGER NOT NULL DEFAULT 0
);

-- 6. AI-Generated & Leader-Approved Seasonal Plans
CREATE TABLE seasonal_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID UNIQUE NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    seasonal_arc_summary TEXT NOT NULL,
    weeks_json JSONB NOT NULL,           -- Structured array of W week objects
    is_approved BOOLEAN NOT NULL DEFAULT FALSE,
    approved_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**資料表說明：**

| 資料表 | 用途 |
|---|---|
| leaders | 只有已認證的組長（數據庫裡不存在任何組員記錄）；郵箱以雜湊和加密形式儲存 |
| care_groups | 小組，人數限制在 3 至 50 之間 |
| seasons | 季度週期，包括收集代號、週數（4–12）、頻率、狀態和重新生成次數 |
| anonymous_submissions | 嚴格不可關聯的匿名提交（沒有 user_id、ip_address、device_id）；提交時間經 ±12 小時隨機偏移 |
| redacted_prayer_items | 經 PII 清除閘處理後的代禱事項，包括 AI 指派的主題、清除後文字、代禱牆摘要和代禱次數 |
| seasonal_plans | AI 生成、組長批准的季度計劃，按週內容以 JSON 儲存 |

### 6.2 欄位級資料字典與驗證規則

| **欄位名稱** | **資料類型** | **必填** | **驗證限制** | **顯示給用戶的錯誤訊息** |
|---|---|---|---|---|
| group_name | VARCHAR(100) | 是 | 最少 2、最多 100 字元，去除前後空白 | 「請輸入 2 至 100 字元的小組名稱。」 |
| duration_weeks | SMALLINT | 是 | 整數 ∈ [4, 12] | 「季度計劃必須為 4 至 12 週。」 |
| life_stages | JSONB（陣列） | 是 | 1 ≤ 長度 ≤ 4，值 ∈ LifeStageEnum | 「請選擇 1 至 4 個目前的人生階段。」 |
| faith_stage | VARCHAR(32) | 是 | 必須完全符合 FaithStageEnum 的其中一項 | 「請選擇最能描述你目前信仰旅程的選項。」 |
| desired_topics | JSONB（陣列） | 是 | 1 ≤ 長度 ≤ 3 | 「請至少選擇 1 個你希望小組本季探討的主題。」 |
| prayer_items[].raw_text | TEXT | 視情況 | 陣列長度 > 0 時必填；10 ≤ 長度 ≤ 500 | 「每項代禱請保持在 10 至 500 字元之間。」 |

## 7. 詳細用例與 BDD 驗收標準

### UC-01：組員提交匿名基本資料、偏好與代禱事項

- **角色：** 小組組員（主要）、PII 清除閘（系統）
- **前置條件：** 組長已建立季度 S1（status = INTAKE_OPEN）並分享了連結 /g/{token}。
- **主要流程：**
   1. 組員在手機上點開 /g/{token}；應用在 1.5 秒內載入，沒有登錄門檻。
   2. 組員完成第 1 步（年齡段、人生階段、信仰階段）、第 2 步（想學的主題、查經／團契滑桿、聯誼偏好）和第 3 步（2 項代禱：一項是短期的工作焦慮，提到一位同事的名字 *"David"*；另一項是長期的屬靈成長）。
   3. 組員點擊**「匿名提交」**。
   4. 邊緣代理去除 IP／User-Agent 標頭；PII 清除閘把 *"David"* 遮蓋為 *"[Person A]"*，並生成 brief_board_summary。
   5. 數據庫以偏移後的時間戳儲存清除後的記錄；組員看到確認畫面和前往小組代禱牆的連結。
- **例外流程（E1：季度已關閉）：** 如果組長已經批准了季度計劃（APPROVED_ACTIVE），組員會看到友善的提示（*「本季的規劃收集已經結束，但你仍然可以在下方查看並為小組的代禱牆禱告」*），並有直接前往代禱牆的按鈕。

### UC-02：組長生成、微調並批准按週季度計劃

- **角色：** 小組組長（主要）、LLM 生成引擎（外部）
- **前置條件：** 季度 S1 已有 7 份匿名提交（達到 ≥ 3 的 k-匿名門檻）。
- **主要流程：**
   1. 組長打開季度面板，查看匯總的小組分佈（例如 *57% 正在養育年幼子女、43% 感到乾涸／耗盡，主要代禱主題：工作壓力與家人健康*）。
   2. 組長點擊**「生成 8 週季度計劃」**。
   3. 系統把小組分佈和所有 sanitized_text 代禱事項交給 LLM 生成引擎。
   4. 12 秒內顯示一份結構化的 8 週計劃：第 1–2 週聚焦休息、從倦怠中恢復和彼此擔當重擔（短期紓緩）；第 3–8 週帶大家走過適合忙碌父母的實用信仰習慣（長期成長）。
   5. 組長即時修改第 3 週的破冰，然後點擊**「批准季度計劃」**。
   6. 計劃鎖定為 APPROVED_ACTIVE；組長點擊**「複製到 WhatsApp」**，把第 1 週的議程分享給小組。

### BDD / Gherkin 驗證情境

```gherkin
Feature: Privacy-First Intake & AI Seasonal Plan Synthesis

  Scenario: PII is stripped before database persistence and LLM prompt construction
    Given a Care Group season is in "INTAKE_OPEN" status
    When an unauthenticated member submits a prayer request containing "Pray for Michael Chen at 555-019-2834 regarding his surgery at Mercy Hospital"
    Then the HTTP response status is 201 Created with zero Set-Cookie headers
    And the persisted "sanitized_text" equals "Pray for [Person A] at [PHONE] regarding his surgery at [ORG]"
    And the raw string "Michael Chen" does not appear anywhere in the database or application logs

  Scenario: K-Anonymity gate prevents deanonymization in under-populated intakes
    Given a Care Group season has only 2 submitted anonymous responses
    When the Care Group Leader or a Member accesses the Group Prayer Board or Plan Generator
    Then the system displays the k-anonymity privacy lock message requiring at least 3 responses
    And the "Generate Seasonal Plan" action remains disabled

  Scenario: AI generates dual-horizon week-by-week plan calibrated to member context
    Given a Care Group season has 6 submissions with 4 "IMMEDIATE_SHORT_TERM" prayers about anxiety and "FEELING_DRY_BURNT_OUT" faith stages
    And the leader configured a 6-week season
    When the leader triggers seasonal plan generation
    Then the system produces a valid JSON plan with exactly 6 sequential week objects
    And Weeks 1 and 2 explicitly address rest and anxiety relief in their "cohort_alignment_note" and "group_prayer_focus"
    And the plan status is set to "LEADER_REVIEW" requiring explicit approval before export
```

**情境中文說明：**

1. **在寫入數據庫和構建 LLM 提示詞前清除 PII**
   - 假設某小組季度處於「INTAKE_OPEN」狀態，
   - 當一位未登錄的組員提交代禱：「Pray for Michael Chen at 555-019-2834 regarding his surgery at Mercy Hospital」（為 Michael Chen 在 Mercy Hospital 的手術禱告，電話 555-019-2834），
   - 那麼 HTTP 回應是 201 Created，且沒有任何 Set-Cookie 標頭；
   - 而且儲存的「sanitized_text」等於「Pray for [Person A] at [PHONE] regarding his surgery at [ORG]」；
   - 而且數據庫和應用日誌中任何地方都不會出現原始字串「Michael Chen」。
2. **k-匿名閘防止在人數不足時被識別**
   - 假設某小組季度只有 2 份匿名提交，
   - 當組長或組員進入小組代禱牆或計劃生成器，
   - 那麼系統顯示 k-匿名隱私鎖定訊息，要求至少 3 份回應；
   - 而且「生成季度計劃」按鈕保持停用。
3. **AI 按組員情況生成雙時間範圍的按週計劃**
   - 假設某小組季度有 6 份提交，其中 4 項是關於焦慮的「IMMEDIATE_SHORT_TERM」代禱，信仰階段為「FEELING_DRY_BURNT_OUT」，
   - 並且組長設定了 6 週的季度，
   - 當組長觸發季度計劃生成，
   - 那麼系統產出有效的 JSON 計劃，正好包含 6 個依序的週物件；
   - 而且第 1 和第 2 週在「cohort_alignment_note」和「group_prayer_focus」中明確處理休息和紓緩焦慮；
   - 而且計劃狀態設為「LEADER_REVIEW」，匯出前必須明確批准。

## 8. 非功能需求（IEEE 830 / ISO 29148 品質目標）

| **品質屬性** | **指標／標準** | **可量度目標** | **驗證方法** |
|---|---|---|---|
| **手機效能** | 最大內容繪製（LCP）與首次輸入延遲 | 模擬 4G 手機上 **LCP ≤ 1.8 秒**；介面互動 **≤ 100 毫秒** | Lighthouse CI 手機稽核與 Playwright 效能分析 |
| **AI 生成延遲** | 端到端按週計劃生成時間 | **p95 ≤ 15.0 秒**，並即時顯示步驟進度 | 以 12 週、25 名組員的合成資料做 API 負載測試 |
| **零知識隱私** | 網絡與儲存元數據衛生 | 組員路徑上 **0** 個 IP 地址、cookie、瀏覽器指紋或第三方分析腳本 | 自動化 OWASP ZAP／標頭檢查與數據庫結構稽核 |
| **PII 清除召回率** | 命名實體和聯絡方式遮蓋的準確度 | 在含有姓名、電話、郵箱和地址的 500 項合成代禱基準測試中，**召回率 ≥ 99.0%** | CI 中的自動化對抗式紅隊測試 |
| **無障礙** | WCAG 2.1 AA 級與手機人體工學 | 對比度 **≥ 4.5:1**；所有可互動控件的觸控範圍 **≥ 48 × 48 像素** | axe-core 自動化無障礙測試 |
| **資料保留** | 自動刪除敏感的代禱文字 | 逐項的 redacted_prayer_items 在**季度結束 14 天後**自動刪除 | 每日 PostgreSQL 定時任務驗證 |

## 9. 建議技術架構、技術棧與成本取捨

### 9.1 主要技術棧建議（為快速 MVP 與嚴格隱私邊界而優化）

- **前端（手機優先網頁應用）：** **Next.js（App Router）+ TypeScript + Tailwind CSS + shadcn/ui**。伺服器端渲染讓手機在教會或咖啡店的弱 Wi-Fi 下也能即時載入；前後端共用 TypeScript 類型，配合 Zod 確保客戶端和伺服器的資料結構嚴格一致。
- **後端 API 與 PII 清除微服務：** **Python（FastAPI）+ Microsoft Presidio（spaCy NER）**，搭配 **PostgreSQL（Supabase 或 Neon）**。在 FastAPI 容器內本地執行 Presidio，可以保證 PII 清除在*你自己的基礎設施內、在記憶體中*完成，之後才寫入數據庫或呼叫外部 API，避免把未清除的代禱文字送到另一個 PII 清除 SaaS。
- **LLM 生成引擎：** 透過零資料保留（ZDR）API 方案使用 **OpenAI（gpt-4o／gpt-4.1，配合 Structured Outputs）或 Anthropic（claude-sonnet-4-5）**。強制的 JSON Schema 確保按週計劃永遠不會令介面渲染出錯，而 ZDR 保證提示詞不會被記錄或用於訓練模型。

### 9.2 可行替代方案與明確取捨

- **可行替代方案：** 純 TypeScript／Node.js 無伺服器技術棧（Vercel Functions + 只用正則的 PII 清除 + 以 LLM 清除 PII）。
- **為何不作為主要建議：** 用外部 LLM 清除 PII，意味著*未清除*的組員姓名和敏感代禱必須先離開你的伺服器，這直接違反了核心的用戶信任承諾。本地 Python NER（Presidio）只需加一個輕量 Docker 容器（在 Railway／Fly.io／Render 上約每月 25），但能保持嚴密的隱私邊界。

### 9.3 營運成本估算與架構轉換條件

- **每月營運成本估算（MVP 試行：100 個活躍小組，約 1,200 名組員）：**
   - 託管 PostgreSQL（Neon／Supabase Pro）：**每月 $25**
   - 容器託管（FastAPI + Presidio NER + Next.js，部署在 Fly.io／Railway）：**每月 45**
   - LLM API 用量（每月約 200 次計劃生成，每次約 4k 輸入／3k 輸出 token）：**每月 15**
   - **總估算運行成本：** **約每月 85**
- **此架構何時不再適用（轉換條件）：** 如果規模超過 **2,500 個同時進行的季度收集**，或需要**多語言 NER**（例如同一段代禱中混合繁體中文、西班牙文、韓文），就應把單節點 spaCy NER 模型換成專用的多語言 transformer 推理端點（ONNX 量化的 XLM-RoBERTa），並加入 Redis 工作隊列（BullMQ／Celery）來非同步生成計劃。

> 譯註：原文第 9.2、9.3 節部分金額缺少 `$` 符號（如「25/mo」「45/mo」「15/mo」「~85 / month」），譯文照原文保留。

## 10. 需求追溯矩陣與團隊分工

### 10.1 端到端需求追溯矩陣（RTM）

| **業務需求編號** | **功能需求編號** | **模組與功能** | **測試用例** | **MVP 優先級** |
|---|---|---|---|---|
| BR-01、BR-07 | FR-01 | 組長認證、建立小組與季度、QR code／連結生成 | TC-01、TC-02 | **P0（關鍵）** |
| BR-01、BR-02 | FR-02 | 免認證組員基本資料（人口資料、人生／信仰階段） | TC-03 | **P0（關鍵）** |
| BR-03 | FR-03 | 季度小組偏好與形式比例收集 | TC-04 | **P0（關鍵）** |
| BR-01、BR-04 | FR-04、FR-05 | 匿名代禱收集 + 邊緣標頭去除 + 本地 NER PII 清除 | TC-05、TC-06 | **P0（關鍵）** |
| BR-06 | FR-07 | AI 按週季度計劃生成（短期與長期） | TC-07、TC-08 | **P0（關鍵）** |
| BR-07 | FR-08 | 組長即時編輯計劃、批准鎖定與 WhatsApp／文字匯出 | TC-09 | **P0（關鍵）** |
| BR-05 | FR-06 | 共享小組代禱牆（主題分組 + 去識別化卡片） | TC-10、TC-11 | **P1（MVP 完整版）** |
| BR-04、BR-07 | FR-08 | 可列印 PDF 匯出與單週 AI 重新生成 | TC-12 | **P2（緊隨其後）** |

### 10.2 並行團隊工作線分工（可直接分派給開發者）

1. **工作線 1：隱私與後端核心（FR-01、FR-04、FR-05）：**
   - *範圍：* PostgreSQL 零 PII 資料結構、反向代理標頭去除、FastAPI 端點、Presidio NER + 正則 PII 清除流程、k-匿名防護（N ≥ 3）。
   - *完成定義：* 植入 100 個姓名／電話／郵箱的對抗式測試全部通過，數據庫和日誌中零洩露。
2. **工作線 2：組員手機填寫與代禱牆（FR-02、FR-03、FR-04、FR-06）：**
   - *範圍：* 以手機為優先的 3 步填寫流程、客戶端即時隱私提示標籤、無 cookie 提交處理，以及帶主題分組和*「我已代禱」*計數器的小組代禱牆介面。
   - *完成定義：* Lighthouse 手機分數 ≥ 95；在 375 像素寬的手機畫面上，3 步填寫可在 2 分鐘內完成。
3. **工作線 3：AI 季度計劃生成引擎（FR-06 主題歸類、FR-07）：**
   - *範圍：* 小組匯總查詢構建、雙時間範圍（短期 vs. 長期）提示詞工程、嚴格的 JSON Schema 驗證，以及代禱主題歸類。
   - *完成定義：* 對 10 個不同的合成小組資料，p95 ≤ 15 秒內生成結構有效的 4 至 12 週計劃。
4. **工作線 4：組長工作台、即時編輯器與匯出（FR-01、FR-08）：**
   - *範圍：* 魔法連結組長登錄、QR code 生成器、小組洞察卡片、按週計劃即時編輯器、批准狀態鎖定，以及一鍵 WhatsApp／Markdown／PDF 匯出。
   - *完成定義：* 組長能建立小組、生成計劃、即時修改 2 週內容、批准，並把格式化的議程順利貼到訊息應用中。
