import { CATEGORIES, getQuestions, inferCategory, inferComputerIntent, inferProductTask, composePrompt } from './core.js';
import { checkOllama, ollamaApi } from './ollama.js';

const $ = id => document.getElementById(id);
const idea = $('idea'), category = $('category'), depth = $('depth'), questions = $('questions'), result = $('result');
const storageKey = 'prompt-studio-history-v1';
let toastTimer;
let previousIdea = idea.value;
let aiAvailable = false;
let ollamaAvailable = false;
let aiPlan = null;
let aiCalls = 0;
let aiTokens = 0;
let busy = false;

function provider() { return $('ai-provider').value; }
function useAI() { return provider() !== 'rules'; }
function providerName() { return provider() === 'ollama' ? 'Ollama' : 'Gemini'; }
function resetPlan() { aiPlan = null; aiCalls = 0; aiTokens = 0; questions.replaceChildren(); }
async function api(path, payload) {
  let data;
  if (provider() === 'ollama') data = await ollamaApi(path, payload);
  else {
    const response = await fetch(`/api/${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload)
    });
    try { data = await response.json(); } catch { throw new Error('網站暫時無法連接 Gemini，請稍後再試。'); }
    if (!response.ok) throw new Error(data.error || 'Gemini 暫時無法使用。');
  }
  aiCalls += 1;
  aiTokens += Number(data.usage?.totalTokens) || 0;
  return data;
}
function requestData() { return { idea: idea.value, category: category.value, depth: depth.value }; }
async function prepareAI() {
  const plan = await api('plan', requestData());
  aiPlan = { understanding: plan.understanding, questions: plan.questions };
  questions.hidden = false;
  renderQuestions();
  $('show-questions').firstChild.textContent = '收起補問 ';
  $('result-status').textContent = plan.questions.length ? '請回答關鍵問題' : '資訊足夠，可以產生';
  if (plan.questions.length) questions.querySelector('[data-question]')?.focus();
  return plan;
}
async function checkAI() {
  const [ollama, gemini] = await Promise.all([
    checkOllama(),
    fetch('/api/status', { cache: 'no-store' }).then(async response => response.ok ? response.json() : {}).catch(() => ({}))
  ]);
  ollamaAvailable = ollama.available;
  aiAvailable = Boolean(gemini.configured);
  $('ai-provider').options[1].disabled = !ollamaAvailable;
  $('ai-provider').options[2].disabled = !aiAvailable;
  $('ai-provider').value = ollamaAvailable ? 'ollama' : aiAvailable ? 'gemini' : 'rules';
  $('ai-state').textContent = ollamaAvailable ? 'Ollama qwen3:4b 已就緒' : ollama.connected ? 'Ollama 缺少 qwen3:4b 模型' : aiAvailable ? 'Gemini 已就緒' : 'Ollama 未連線 · 使用規則';
  $('ollama-help').hidden = ollamaAvailable;
  $('local-link').hidden = location.hostname === '127.0.0.1';
  $('ollama-help-text').textContent = ollama.connected ? '請先執行 ollama pull qwen3:4b，再重新整理。' : location.hostname === '127.0.0.1' ? '請啟動 Ollama，再重新整理。' : '本機 AI 請先雙擊 Git 專案中的「啟動本機網站.cmd」，並啟動 Ollama。';
  updateDetected();
}
function toast(message) {
  const node = $('toast'); node.textContent = message; node.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('show'), 2700);
}
function selectedCategory() { return category.value === 'auto' ? inferCategory(idea.value) : category.value; }
function clearResult() {
  result.value = ''; result.hidden = true; $('empty-result').hidden = false; $('result-actions').hidden = true; $('missing-box').hidden = true;
  $('result-status').textContent = '尚未產生'; $('result-status').classList.remove('ready'); $('result-length').textContent = '';
}
function updateDetected() {
  $('char-count').textContent = `${idea.value.length} / 4000`;
  const selected = selectedCategory();
  $('detected').textContent = idea.value.trim() ? useAI() ? `${providerName()} 會先分析真正目標，只問必要問題；請確認上方任務類型是否合適。` : selected === 'computer' ? '建議類型：電腦整理。先確認這次的目的，才會產生對應提示詞。' : selected === 'product' ? '建議類型：產品規劃與驗收。先確認要交付的成果，避免只重述原文。' : `${category.value === 'auto' ? '建議類型' : '已選類型'}：${CATEGORIES[selected].label}。可調整類型後查看對應補問。` : '輸入想法後，會建議適合的任務類型。';
  $('idea-error').textContent = '';
  if (useAI()) return;
  if (!questions.hidden) {
    const signature = getQuestions(selected, readAnswers(), idea.value).map(q => `${q.id}:${q.label}:${q.required || false}`).join('|');
    if (questions.dataset.category !== selected) questions.replaceChildren();
    if (questions.dataset.category !== selected || questions.dataset.signature !== signature) renderQuestions();
  }
}
function readAnswers() {
  const data = {};
  questions.querySelectorAll('[data-question]').forEach(el => { data[el.dataset.question] = el.value; });
  return data;
}
function renderQuestions(previous = {}) {
  const selected = selectedCategory();
  const values = { ...readAnswers(), ...previous };
  questions.replaceChildren();
  const intro = document.createElement('p'); intro.className = 'questions-intro'; intro.textContent = useAI() ? aiPlan?.understanding || '按「分析並產生提示詞」取得關鍵問題。' : selected === 'computer' ? '只問 3 件事：整理目的、具體困擾、作業系統。不確定的資訊可留空。' : selected === 'product' ? '先選要交付的成果，再補來源與驗收條件；最多 3 題。' : '只問最影響結果的 3 件事；不知道的部分可留空。'; questions.append(intro);
  const activeQuestions = useAI() ? aiPlan?.questions || [] : getQuestions(selected, values, idea.value);
  for (const q of activeQuestions) {
    const label = document.createElement('label'); label.textContent = q.label;
    const optional = document.createElement('span'); optional.className = 'question-optional'; optional.textContent = useAI() || q.required ? '必填' : '可選填'; label.append(optional);
    const input = document.createElement(q.options?.length ? 'select' : q.id === 'context' || q.id === 'constraints' ? 'textarea' : 'input');
    if (input.tagName === 'INPUT') input.type = 'text';
    if (input.tagName === 'SELECT') {
      const blank = document.createElement('option'); blank.value = ''; blank.textContent = '請選擇'; input.append(blank);
      for (const item of q.options) { const option = document.createElement('option'); option.value = typeof item === 'string' ? item : item.value; option.textContent = typeof item === 'string' ? item : item.label; input.append(option); }
    } else { input.maxLength = 1000; input.placeholder = useAI() ? '請簡短回答；不確定可填「不確定」' : q.placeholder || ''; }
    input.dataset.question = q.id; input.value = values[q.id] || (q.id === 'intent' ? inferComputerIntent(idea.value) : q.id === 'productTask' ? inferProductTask(idea.value) : '');
    if (!useAI() && q.id === 'intent') input.addEventListener('change', () => {
      const next = { ...readAnswers(), target: '' };
      renderQuestions(next);
      questions.querySelector('[data-question="target"]')?.focus();
    });
    label.append(input); questions.append(label);
  }
  questions.dataset.category = selected;
  questions.dataset.signature = activeQuestions.map(q => `${q.id}:${q.label}:${q.required || false}`).join('|');
}
function loadHistory() {
  try { const value = JSON.parse(localStorage.getItem(storageKey) || '[]'); return Array.isArray(value) ? value.slice(0, 8) : []; } catch { return []; }
}
function saveHistory(entry) {
  try {
    const history = loadHistory().filter(item => item.idea !== entry.idea);
    localStorage.setItem(storageKey, JSON.stringify([entry, ...history].slice(0, 8)));
    renderHistory();
  } catch { /* Private browsing can disable storage; generation still works. */ }
}
function renderHistory() {
  const items = loadHistory(); $('history-section').hidden = items.length === 0;
  const list = $('history-list'); list.replaceChildren();
  for (const item of items) {
    const button = document.createElement('button'); button.className = 'history-item'; button.type = 'button';
    const title = document.createElement('strong'); title.textContent = item.idea;
    const meta = document.createElement('small'); meta.textContent = `${CATEGORIES[item.category]?.label || '一般任務'} · ${item.date || ''}`;
    button.append(title, meta); button.addEventListener('click', () => {
      idea.value = item.idea || ''; category.value = item.category || 'auto'; depth.value = item.depth || 'balanced';
      previousIdea = idea.value; clearResult(); resetPlan();
      if (useAI() && item.mode === provider() && item.plan) aiPlan = item.plan;
      questions.hidden = false; renderQuestions(item.answers || {}); updateDetected();
      $('workbench').scrollIntoView({ behavior: 'smooth' }); idea.focus(); toast('已載入先前的想法');
    }); list.append(button);
  }
}
function showResult(data) {
  result.value = data.text; result.hidden = false; $('empty-result').hidden = true; $('result-actions').hidden = false;
  $('result-status').textContent = '可以使用'; $('result-status').classList.add('ready');
  $('result-length').textContent = `${data.text.length} 字元 · 已回答 ${data.filled}/${data.total} 題${data.mode !== 'rules' ? ` · API ${aiCalls} 次 / ${aiTokens} tokens` : ''}`;
  $('missing-box').hidden = data.missing.length === 0;
  const list = $('missing-list'); list.replaceChildren();
  for (const item of data.missing.slice(0, 3)) { const li = document.createElement('li'); li.textContent = item; list.append(li); }
}
function generateLocal() {
  try {
    const answers = readAnswers();
    const data = composePrompt({ idea: idea.value, category: category.value, depth: depth.value, answers });
    showResult(data); $('idea-error').textContent = '';
    if ($('save-history').checked) saveHistory({ idea: idea.value.trim(), category: data.category, depth: depth.value, answers, date: new Intl.DateTimeFormat('zh-TW', { month: '2-digit', day: '2-digit' }).format(new Date()) });
    if (innerWidth < 721) $('result-panel').scrollIntoView({ behavior: 'smooth' });
    toast('完整提示詞已產生');
  } catch (error) {
    $('idea-error').textContent = error.message;
    if (error.code === 'CLARIFICATION_REQUIRED') {
      questions.hidden = false; renderQuestions();
      $('show-questions').firstChild.textContent = '收起補問 ';
      $('result-status').textContent = '先確認目的'; $('result-status').classList.remove('ready');
      result.hidden = true; $('result-actions').hidden = true; $('empty-result').hidden = false; $('missing-box').hidden = true;
      questions.querySelector(`[data-question="${error.questionId}"]`)?.focus();
    } else idea.focus();
  }
}

async function generate() {
  if (!useAI()) return generateLocal();
  if (busy) return;
  if (idea.value.trim().length < 2) { $('idea-error').textContent = '先寫下至少 2 個字的想法。'; idea.focus(); return; }
  busy = true; $('generate').disabled = true; $('ai-provider').disabled = true; $('result-status').textContent = `${providerName()} 分析中…`;
  try {
    if (!aiPlan) {
      const plan = await prepareAI();
      if (plan.questions.length) return;
    }
    const answers = readAnswers();
    const missing = aiPlan.questions.find(q => !answers[q.id]?.trim());
    if (missing) {
      $('idea-error').textContent = `請先回答「${missing.label}」；不確定可填「不確定」。`;
      questions.hidden = false; questions.querySelector(`[data-question="${missing.id}"]`)?.focus();
      $('result-status').textContent = '等待回答';
      return;
    }
    $('result-status').textContent = `${providerName()} 撰寫中…`;
    const reply = await api('generate', { ...requestData(), answers: aiPlan.questions.map(q => ({ question: q.label, answer: answers[q.id] })) });
    showResult({ text: reply.text, category: selectedCategory(), filled: aiPlan.questions.length, total: aiPlan.questions.length, missing: [], mode: provider() });
    $('idea-error').textContent = '';
    if ($('save-history').checked) saveHistory({ idea: idea.value.trim(), category: category.value, depth: depth.value, answers, plan: aiPlan, mode: provider(), date: new Intl.DateTimeFormat('zh-TW', { month: '2-digit', day: '2-digit' }).format(new Date()) });
    if (innerWidth < 721) $('result-panel').scrollIntoView({ behavior: 'smooth' });
    toast(`${providerName()} 已產生完整提示詞`);
  } catch (error) {
    $('idea-error').textContent = error.message;
    $('result-status').textContent = 'AI 暫時不可用';
    toast('請重試，或切換為本機規則');
  } finally { busy = false; $('generate').disabled = false; $('ai-provider').disabled = false; }
}

function ideaChanged() {
  if (idea.value !== previousIdea) {
    previousIdea = idea.value; clearResult(); resetPlan();
    if (!questions.hidden) { questions.replaceChildren(); renderQuestions(); }
  }
  updateDetected();
}
idea.addEventListener('input', ideaChanged);
category.addEventListener('change', () => { clearResult(); resetPlan(); if (!questions.hidden) renderQuestions(); updateDetected(); });
depth.addEventListener('change', () => { clearResult(); resetPlan(); if (!questions.hidden) renderQuestions(); });
$('ai-provider').addEventListener('change', () => { clearResult(); resetPlan(); if (!questions.hidden) renderQuestions(); updateDetected(); });
function answerChanged() { clearResult(); $('idea-error').textContent = ''; }
questions.addEventListener('input', answerChanged);
questions.addEventListener('change', answerChanged);
$('show-questions').addEventListener('click', async () => {
  if (idea.value.trim().length < 2) { $('idea-error').textContent = '先寫下至少 2 個字的想法，再查看補問。'; idea.focus(); return; }
  if (useAI() && !aiPlan) {
    if (busy) return;
    busy = true; $('show-questions').disabled = true; $('ai-provider').disabled = true; $('result-status').textContent = `${providerName()} 分析中…`;
    try { await prepareAI(); } catch (error) { $('idea-error').textContent = error.message; $('result-status').textContent = 'AI 暫時不可用'; }
    finally { busy = false; $('show-questions').disabled = false; $('ai-provider').disabled = false; }
    return;
  }
  questions.hidden = !questions.hidden;
  if (!questions.hidden) renderQuestions();
  $('show-questions').firstChild.textContent = questions.hidden ? '查看補問 ' : '收起補問 ';
});
$('generate').addEventListener('click', generate);
$('reset').addEventListener('click', () => {
  idea.value = ''; category.value = 'auto'; depth.value = 'balanced'; questions.hidden = true; questions.replaceChildren();
  previousIdea = ''; clearResult(); resetPlan();
  $('show-questions').firstChild.textContent = '查看補問 '; updateDetected(); idea.focus();
});
document.querySelectorAll('[data-example]').forEach(button => button.addEventListener('click', () => {
  idea.value = button.dataset.example; ideaChanged(); idea.focus();
}));
$('copy').addEventListener('click', async () => {
  if (!result.value.trim()) return;
  try { await navigator.clipboard.writeText(result.value); toast('已複製到剪貼簿'); }
  catch { result.focus(); result.select(); toast('無法自動複製，已選取文字，請手動複製'); }
});
$('download').addEventListener('click', () => {
  if (!result.value.trim()) return;
  const blob = new Blob([result.value], { type: 'text/markdown;charset=utf-8' }); const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = '完整提示詞.md'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('clear-history').addEventListener('click', () => { try { localStorage.removeItem(storageKey); } catch {} renderHistory(); toast('本機紀錄已清除'); });
result.addEventListener('input', () => { $('result-length').textContent = `${result.value.length} 字元 · 已手動編輯`; });
renderHistory(); updateDetected(); checkAI();
