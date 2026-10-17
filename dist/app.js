import { CATEGORIES, getQuestions, inferCategory, inferComputerIntent, composePrompt } from './core.js';

const $ = id => document.getElementById(id);
const idea = $('idea'), category = $('category'), depth = $('depth'), questions = $('questions'), result = $('result');
const storageKey = 'prompt-studio-history-v1';
let toastTimer;

function toast(message) {
  const node = $('toast'); node.textContent = message; node.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('show'), 2700);
}
function selectedCategory() { return category.value === 'auto' ? inferCategory(idea.value) : category.value; }
function updateDetected() {
  $('char-count').textContent = `${idea.value.length} / 4000`;
  const selected = selectedCategory();
  $('detected').textContent = idea.value.trim() ? selected === 'computer' ? '建議類型：電腦整理。先確認這次的目的，才會產生對應提示詞。' : `${category.value === 'auto' ? '建議類型' : '已選類型'}：${CATEGORIES[selected].label}。可調整類型後查看對應補問。` : '輸入想法後，會建議適合的任務類型。';
  $('idea-error').textContent = '';
  if (!questions.hidden && questions.dataset.category !== selected) renderQuestions();
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
  const intro = document.createElement('p'); intro.className = 'questions-intro'; intro.textContent = selected === 'computer' ? '先選主要目的；其他資訊可補充，讓提示詞更貼近你的情況。' : '只補充會影響結果的資訊；不知道的部分可以留空。'; questions.append(intro);
  for (const q of getQuestions(selected, values, idea.value)) {
    const label = document.createElement('label'); label.textContent = q.label;
    const optional = document.createElement('span'); optional.className = 'question-optional'; optional.textContent = q.required ? '必填' : '可選填'; label.append(optional);
    const input = document.createElement(q.options ? 'select' : q.id === 'context' || q.id === 'constraints' || q.id === 'protect' ? 'textarea' : 'input');
    if (input.tagName === 'INPUT') input.type = 'text';
    if (input.tagName === 'SELECT') {
      const blank = document.createElement('option'); blank.value = ''; blank.textContent = '請選擇'; input.append(blank);
      for (const item of q.options) { const option = document.createElement('option'); option.value = item.value; option.textContent = item.label; input.append(option); }
    } else { input.maxLength = 1000; input.placeholder = q.placeholder || ''; }
    input.dataset.question = q.id; input.value = values[q.id] || (q.id === 'intent' ? inferComputerIntent(idea.value) : '');
    if (q.id === 'intent') input.addEventListener('change', () => {
      const next = { ...readAnswers(), target: '' };
      renderQuestions(next);
      questions.querySelector('[data-question="target"]')?.focus();
    });
    label.append(input); questions.append(label);
  }
  questions.dataset.category = selected;
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
      questions.hidden = false; renderQuestions(item.answers || {}); updateDetected();
      $('workbench').scrollIntoView({ behavior: 'smooth' }); idea.focus(); toast('已載入先前的想法');
    }); list.append(button);
  }
}
function showResult(data) {
  result.value = data.text; result.hidden = false; $('empty-result').hidden = true; $('result-actions').hidden = false;
  $('result-status').textContent = '可以使用'; $('result-status').classList.add('ready');
  $('result-length').textContent = `${data.text.length} 字元 · 已回答 ${data.filled}/${data.total} 題`;
  $('missing-box').hidden = data.missing.length === 0;
  const list = $('missing-list'); list.replaceChildren();
  for (const item of data.missing.slice(0, 3)) { const li = document.createElement('li'); li.textContent = item; list.append(li); }
}
function generate() {
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

idea.addEventListener('input', updateDetected); category.addEventListener('change', updateDetected);
$('show-questions').addEventListener('click', () => {
  if (idea.value.trim().length < 2) { $('idea-error').textContent = '先寫下至少 2 個字的想法，再查看補問。'; idea.focus(); return; }
  questions.hidden = !questions.hidden;
  if (!questions.hidden) renderQuestions();
  $('show-questions').firstChild.textContent = questions.hidden ? '查看補問 ' : '收起補問 ';
});
$('generate').addEventListener('click', generate);
$('reset').addEventListener('click', () => {
  idea.value = ''; category.value = 'auto'; depth.value = 'balanced'; questions.hidden = true; questions.replaceChildren();
  result.value = ''; result.hidden = true; $('empty-result').hidden = false; $('result-actions').hidden = true; $('missing-box').hidden = true;
  $('result-status').textContent = '尚未產生'; $('result-status').classList.remove('ready'); $('result-length').textContent = '';
  $('show-questions').firstChild.textContent = '查看補問 '; updateDetected(); idea.focus();
});
document.querySelectorAll('[data-example]').forEach(button => button.addEventListener('click', () => {
  idea.value = button.dataset.example; updateDetected(); idea.focus();
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
renderHistory(); updateDetected();
