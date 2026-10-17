import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('dist/server/index.js', import.meta.url), 'utf8');
assert.doesNotMatch(source, /test-secret/);
const { default: worker } = await import('./dist/server/index.js');
const url = 'https://prompt-craft-studio.example';
const post = (path, body, headers = {}) => new Request(`${url}${path}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: url, ...headers },
  body: JSON.stringify(body)
});
const env = { GEMINI_API_KEY: 'test-secret' };

assert.equal((await (await worker.fetch(new Request(`${url}/api/status`), {})).json()).configured, false);
assert.equal((await (await worker.fetch(new Request(`${url}/api/status`), env)).json()).configured, true);
assert.equal((await worker.fetch(post('/api/plan', { idea: '我要整理我的電腦' }), {})).status, 503);
assert.equal((await worker.fetch(post('/api/plan', { idea: 'a' }), env)).status, 400);
assert.equal((await worker.fetch(post('/api/plan', { idea: '我要整理我的電腦' }, { origin: 'https://other.example' }), env)).status, 403);

let calls = 0;
globalThis.fetch = async (_url, options) => {
  calls += 1;
  assert.equal(options.headers['x-goog-api-key'], 'test-secret');
  const request = JSON.parse(options.body);
  assert.ok(request.systemInstruction.parts[0].text.includes('第一性原則') || request.systemInstruction.parts[0].text.includes('繁體中文'));
  if (calls === 1) return Response.json({
    candidates: [{ content: { parts: [{ text: JSON.stringify({
      understanding: '想整理電腦，但目的尚未確認。',
      questions: [
        { label: '想從哪裡開始？', options: ['資料夾', '硬碟'] },
        { label: '使用什麼系統？', options: ['Windows', 'macOS'] },
        { label: '具體困擾？', options: [] },
        { label: '第四題不應出現', options: [] }
      ]
    }) }] } }], usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, totalTokenCount: 150 }
  });
  if (calls === 2) return Response.json({
    candidates: [{ content: { parts: [{ text: JSON.stringify({
      objective: '協助我在電腦中尋找資料。',
      steps: ['先確認要找的檔案線索與作業系統。', '依檔名、類型、日期和可能位置縮小搜尋；找不到時再提供下一步。'],
      deliverables: ['提供可照做的搜尋步驟，以及找到檔案後的核對方式。'],
      questions: ['要找什麼資料？', '使用什麼作業系統？', '第三題不應出現'],
      constraints: []
    }) }] } }],
    usageMetadata: { promptTokenCount: 90, candidatesTokenCount: 80, totalTokenCount: 170 }
  });
  if (calls === 3) return Response.json({
    candidates: [{ content: { parts: [{ text: JSON.stringify({ objective: '請先提供資訊', steps: [], deliverables: [], questions: [] }) }] } }]
  });
  return Response.json({}, { status: 429 });
};

const planResponse = await worker.fetch(post('/api/plan', { idea: '我要整理我的電腦' }), env);
assert.equal(planResponse.status, 200);
const plan = await planResponse.json();
assert.equal(plan.questions.length, 3);
assert.match(plan.questions[0].label, /最想先達成/);
assert.ok(plan.questions[0].options.includes('尋找資料'));
assert.equal(plan.usage.totalTokens, 150);

const generatedResponse = await worker.fetch(post('/api/generate', {
  idea: '我要整理我的電腦', answers: [{ question: plan.questions[0].label, answer: '尋找資料' }]
}), env);
assert.equal(generatedResponse.status, 200);
const generated = await generatedResponse.json();
assert.match(generated.text, /# 執行步驟/);
assert.match(generated.text, /縮小搜尋/);
assert.match(generated.text, /尋找資料/);
assert.doesNotMatch(generated.text, /第三題不應出現/);
assert.match(generated.text, /Windows、macOS 還是 Linux/);
assert.match(generated.text, /不要刪除、搬移或覆蓋/);
assert.match(generated.text, /沒有檔案存取工具或授權/);
assert.equal(generated.usage.totalTokens, 170);
assert.equal((await worker.fetch(post('/api/generate', { idea: '我要整理我的電腦' }), env)).status, 502);
assert.equal((await worker.fetch(post('/api/generate', { idea: '我要整理我的電腦' }), env)).status, 429);
assert.equal(calls, 4);

const homepage = await worker.fetch(new Request(url), env);
assert.equal(homepage.status, 200);
assert.match(await homepage.text(), /Ollama · 本機 AI/);
const script = await worker.fetch(new Request(`${url}/app.js?v=3`), env);
assert.equal(script.status, 200);
assert.equal(script.headers.get('cache-control'), 'no-cache');
assert.equal((await worker.fetch(new Request(`${url}/ollama.js`), env)).status, 200);
console.log('Worker API checks passed.');
