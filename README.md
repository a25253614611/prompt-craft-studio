# 提示詞工坊

將簡短想法轉成可直接交給 AI 執行的繁體中文提示詞。Ollama 與 Gemini 模式先分析真正目標，最多提出 3 個會改變做法的問題，再依回答產生任務專屬提示詞。沒有可用模型時仍可使用本機規則。產出可編輯、複製及下載；最近使用紀錄只有勾選後才會存入瀏覽器。

## Ollama 本機模式

1. 在使用網站的 **同一台電腦** 安裝 [Ollama for Windows](https://docs.ollama.com/windows)，執行 `ollama pull qwen3:4b`，並確認 Ollama 正在執行。
2. 將使用者環境變數 `OLLAMA_ORIGINS` 設為網站的完整來源網址 `https://prompt-craft-studio.a25253614611.chatgpt.site`。若已設定其他來源，請用逗號分隔並保留原值。修改後完整退出並重新啟動 Ollama。
3. 重新整理網站。顯示「Ollama qwen3:4b 已就緒」時，產生方式會自動選擇 Ollama。網站只呼叫此電腦 `127.0.0.1:11434` 的 Ollama；不需雲端 API 金鑰。模型檔約 2.5 GB，另需 Ollama 程式與執行空間。

網站從 HTTPS 頁面連接本機服務，瀏覽器可能要求允許本機網路連線。若瀏覽器拒絕，請在瀏覽器權限中允許此網站存取本機網路，然後重新整理。Ollama 保持預設的 `127.0.0.1` 綁定；不要為此設定 `OLLAMA_HOST=0.0.0.0`。

## Gemini 雲端模式（可選）

1. 在 [Google AI Studio](https://aistudio.google.com/app/apikey) 建立有 Gemini 免費額度的 API 金鑰。
2. 在此 Sites 專案的環境變數中新增 `GEMINI_API_KEY`，設為 **secret**。不要寫進 Git、`.openai/hosting.json` 或前端程式。
3. 確認 AI Studio 專案顯示為 Free tier，再部署或重新部署網站，讓環境變數生效。金鑰可用時，選單中的 Gemini 模式會啟用。

免費額度與速率限制取決於 Google AI Studio 專案。如果金鑰所屬專案已連結付費帳戶，呼叫可能產生費用；網站無法代替 AI Studio 保證零費用。Gemini 免費額度的輸入與輸出可能用於改善 Google 產品，請勿提交機密或個人資料。網頁會在 AI 模式旁顯示資料使用說明，並顯示本次 API 呼叫與 token 用量。

## 本機驗證

執行 `npm run build` 後執行 `npm test`。Build 會把靜態頁面與伺服端 API 打包成 Sites Worker，無需安裝外部套件。自動測試使用模擬 Ollama 與 Gemini 回應，不消耗免費額度。
