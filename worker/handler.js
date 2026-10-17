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

const generateInstruction = `你是提示詞編輯，將使用者的簡短需求與已回答的問題，轉成「另一個 AI 可以據以完成任務」的繁體中文提示詞。
先從第一性原則判斷已確認的目的，再寫出具體執行步驟、應交付的成果和可檢查的條件。已回答的問題是事實，不要重問；保留原文中的具體功能、範圍、先後順序和限制。不要編造資料、來源、測試結果或意圖。
最重要：產出必須是任務提示詞，不是給使用者的一串補問。資訊仍不足時，只列會改變做法的未解問題，最多使用輸入中的 remainingQuestionBudget 題；即使有問題，也要寫出取得答案後該如何完成任務。不要把「請先提供資訊」當作唯一交付成果。
電腦整理若已回答「尋找資料」，目的就是找資料；步驟應包含安全搜尋及找不到時的下一步，不要轉成刪檔或泛泛整理。涉及刪除、覆蓋、搬移資料，要先列出影響並取得確認。產品驗證要逐項保留原文功能並提出可測試的驗收方式；若聲稱根據公開頁面卻沒有網址，標示來源待核對。
只回傳 JSON 物件，不要程式碼圍欄：{"objective":"明確、可執行的任務目標","steps":["具體步驟"],"deliverables":["實際成果及可檢查條件"],"questions":["若不問就會改變做法的未解問題"],"constraints":["必要限制"]}。steps 至少 2 項，deliverables 至少 1 項；questions 可以為空。不要在 steps 或 deliverables 中只寫問題。避免重複與空泛套話。`;

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

function normalizeGenerated(text, input, answers) {
  let data;
  try { data = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')); }
  catch { throw new Error('Gemini 未回傳可用的提示詞。'); }
  const items = (value, limit) => (Array.isArray(value) ? value : []).slice(0, limit).map(item => clean(item, 500)).filter(Boolean);
  const objective = clean(data?.objective, 400);
  const steps = items(data?.steps, 6);
  const deliverables = items(data?.deliverables, 4);
  const questions = items(data?.questions, Math.max(0, 3 - answers.length));
  const constraints = items(data?.constraints, 4);
  if (!objective || steps.length < 2 || !deliverables.length || steps.every(step => /^[請先]*[問提]/.test(step))) {
    throw new Error('Gemini 未產生可執行的提示詞。');
  }
  const known = [`原始需求：${input.idea}`, ...answers.map(item => `${item.question}：${item.answer}`)];
  const sections = [
    `# 任務\n${objective}`,
    `# 已知資訊\n${known.map(item => `- ${item}`).join('\n')}`,
    `# 執行步驟\n${steps.map((item, index) => `${index + 1}. ${item}`).join('\n')}`,
    `# 交付成果\n${deliverables.map(item => `- ${item}`).join('\n')}`
  ];
  if (questions.length) sections.push(`# 必要時先確認\n${questions.map((item, index) => `${index + 1}. ${item}`).join('\n')}\n取得答案後繼續完成上述成果，不要只停在補問。`);
  const safeguards = [...constraints];
  if (input.category === 'computer' || /整理.{0,5}電腦|電腦.{0,5}整理/.test(input.idea)) {
    safeguards.push('未經我確認，不要刪除、搬移或覆蓋任何資料；不要假裝已檢查我的電腦。');
  }
  safeguards.push('使用繁體中文；無法查證的資訊標為待確認，不要捏造結果。');
  sections.push(`# 限制\n${safeguards.map(item => `- ${item}`).join('\n')}`);
  return sections.join('\n\n').slice(0, 12000);
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
  const reply = await callGemini(env, generateInstruction, { ...input, answers, remainingQuestionBudget: Math.max(0, 3 - answers.length) }, true, input.depth === 'detailed' ? 2600 : 1800);
  if (reply.error) return reply.error;
  try { return json({ text: normalizeGenerated(reply.text, input, answers), usage: reply.usage }); }
  catch { return json({ error: 'Gemini 未產生可執行的提示詞，請重試。', code: 'INVALID_RESPONSE' }, 502); }
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
