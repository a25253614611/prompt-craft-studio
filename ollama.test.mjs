import assert from 'node:assert/strict';
import { checkOllama, ollamaApi } from './dist/ollama.js';

let calls = 0;
let badOutput = false;
globalThis.fetch = async (url, options) => {
  calls += 1;
  assert.match(url, /^http:\/\/127\.0\.0\.1:11434\/api\//);
  if (url.endsWith('/tags')) return Response.json({ models: [{ name: 'qwen3:4b' }] });
  const body = JSON.parse(options.body);
  assert.equal(body.model, 'qwen3:4b');
  assert.equal(body.stream, false);
  assert.equal(body.think, false);
  assert.equal(body.options.num_ctx, 8192);
  assert.match(body.messages[1].content, /\/no_think/);
  if (body.format === 'json') return Response.json({
    message: { content: JSON.stringify({ understanding: '整理目的尚未明確', questions: [
      { label: '使用哪種系統？', options: ['Windows', 'macOS'] },
      { label: '目前有何困擾？', options: [] },
      { label: '優先處理哪裡？', options: [] },
      { label: '多餘題目', options: [] }
    ] }) }, prompt_eval_count: 70, eval_count: 30
  });
  assert.deepEqual(body.format.required, ['prompt']);
  return Response.json({
    message: { content: JSON.stringify({ prompt: badOutput ? '首先，我需要分析使用者的 JSON。' : '請協助我整理電腦，目的是尋找資料。先盤點已知檔名、日期與可能資料夾，列出優先搜尋位置與可執行步驟。完成時請回報找到的檔案路徑，或說明已查過的位置與下一步；未確認前不要刪除或移動檔案。' }) },
    prompt_eval_count: 80, eval_count: 40
  });
};

assert.equal((await checkOllama()).available, true);
const plan = await ollamaApi('plan', { idea: '我要整理我的電腦', category: 'auto', depth: 'balanced' });
assert.equal(plan.questions.length, 1);
assert.match(plan.questions[0].label, /最想先達成/);
assert.equal(plan.usage.totalTokens, 0);
assert.equal(plan.usage.calls, 0);
const productPlan = await ollamaApi('plan', { idea: '請驗收這個網頁，第一版要有作品藝廊與投稿管理。' });
assert.equal(productPlan.questions.length, 1);
assert.match(productPlan.questions[0].label, /網址/);
assert.equal(calls, 1);
const generalPlan = await ollamaApi('plan', { idea: '幫我寫一封合作邀請信' });
assert.equal(generalPlan.questions.length, 3);
assert.equal(generalPlan.usage.totalTokens, 100);
const result = await ollamaApi('generate', {
  idea: '我要整理我的電腦', category: 'auto', depth: 'balanced',
  answers: [{ question: plan.questions[0].label, answer: '尋找資料' }]
});
assert.match(result.text, /找出需要的資料/);
assert.match(result.text, /完整路徑/);
assert.match(result.text, /不刪除、搬移或覆蓋/);
assert.equal(result.source, 'rules');
assert.equal(result.usage.calls, 0);
const modelResult = await ollamaApi('generate', { idea: '幫我寫一封合作邀請信' });
assert.equal(modelResult.usage.totalTokens, 120);
badOutput = true;
await assert.rejects(() => ollamaApi('generate', { idea: '幫我寫一封合作邀請信' }), /品質不足/);
assert.equal(calls, 4);
console.log('Ollama integration checks passed.');
