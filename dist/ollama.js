const endpoint = 'http://127.0.0.1:11434';
const preferredModel = 'qwen3:4b';

const planInstruction = `你是繁體中文需求分析師。先從第一性原則判斷使用者真正想達到的結果，再找出哪些未知資訊會改變做法。只問必要的 0 到 3 題；不要套用通用問題，不要重問已知資訊。問題要短、具體、可回答，選項互斥且最多 6 個。若使用者只說「我要整理我的電腦」，第一題要確認目的是找資料、釋放空間、分類、備份、改善速度或其他，絕不可假定要刪檔。若是產品驗證，先分清要做範圍評估、驗收標準、功能規格或分期規劃。不要聲稱已讀取網站或檔案。只輸出 JSON：{"understanding":"一句話概括目標與關鍵未知","questions":[{"label":"問題","options":["選項"]}]}。開放題的 options 為空陣列。`;

const generateInstruction = `你是繁體中文提示詞編輯。把原始需求與已回答的問題改寫成可直接貼給另一個 AI 的完整工作指令。輸出 JSON 物件，只有 prompt 字串。prompt 第一行就寫具體目標，再寫要交付的成果、執行重點和可核對的完成條件。已回答的問題就是確定需求，不可再次詢問，也不可只輸出問題。若執行仍缺必要細節，在提示詞中要求執行者先問尚未回答的最關鍵問題，通常只問一題、最多三題，不為湊數提問；同時交代後續如何完成工作。保留原文的每個具名功能、範圍、先後順序與限制，尤其不能漏掉「之後再做」的項目。不要提及分析過程、輸入 JSON、category、depth 或提示詞寫作方法；不要堆疊空泛角色或通用流程。不要編造背景、來源、測試結果或使用者意圖。涉及刪除、覆蓋、搬移資料時，要求先列出影響並取得確認。若原文聲稱基於公開頁面但未提供網址，標示來源待核對。
範例：原始需求「我要整理我的電腦」；已回答「這次整理電腦，最想先達成什麼？→尋找資料」。合格的 prompt 是「請協助我在電腦中找到需要的資料。先問我想找的檔案名稱、類型、日期線索，以及電腦使用的系統；依答案提供可執行的搜尋步驟和優先搜尋的位置。若能操作電腦，先搜尋並回報檔名與所在路徑；若不能操作，提供我可自行執行的步驟。不要刪除或搬移檔案。完成時讓我能定位目標資料，或清楚知道已查過哪些位置及下一步。」
產品驗收範例：原始需求「第一版先完成作品藝廊、搜尋分類、作品詳情及投稿管理；內容穩定後再加入排行榜、指令集與小工具。請驗收網站，根據公開頁面說明分析依據、發現、限制與建議。」合格的 prompt 是「請驗收網站第一版。若尚未提供網址，先請我提供網站或可測試環境；取得後逐項測試作品藝廊的列表瀏覽、搜尋分類的查詢與篩選、作品詳情的內容與導覽、投稿管理的提交與管理流程。每項記錄操作步驟、預期結果、實際結果與證據；不可把未測試項目寫成通過。先列出公開頁面等分析依據，再整理發現、限制與可行建議，並列明上線前必須修復的問題。排行榜、指令集與小工具列為內容穩定後的下一階段，勿納入第一版通過條件。資料不足時標示待驗證，不編造結果。請用繁體中文精簡呈現。」`;
const generateFormat = { type: 'object', properties: { prompt: { type: 'string' } }, required: ['prompt'], additionalProperties: false };

const clean = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export async function checkOllama() {
  try {
    const response = await fetch(`${endpoint}/api/tags`, { signal: AbortSignal.timeout(3500), cache: 'no-store' });
    if (!response.ok) return { available: false };
    const data = await response.json();
    const models = Array.isArray(data.models) ? data.models : [];
    const match = models.find(item => item.name === preferredModel || item.model === preferredModel);
    return { available: Boolean(match), connected: true, model: preferredModel };
  } catch { return { available: false, connected: false }; }
}

