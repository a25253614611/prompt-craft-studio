# 提示詞工坊

將簡短想法轉成可直接交給 AI 執行的繁體中文提示詞。Ollama 與 Gemini 模式先分析真正目標，最多提出 3 個會改變做法的問題，再依回答產生任務專屬提示詞。沒有可用模型時仍可使用本機規則。產出可編輯、複製及下載；最近使用紀錄只有勾選後才會存入瀏覽器。

「整理電腦」但未說目的，以及「驗收網站」但未提供網址等明確情境，會先用本機規則提出一個關鍵問題，避免模型問可自行查證的問題。電腦整理的六種已知目的也由本機規則產生完整提示詞，網站會標示來源；其他需求仍使用所選的 Ollama 或 Gemini 模型。

## Ollama 本機模式

1. 在使用網站的 **同一台電腦** 安裝 [Ollama for Windows](https://docs.ollama.com/windows)，執行 `ollama pull qwen3:4b`，並確認 Ollama 正在執行。
2. 在此 Git 專案資料夾雙擊 `啟動本機網站.cmd`，或執行 `node local-server.mjs` 後開啟 `http://127.0.0.1:4173/`。顯示「Ollama qwen3:4b 已就緒」時，產生方式會自動選擇 Ollama。網站只呼叫此電腦 `127.0.0.1:11434` 的 Ollama；不需雲端 API 金鑰。模型檔約 2.5 GB，另需 Ollama 程式與執行空間。

本機啟動器會啟動網站與 Ollama；先檢查 `%LOCALAPPDATA%\Programs\OllamaPortable\ollama.exe`，再檢查 `PATH` 中的 Ollama。這台電腦使用 [Ollama 官方獨立命令列套件](https://docs.ollama.com/windows) 0.40.5，保留 CPU 與 Vulkan 後端。使用本機模型時，提示詞在本機處理；啟動器自行啟動的 Ollama 會停用雲端功能並關閉 Flash Attention，以避開這台電腦上實測的 Vulkan 載入錯誤。

這台電腦的 Chrome 與 ChatGPT 內建瀏覽器無法從線上 HTTPS 網站直接連到 `127.0.0.1`，因此 Ollama 模式請使用上方的本機網址。線上網址保留 Gemini 與規則模式。本機網站只監聽 `127.0.0.1:4173`，Ollama 保持預設的 `127.0.0.1:11434`；不要為此設定 `OLLAMA_HOST=0.0.0.0`。

## Gemini 雲端模式（可選）

1. 在 [Google AI Studio](https://aistudio.google.com/app/apikey) 建立有 Gemini 免費額度的 API 金鑰。
2. 在此 Sites 專案的環境變數中新增 `GEMINI_API_KEY`，設為 **secret**。不要寫進 Git、`.openai/hosting.json` 或前端程式。
3. 確認 AI Studio 專案顯示為 Free tier，再部署或重新部署網站，讓環境變數生效。金鑰可用時，選單中的 Gemini 模式會啟用。

免費額度與速率限制取決於 Google AI Studio 專案。如果金鑰所屬專案已連結付費帳戶，呼叫可能產生費用；網站無法代替 AI Studio 保證零費用。Gemini 免費額度的輸入與輸出可能用於改善 Google 產品，請勿提交機密或個人資料。網頁會在 AI 模式旁顯示資料使用說明，並顯示本次 API 呼叫與 token 用量。

## 本機驗證

執行 `npm run build` 後執行 `npm test`。Build 會把靜態頁面與伺服端 API 打包成 Sites Worker，無需安裝外部套件。自動測試使用模擬 Ollama 與 Gemini 回應，不消耗免費額度。
