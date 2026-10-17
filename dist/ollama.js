const endpoint = 'http://127.0.0.1:11434';
const preferredModel = 'qwen3:4b';

const planInstruction = `你是繁體中文需求分析師。先從第一性原則判斷使用者真正想達到的結果，再找出哪些未知資訊會改變做法。只問必要的 0 到 3 題；不要套用通用問題，不要重問已知資訊。問題要短、具體、可回答，選項互斥且最多 6 個。若使用者只說「我要整理我的電腦」，第一題要確認目的是找資料、釋放空間、分類、備份、改善速度或其他，絕不可假定要刪檔。若是產品驗證，先分清要做範圍評估、驗收標準、功能規格或分期規劃。不要聲稱已讀取網站或檔案。只輸出 JSON：{"understanding":"一句話概括目標與關鍵未知","questions":[{"label":"問題","options":["選項"]}]}。開放題的 options 為空陣列。`;

const generateInstruction = `你是繁體中文提示詞編輯。根據原文和補問回答，寫出可直接交給另一個 AI 執行的提示詞。先說清楚具體目的，再指定實際交付內容、做法和可檢查的完成條件。保留原文中的功能、順序、限制和使用者選擇；不要堆疊空泛的角色、品質要求或流程，不要只重述原文。不要編造背景、來源、測試結果或使用者意圖。若仍缺少會改變做法的資訊，要求執行者先問最關鍵的問題。涉及刪除、覆蓋、搬移資料時，先列出影響並取得使用者確認。若聲稱基於公開頁面但未提供網址，標示來源待核對。只輸出完整提示詞本身，不加解說或程式碼圍欄。`;

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
  if (/整理.{0,5}電腦|電腦.{0,5}整理/.test(idea) && !/找|搜尋|空間|容量|分類|歸檔|備份|速度|變慢|卡頓|清理|刪除/.test(idea)) {
    questions = [{
      id: 'q1', label: '這次整理電腦，最想先達成什麼？',
      options: ['尋找資料', '釋放空間', '分類檔案', '備份資料', '改善速度', '還不確定']
    }, ...questions.filter(item => !/目的|想達成|最想|哪一種/.test(item.label)).slice(0, 2)]
      .map((item, index) => ({ ...item, id: `q${index + 1}` }));
  }
  return { understanding: clean(data.understanding, 280) || '請補充會改變做法的關鍵資訊。', questions };
}

export async function ollamaApi(path, payload) {
  const idea = clean(payload.idea, 4000);
  if (idea.length < 2) throw new Error('請先輸入至少 2 個字的想法。');
  const input = {
    idea,
    category: clean(payload.category, 40),
    depth: clean(payload.depth, 40),
    ...(path === 'generate' ? { answers: (Array.isArray(payload.answers) ? payload.answers : []).slice(0, 3)
      .map(item => ({ question: clean(item?.question, 160), answer: clean(item?.answer, 1000) }))
      .filter(item => item.question && item.answer) } : {})
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
          { role: 'user', content: JSON.stringify(input) }
        ],
        stream: false,
        think: false,
        ...(path === 'plan' ? { format: 'json' } : {}),
        options: { temperature: 0.2, num_predict: path === 'plan' ? 650 : input.depth === 'detailed' ? 1700 : 1100 }
      }),
      signal: AbortSignal.timeout(120000)
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
  const finalText = text.replace(/^```(?:markdown|text)?\s*|\s*```$/g, '').trim();
  if (finalText.length < 20) throw new Error('Ollama 產出過短，請重試。');
  return { text: finalText, usage };
}
