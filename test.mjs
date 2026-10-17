import assert from 'node:assert/strict';
import { inferCategory, getQuestions, composePrompt } from './dist/core.js';

assert.equal(inferCategory('幫我修復 Python bug'), 'coding');
assert.equal(inferCategory('幫我寫一封合作邀請信'), 'writing');
assert.equal(inferCategory('分析問卷結果'), 'research');
assert.equal(inferCategory('學習英文'), 'learning');
assert.equal(inferCategory('幫我規劃一週的 Python 入門學習計畫'), 'learning');
assert.equal(inferCategory('設計一張海報'), 'creative');
assert.equal(getQuestions('coding').length, 6);
assert.throws(() => composePrompt({ idea: ' ' }), /至少 2 個字/);

const basic = composePrompt({ idea: '幫我寫邀請信' });
assert.equal(basic.category, 'writing');
assert.equal(basic.missing.length, 6);
assert.match(basic.text, /先問我最多 3 個最重要的問題/);
assert.doesNotMatch(basic.text, /給 CEO/);

const filled = composePrompt({ idea: '幫我寫邀請信', category: 'writing', answers: { audience: '潛在合作夥伴', tone: '專業但親切', format: '郵件', context: '邀請對方參加會議', constraints: '200 字內', length: '三段' } });
assert.equal(filled.missing.length, 0);
assert.match(filled.text, /潛在合作夥伴/);
assert.match(filled.text, /依照「郵件」呈現/);
assert.doesNotMatch(filled.text, /資訊不足時/);
console.log('All prompt generation checks passed.');