function normalizePlan(text, idea) {
  let data;
  try { data = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')); }
  catch { throw new Error('Ollama 沒有回傳可用的問題，請重試。'); }
  const seen = new Set();
  let questions = (Array.isArray(data.questions) ? data.questions : []).slice(0, 3).map((item, index) => ({
    id: `q${index + 1}`,
    label: clean(item?.label, 160),
    options: (Array.isArray(item?.options) ? item.options : []).slice(0, 6).map(option => clean(option, 60)).filter(Boolean)
  })).filter(item => item.label && !seen.has(item.label) && seen.add(item.label));
  const ambiguousComputer = /整理.{0,5}電腦|電腦.{0,5}整理/.test(idea) && !/找|搜尋|空間|容量|分類|歸檔|備份|速度|變慢|卡頓|清理|刪除/.test(idea);
  if (ambiguousComputer) {
    questions = [{
      id: 'q1', label: '這次整理電腦，最想先達成什麼？',
      options: ['尋找資料', '釋放空間', '分類檔案', '備份資料', '改善速度', '還不確定']
    }, ...questions.filter(item => !/目的|想達成|最想|哪一種/.test(item.label)).slice(0, 2)]
      .map((item, index) => ({ ...item, id: `q${index + 1}` }));
  }
  return { understanding: ambiguousComputer ? '想整理電腦，但尚未確認真正目的。' : clean(data.understanding, 280) || '請補充會改變做法的關鍵資訊。', questions };
}

export async function ollamaApi(path, payload) {
  const idea = clean(payload.idea, 4000);
  if (idea.length < 2) throw new Error('請先輸入至少 2 個字的想法。');
  if (path === 'plan') {
    const usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, calls: 0 };
    if (/整理.{0,5}電腦|電腦.{0,5}整理/.test(idea) && !/找|搜尋|空間|容量|分類|歸檔|備份|速度|變慢|卡頓|清理|刪除/.test(idea)) {
      return { understanding: '想整理電腦，但尚未確認真正目的。', questions: [{ id: 'q1', label: '這次整理電腦，最想先達成什麼？', options: ['尋找資料', '釋放空間', '分類檔案', '備份資料', '改善速度', '還不確定'] }], usage };
    }
    if (/驗收/.test(idea) && /網頁|網站/.test(idea) && !/https?:\/\//.test(idea)) {
      return { understanding: '要驗收網站，但尚未提供可檢查的頁面或測試環境。', questions: [{ id: 'q1', label: '請提供要驗收的網站網址或可測試環境。', options: [] }], usage };
    }
  }
  const input = {
    idea,
    ...(path === 'plan' ? { category: clean(payload.category, 40) } : {}),
    ...(path === 'generate' ? { answers: (Array.isArray(payload.answers) ? payload.answers : []).slice(0, 3)
      .map(item => ({ question: clean(item?.question, 160), answer: clean(item?.answer, 1000) }))
      .filter(item => item.question && item.answer),
      maxCharacters: payload.depth === 'detailed' ? 1500 : payload.depth === 'concise' ? 500 : 850 } : {})
  };
  let response;
  try {
    response = await fetch(`${endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: preferredModel,
        messages: [
          { role: 'system', content: path === 'plan' ? planInstruction : generateInstruction },
          { role: 'user', content: path === 'plan' ? `/no_think\n${JSON.stringify(input)}` : `/no_think\n原始需求：${input.idea}\n已回答的問題：${input.answers.map(item => `${item.question}→${item.answer}`).join('；') || '無'}\n完整提示詞長度：不超過 ${input.maxCharacters} 字。請直接輸出 JSON {"prompt":"..."}。` }
        ],
        stream: false,
        think: false,
        format: path === 'plan' ? 'json' : generateFormat,
        options: { temperature: 0, num_ctx: 8192, num_predict: path === 'plan' ? 650 : payload.depth === 'detailed' ? 1600 : payload.depth === 'concise' ? 700 : 1100 }
      }),
      signal: AbortSignal.timeout(path === 'plan' ? 120000 : 240000)
    });
  } catch (error) {
    throw new Error(error.name === 'TimeoutError' ? 'Ollama 回應逾時，請稍後重試。' : '無法連線本機 Ollama。請確認 Ollama 正在執行，並重新整理網頁。');
  }
  if (!response.ok) throw new Error(response.status === 404 ? '找不到 qwen3:4b 模型，請先執行 ollama pull qwen3:4b。' : `Ollama 無法完成請求（${response.status}）。`);
  let data;
  try { data = await response.json(); } catch { throw new Error('Ollama 回應格式不正確。'); }
  const text = clean(data?.message?.content, 12000);
  if (!text) throw new Error('Ollama 沒有產生內容，請調整需求後重試。');
  const usage = {
    inputTokens: Number(data.prompt_eval_count) || 0,
    outputTokens: Number(data.eval_count) || 0,
    totalTokens: (Number(data.prompt_eval_count) || 0) + (Number(data.eval_count) || 0)
  };
  if (path === 'plan') return { ...normalizePlan(text, idea), usage };
  let finalText;
  try { finalText = clean(JSON.parse(text).prompt, 10000); }
  catch { throw new Error('Ollama 沒有回傳可用的完整提示詞，請重試。'); }
  if (finalText.length < 60 || /^(首先[，,]|我需要|用戶的JSON|作為.*提示詞編輯)/.test(finalText)) {
    throw new Error('Ollama 產出品質不足，請重試或補充具體需求。');
  }
  return { text: finalText, usage };
}
