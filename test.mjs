import assert from 'node:assert/strict';
import { inferCategory, inferComputerIntent, inferProductTask, getQuestions, composePrompt } from './dist/core.js';

assert.equal(inferCategory('我要整理我的電腦'), 'computer');
assert.equal(inferCategory('幫我修復 Python bug'), 'coding');
assert.equal(inferCategory('幫我寫一封合作邀請信'), 'writing');
assert.equal(inferCategory('分析問卷結果'), 'research');
assert.equal(inferCategory('學習英文'), 'learning');
assert.equal(inferCategory('幫我規劃一週的 Python 入門學習計畫'), 'learning');
assert.equal(inferCategory('設計一張海報'), 'creative');
assert.equal(inferCategory('我要學英文'), 'learning');
assert.equal(inferCategory('第一版先完成作品藝廊與投稿管理，之後再加入排行榜。這是產品分析。'), 'product');
assert.equal(inferCategory('幫我修復第一版網站的錯誤'), 'coding');
assert.equal(inferCategory('幫我寫第一版文章'), 'writing');
assert.equal(inferProductTask('第一版先完成作品藝廊與投稿管理，之後再加入排行榜。這是產品分析。'), '');
assert.equal(inferProductTask('請制定第一版的驗收標準'), 'acceptance');
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
for (const [idea, questionId] of [
  ['我要一個程式', 'goal'],
  ['幫我寫一封信', 'goal'],
  ['我要學英文', 'goal'],
  ['分析問卷結果', 'material'],
  ['設計一張海報', 'theme'],
  ['幫我修復 Python bug', 'symptom']
]) {
  assert.throws(() => composePrompt({ idea }), error => error.code === 'CLARIFICATION_REQUIRED' && error.questionId === questionId);
  assert.equal(getQuestions(inferCategory(idea), {}, idea).find(q => q.id === questionId).required, true);
}
const program = composePrompt({ idea: '我要一個程式', answers: { goal: '自動整理下載資料夾' } });
assert.throws(() => composePrompt({ idea: '我要一個程式', answers: { goal: 'ㄍ' } }), error => error.questionId === 'goal');
assert.match(program.text, /自動整理下載資料夾/);
assert.match(program.text, /最小可用版本/);
assert.match(program.text, /先提供預覽並避免覆蓋/);
assert.doesNotMatch(program.text, /修正|錯誤訊息/);
assert.match(composePrompt({ idea: '我想做一個記帳程式' }).text, /最小可用版本/);
assert.match(composePrompt({ idea: '幫我修復 Python bug', answers: { symptom: '執行時出現 TypeError' } }).text, /定位原因/);

const computerQuestions = getQuestions('computer', { intent: 'find' });
assert.deepEqual(computerQuestions.map(q => q.id), ['intent', 'target', 'os']);
assert.match(computerQuestions.find(q => q.id === 'target').label, /找什麼資料/);
assert.match(getQuestions('computer', { intent: 'free_space' }).find(q => q.id === 'target').label, /空間不足/);
assert.match(getQuestions('computer', {}, '我要整理我的電腦')[1].label, /具體的困擾/);
for (const [category, idea, ids] of [
  ['general', '我要整理我的房間', ['goal', 'context', 'constraints']],
  ['computer', '我要整理我的電腦', ['intent', 'target', 'os']],
  ['writing', '幫我寫一封信', ['goal', 'audience', 'context']],
  ['learning', '我要學英文', ['goal', 'level', 'time']],
  ['research', '分析問卷結果', ['goal', 'material', 'focus']],
  ['product', '第一版先做作品藝廊', ['productTask', 'source', 'criterion']],
  ['coding', '我要一個程式', ['goal', 'platform', 'inputs']],
  ['coding', '幫我修復 Python bug', ['symptom', 'expected', 'environment']],
  ['creative', '設計一張海報', ['theme', 'usage', 'style']]
]) {
  assert.deepEqual(getQuestions(category, {}, idea).map(q => q.id), ids, `${category}: ${idea}`);
}

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

const writing = composePrompt({ idea: '幫我寫邀請信', answers: { goal: '邀請對方參加發表會', audience: '潛在合作夥伴', context: '活動在週五舉行', tone: '專業但親切', format: '電子郵件' } });
assert.equal(writing.category, 'writing');
assert.match(writing.text, /潛在合作夥伴/);
assert.match(writing.text, /週五舉行/);
assert.doesNotMatch(writing.text, /專業但親切|電子郵件/);
assert.doesNotMatch(writing.text, /專業協作者/);
assert.doesNotMatch(writing.text, /成果是給誰看的/);

const productIdea = '第一版先完成作品藝廊、搜尋分類、作品詳情及投稿管理；有穩定內容後，再加入排行榜、指令集與小工具。這是根據公開頁面做的產品分析。';
assert.throws(() => composePrompt({ idea: productIdea }), error => error.code === 'CLARIFICATION_REQUIRED' && error.questionId === 'productTask');
const review = composePrompt({ idea: productIdea, answers: { productTask: 'review' } });
assert.equal(review.category, 'product');
assert.equal(review.total, 3);
assert.match(review.text, /評估第一版範圍/);
assert.match(review.text, /作品藝廊、搜尋分類、作品詳情及投稿管理/);
assert.match(review.text, /排行榜、指令集與小工具/);
assert.match(review.text, /可觀察的驗收條件/);
assert.match(review.text, /尚未提供網址或擷取證據/);
assert.doesNotMatch(review.text, /請協助我完成：/);
assert.doesNotMatch(review.text, /先說明分析依據，再整理發現、限制與可行建議/);
const acceptance = composePrompt({ idea: productIdea, answers: { productTask: 'acceptance', source: 'https://example.com/gallery' } });
assert.match(acceptance.text, /操作步驟、預期結果與失敗或空狀態/);
assert.match(acceptance.text, /https:\/\/example.com\/gallery/);
assert.doesNotMatch(acceptance.text, /尚未提供網址或擷取證據/);
assert.equal(composePrompt({ idea: '請制定第一版作品藝廊的驗收標準' }).filled, 1);

console.log('All prompt generation checks passed.');
