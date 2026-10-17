import assert from 'node:assert/strict';
import { checkOllama, ollamaApi } from './dist/ollama.js';

let calls = 0;
globalThis.fetch = async (url, options) => {
  calls += 1;
  assert.match(url, /^http:\/\/127\.0\.0\.1:11434\/api\//);
  if (url.endsWith('/tags')) return Response.json({ models: [{ name: 'qwen3:4b' }] });
  const body = JSON.parse(options.body);
  assert.equal(body.model, 'qwen3:4b');
  assert.equal(body.stream, false);
  assert.equal(body.think, false);
  if (body.format === 'json') return Response.json({
    message: { content: JSON.stringify({ understanding: '整理目的尚未明確', questions: [
      { label: '使用哪種系統？', options: ['Windows', 'macOS'] },
      { label: '目前有何困擾？', options: [] },
      { label: '優先處理哪裡？', options: [] },
      { label: '多餘題目', options: [] }
    ] }) }, prompt_eval_count: 70, eval_count: 30
  });
  return Response.json({
    message: { content: '請協助我整理電腦，目的是尋找資料。先盤點已知檔名、日期與可能資料夾，列出搜尋步驟；未確認前不要刪除或移動。' },
    prompt_eval_count: 80, eval_count: 40
  });
};

assert.equal((await checkOllama()).available, true);
const plan = await ollamaApi('plan', { idea: '我要整理我的電腦', category: 'auto', depth: 'balanced' });
assert.equal(plan.questions.length, 3);
assert.match(plan.questions[0].label, /最想先達成/);
assert.equal(plan.usage.totalTokens, 100);
const result = await ollamaApi('generate', {
  idea: '我要整理我的電腦', category: 'auto', depth: 'balanced',
  answers: [{ question: plan.questions[0].label, answer: '尋找資料' }]
});
assert.match(result.text, /尋找資料/);
assert.equal(result.usage.totalTokens, 120);
assert.equal(calls, 3);
console.log('Ollama integration checks passed.');
