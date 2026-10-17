# 提示詞工坊

將簡短想法轉成可直接交給 AI 執行的繁體中文提示詞。Gemini 模式先分析真正目標，最多提出 3 個會改變做法的問題，再依回答產生任務專屬提示詞。未設定金鑰或關閉 AI 時，仍可使用原本的本機規則。產出可編輯、複製及下載；最近使用紀錄只有勾選後才會存入瀏覽器。

## 設定

1. 在 [Google AI Studio](https://aistudio.google.com/app/apikey) 建立有 Gemini 免費額度的 API 金鑰。
2. 在此 Sites 專案的環境變數中新增 `GEMINI_API_KEY`，設為 **secret**。不要寫進 Git、`.openai/hosting.json` 或前端程式。
3. 確認 AI Studio 專案顯示為 Free tier，再部署或重新部署網站，讓環境變數生效。網頁開啟後會顯示「金鑰已設定」；若尚未設定，會顯示「尚未設定金鑰」，並使用本機規則。

免費額度與速率限制取決於 Google AI Studio 專案。如果金鑰所屬專案已連結付費帳戶，呼叫可能產生費用；網站無法代替 AI Studio 保證零費用。Gemini 免費額度的輸入與輸出可能用於改善 Google 產品，請勿提交機密或個人資料。網頁會在 AI 模式旁顯示資料使用說明，並顯示本次 API 呼叫與 token 用量。

## 本機驗證

執行 `npm run build` 後執行 `npm test`。Build 會把原有靜態頁面與伺服端 API 打包成 Sites Worker，無需安裝外部套件。測試使用模擬 Gemini 回應，不消耗免費額度。
