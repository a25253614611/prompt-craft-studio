const ASSETS = __ASSETS__;
const MODEL = 'gemini-2.5-flash';
const CATEGORIES = new Set(['auto', 'general', 'computer', 'writing', 'learning', 'research', 'product', 'coding', 'creative']);
const DEPTHS = new Set(['concise', 'balanced', 'detailed']);
const responseHeaders = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin'
};

const planInstruction = `你是繁體中文需求分析師。使用第一性原則：先判斷使用者真正要達到的結果，再找出缺少哪些資訊會讓執行方法改變。
只問必要問題，0 到 3 題，不為湊數提問。問題要貼合任務，不要套用「給誰看、背景、輸出格式」等通用三題。問題必須短、可回答；選擇題要有互斥、具體的選項，最多 6 個。不要重問原文已提供的資訊。
若需求是「我要整理我的電腦」且沒有說目的，第一題必須區分尋找資料、釋放空間、分類檔案、備份或改善速度；不能預設刪檔。若是產品驗證且沒有指定交付成果，先區分範圍評估、驗收標準、功能規格或分期規劃。
不要假裝已讀取網頁、檔案或電腦。只回傳 JSON：{"understanding":"一句話說明你理解的任務與尚未確定的關鍵","questions":[{"label":"問題文字","options":["選項1","選項2"]}]}。開放式問題的 options 用空陣列。`;

const generateInstruction = `你是將簡短需求改寫成「可直接交給另一個 AI 執行」之提示詞的編輯。請使用繁體中文。
先根據使用者原文和回答判斷具體目的，再寫出能產生實際成果的提示詞。保留原文中的具體功能、範圍、先後順序和限制；不要只重述原文或堆疊角色、工作方式、空泛品質要求。不要編造資料、來源、測試結果或使用者意圖。
針對任務指定明確的交付內容和可檢查的完成條件。若仍缺少會改變做法的資訊，指示執行者先問最關鍵的問題；不要替使用者決定。涉及刪除、覆蓋、搬移資料等動作，要求先列出影響並取得使用者確認。若原文聲稱根據公開頁面但沒有網址，標明來源尚待核對。
只輸出完整提示詞本身，不要解說、不要 Markdown 程式碼圍欄。篇幅依指定長度控制，避免重複。`;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...responseHeaders, 'content-type': 'application/json; charset=utf-8' }
  });
}

function usageOf(data) {
  const usage = data?.usageMetadata || {};
  return {
    inputTokens: Number(usage.promptTokenCount) || 0,
    outputTokens: Number(usage.candidatesTokenCount) || 0,
    totalTokens: Number(usage.totalTokenCount) || 0
  };
}

function clean(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function normalizeInput(raw) {
  const idea = clean(raw?.idea, 4000);
  if (idea.length < 2) throw new Error('請先輸入至少 2 個字的想法。');
  const category = CATEGORIES.has(raw.category) ? raw.category : 'auto';
  const depth = DEPTHS.has(raw.depth) ? raw.depth : 'balanced';
  return { idea, category, depth };
}

function normalizeAnswers(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 3).map(item => ({
    question: clean(item?.question, 160),
    answer: clean(item?.answer, 1000)
  })).filter(item => item.question && item.answer);
}

async function callGemini(env, instruction, payload, jsonOutput, maxOutputTokens) {
  if (!env.GEMINI_API_KEY) return { error: json({ error: 'Gemini 尚未設定。請先在 Sites 設定 GEMINI_API_KEY secret。', code: 'NOT_CONFIGURED' }, 503) };
  let upstream;
  try {
    upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instruction }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(payload) }] }],
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens,
          thinkingConfig: { thinkingBudget: jsonOutput ? 256 : 512 },
          ...(jsonOutput ? { responseMimeType: 'application/json' } : {})
        }
      }),
      signal: AbortSignal.timeout(25000)
    });
  } catch {
    return { error: json({ error: 'Gemini 暫時無法連線，請稍後再試。', code: 'UPSTREAM_UNAVAILABLE' }, 502) };
  }
  if (!upstream.ok) {
    const code = upstream.status === 429 ? 'QUOTA_EXCEEDED' : 'UPSTREAM_ERROR';
    const message = upstream.status === 429 ? 'Gemini 免費額度或速率限制已用完，請稍後再試。' : 'Gemini 暫時無法完成請求，請確認金鑰與免費額度。';
    return { error: json({ error: message, code }, upstream.status === 429 ? 429 : 502) };
  }
  let data;
  try { data = await upstream.json(); } catch { return { error: json({ error: 'Gemini 回應格式不正確。', code: 'INVALID_RESPONSE' }, 502) }; }
  const text = data?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
  if (!text) return { error: json({ error: 'Gemini 沒有產生內容，請調整需求後重試。', code: 'EMPTY_RESPONSE' }, 502) };
  return { text, usage: usageOf(data) };
}

