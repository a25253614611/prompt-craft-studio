import assert from 'node:assert/strict';
import { inferCategory, inferComputerIntent, getQuestions, composePrompt } from './dist/core.js';

assert.equal(inferCategory('我要整理我的電腦'), 'computer');
assert.equal(inferCategory('幫我修復 Python bug'), 'coding');
assert.equal(inferCategory('幫我寫一封合作邀請信'), 'writing');
assert.equal(inferCategory('分析問卷結果'), 'research');
assert.equal(inferCategory('學習英文'), 'learning');
assert.equal(inferCategory('幫我規劃一週的 Python 入門學習計畫'), 'learning');
assert.equal(inferCategory('設計一張海報'), 'creative');
assert.equal(inferComputerIntent('我要整理我的電腦'), '');
assert.equal(inferComputerIntent('我要找不到的照片'), 'find');
assert.throws(() => composePrompt({ idea: ' ' }), /至少 2 個字/);
assert.throws(
  () => composePrompt({ idea: '我要整理我的電腦' }),
  error => error.code === 'CLARIFICATION_REQUIRED' && error.questionId === 'intent'
);
assert.throws(
  () => composePrompt({ idea: '我要整理我的房間' }),
  error => error.code === 'CLARIFICATION_REQUIRED' && error.questionId === 'goal'
);
assert.match(composePrompt({ idea: '我要整理我的房間', answers: { goal: '找出遺失的鑰匙' } }).text, /找出遺失的鑰匙/);

const computerQuestions = getQuestions('computer', { intent: 'find' });
assert.equal(computerQuestions[0].id, 'intent');
assert.match(computerQuestions.find(q => q.id === 'target').label, /找什麼資料/);
assert.match(getQuestions('computer', { intent: 'free_space' }).find(q => q.id === 'target').label, /空間不足/);

const find = composePrompt({ idea: '我要整理我的電腦', answers: { intent: 'find', target: '去年拍的照片', os: 'Windows' } });
assert.equal(find.category, 'computer');
assert.match(find.text, /去年拍的照片/);
assert.match(find.text, /檔名、類型、日期/);
assert.doesNotMatch(find.text, /解除安裝|清空資源回收筒/);
assert.doesNotMatch(find.text, /專業協作者|成果是給誰看的/);

const cleanup = composePrompt({ idea: '我要整理我的電腦', answers: { intent: 'free_space' } });
assert.match(cleanup.text, /空間使用情況/);
assert.match(cleanup.text, /徵得我確認/);
assert.doesNotMatch(cleanup.text, /先依檔名/);

const unsure = composePrompt({ idea: '我要整理我的電腦', answers: { intent: 'unknown' } });
assert.match(unsure.text, /先幫我釐清/);
assert.match(unsure.text, /確認目的前不要提出刪除或搬移建議/);

const writing = composePrompt({ idea: '幫我寫邀請信', answers: { audience: '潛在合作夥伴', tone: '專業但親切', format: '電子郵件' } });
assert.equal(writing.category, 'writing');
assert.match(writing.text, /潛在合作夥伴/);
assert.match(writing.text, /電子郵件/);
assert.doesNotMatch(writing.text, /專業協作者/);
assert.doesNotMatch(writing.text, /成果是給誰看的/);

console.log('All prompt generation checks passed.');