function normalizePlan(text, idea) {
  let data;
  try { data = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch { throw new Error('Gemini 未回傳可用的分析。'); }
  const seen = new Set();
  let questions = (Array.isArray(data.questions) ? data.questions : []).slice(0, 3).map((item, index) => ({
    id: `q${index + 1}`,
    label: clean(item?.label, 160),
    options: (Array.isArray(item?.options) ? item.options : []).slice(0, 6).map(option => clean(option, 60)).filter(Boolean)
  })).filter(item => item.label && !seen.has(item.label) && seen.add(item.label));
  if (/整理.{0,5}電腦|電腦.{0,5}整理/.test(idea) && !/找|搜尋|空間|容量|分類|歸檔|備份|速度|變慢|卡頓|清理|刪除/.test(idea)) {
    questions = [{
      id: 'q1',
      label: '這次整理電腦，最想先達成什麼？',
      options: ['尋找資料', '釋放空間', '分類檔案', '備份資料', '改善速度', '還不確定']
    }, ...questions.filter(item => !/目的|想達成|最想|哪一種/.test(item.label)).slice(0, 2)].map((item, index) => ({ ...item, id: `q${index + 1}` }));
  }
  return { understanding: clean(data.understanding, 280) || '已分析你的目標；請補充會改變做法的資訊。', questions };
}

async function handleApi(request, env, path) {
  if (path === '/api/status' && request.method === 'GET') return json({ configured: Boolean(env.GEMINI_API_KEY), model: MODEL });
  if (!['/api/plan', '/api/generate'].includes(path)) return json({ error: '找不到此功能。' }, 404);
  if (request.method !== 'POST') return json({ error: '不支援此請求。' }, 405);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: '請從本站使用此功能。' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: '請使用 JSON 傳送資料。' }, 415);
  let raw;
  try {
    const body = await request.text();
    if (body.length > 12000) return json({ error: '輸入過長，請縮短後再試。' }, 413);
    raw = JSON.parse(body);
  } catch { return json({ error: '請求格式不正確。' }, 400); }
  let input;
  try { input = normalizeInput(raw); } catch (error) { return json({ error: error.message }, 400); }
  if (path === '/api/plan') {
    const reply = await callGemini(env, planInstruction, input, true, 900);
    if (reply.error) return reply.error;
    try { return json({ ...normalizePlan(reply.text, input.idea), usage: reply.usage }); }
    catch { return json({ error: 'Gemini 分析格式不正確，請重試。', code: 'INVALID_RESPONSE' }, 502); }
  }
  const answers = normalizeAnswers(raw.answers);
  const reply = await callGemini(env, generateInstruction, { ...input, answers }, false, input.depth === 'detailed' ? 2200 : 1400);
  if (reply.error) return reply.error;
  const text = reply.text.replace(/^```(?:markdown|text)?\s*|\s*```$/g, '').trim().slice(0, 12000);
  if (text.length < 20) return json({ error: '產出過短，請重試。', code: 'INVALID_RESPONSE' }, 502);
  return json({ text, usage: reply.usage });
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/api/')) return handleApi(request, env, path);
    const asset = ASSETS[path === '/' ? '/index.html' : path];
    if (!asset || request.method !== 'GET') return new Response('Not found', { status: 404 });
    return new Response(asset.body, {
      headers: {
        'content-type': asset.type,
        'x-content-type-options': 'nosniff',
        'cache-control': 'no-cache'
      }
    });
  }
};
