export const CATEGORIES = {
  general: { label: '一般任務', role: '一位能把需求轉成具體成果的專業協作者', action: '先確認任務與可用資訊，再直接完成要求。', specific: [
    { id: 'reference', label: '有沒有可參考的資料或範例？', placeholder: '例如：既有文件、網址、想模仿的風格' },
    { id: 'success', label: '怎樣才算完成得好？', placeholder: '例如：可直接交付、容易理解、包含具體步驟' }
  ] },
  writing: { label: '寫作與溝通', role: '一位重視受眾與表達效果的寫作編輯', action: '先釐清溝通目的，再寫出自然、具體且可直接使用的文字。', specific: [
    { id: 'tone', label: '希望是什麼語氣？', placeholder: '例如：專業但親切、簡潔有說服力' },
    { id: 'length', label: '希望多長？', placeholder: '例如：200 字內、3 段、1 頁' }
  ] },
  learning: { label: '學習與教學', role: '一位擅長循序漸進教學的導師', action: '依學習者程度安排內容，從核心概念到練習與檢核。', specific: [
    { id: 'level', label: '目前的程度與已知基礎？', placeholder: '例如：完全新手、會基本語法' },
    { id: 'time', label: '可用時間或學習期限？', placeholder: '例如：每天 30 分鐘、兩週' }
  ] },
  research: { label: '研究與分析', role: '一位重視證據與推論界線的研究分析師', action: '區分事實、推論與未知，依資料提出有根據的分析。', specific: [
    { id: 'scope', label: '分析範圍與時間區間？', placeholder: '例如：台灣市場、近三年、只分析問卷' },
    { id: 'evidence', label: '需要哪些證據或引用方式？', placeholder: '例如：附來源連結、使用我提供的資料' }
  ] },
  coding: { label: '程式與產品', role: '一位重視可維護性與驗證的軟體工程師', action: '先理解現有環境與需求，再提出可實作的方案並驗證關鍵行為。', specific: [
    { id: 'stack', label: '使用什麼技術或執行環境？', placeholder: '例如：Python 3.12、React、Windows' },
    { id: 'acceptance', label: '完成條件或需處理的邊界情況？', placeholder: '例如：支援手機、處理空輸入、附測試' }
  ] },
  creative: { label: '創意與圖像', role: '一位能將抽象想法轉成具體創作規格的創意總監', action: '明確描述主題、風格、構圖與用途，保留創作空間。', specific: [
    { id: 'style', label: '想要的風格或參考方向？', placeholder: '例如：溫暖插畫、極簡科技感' },
    { id: 'medium', label: '作品媒介、尺寸或使用情境？', placeholder: '例如：社群貼文 1:1、網站橫幅' }
  ] }
};

export const COMMON_QUESTIONS = [
  { id: 'audience', label: '成果是給誰看的或用的？', placeholder: '例如：第一次接觸這個主題的客戶' },
  { id: 'context', label: '有哪些背景資訊一定要知道？', placeholder: '例如：目前情況、已有資料、使用場景' },
  { id: 'format', label: '想要什麼輸出形式？', placeholder: '例如：條列清單、表格、郵件、步驟教學' },
  { id: 'constraints', label: '有哪些限制或一定要避開的事？', placeholder: '例如：預算、字數、用詞、不能編造資料' }
];

const RULES = [
  ['learning', /學習|教學|課程|讀書|解釋|說明|理解|練習|考試|複習|入門|lesson|learn|teach|study/i],
  ['coding', /程式|程式碼|網站|網頁|app|軟體|系統|api|bug|除錯|修復|開發|code|coding|python|javascript|react|資料庫|功能|前端|後端/i],
  ['research', /研究|分析|比較|調查|問卷|報告|數據|市場|文獻|趨勢|research|analy[sz]|survey|data/i],
  ['writing', /寫|撰|文案|郵件|信|文章|簡報稿|社群貼文|履歷|翻譯|改寫|潤飾|故事|write|email|copywriting|blog/i],
  ['creative', /圖片|圖像|插畫|海報|設計|角色|logo|視覺|動畫|影片|攝影|畫|image|illustrat|poster|visual/i]
];

export function inferCategory(idea) {
  const text = String(idea || '').trim();
  if (!text) return 'general';
  for (const [category, pattern] of RULES) if (pattern.test(text)) return category;
  return 'general';
}

export function getQuestions(category) {
  const selected = CATEGORIES[category] ? category : 'general';
  return [...COMMON_QUESTIONS, ...CATEGORIES[selected].specific];
}

function clean(value, max = 1000) { return String(value ?? '').trim().slice(0, max); }

export function composePrompt({ idea, category = 'auto', depth = 'balanced', answers = {} }) {
  const task = clean(idea, 4000);
  if (task.length < 2) throw new Error('請先輸入至少 2 個字的想法。');
  const selected = category === 'auto' ? inferCategory(task) : (CATEGORIES[category] ? category : 'general');
  const meta = CATEGORIES[selected];
  const questions = getQuestions(selected);
  const a = Object.fromEntries(questions.map(q => [q.id, clean(answers[q.id])]));
  const missing = questions.filter(q => !a[q.id]).map(q => q.label);
  const lines = [`# 任務`, `請擔任${meta.role}，協助我完成以下任務：`, task, '', '# 已知需求'];
  const provided = questions.filter(q => a[q.id]);
  if (provided.length) {
    for (const q of provided) lines.push(`- ${q.label.replace(/[？?]$/, '')}：${a[q.id]}`);
  } else lines.push('- 目前只提供上方的任務描述；請勿自行補成確定的背景事實。');
  lines.push('', '# 工作方式', `1. ${meta.action}`);
  if (selected === 'research') {
    lines.push('2. 對重要結論提供可核對的依據；無法查證時明確標示。');
  } else if (selected === 'coding') {
    lines.push('2. 說明主要實作、驗證方式與仍存在的限制。');
  } else if (selected === 'learning') {
    lines.push('2. 使用容易理解的例子，安排練習或自我檢核。');
  } else if (selected === 'writing') {
    lines.push('2. 用符合讀者與目的的語氣撰寫，避免空泛套話。');
  } else if (selected === 'creative') {
    lines.push('2. 具體描述可視元素與氛圍，避免互相衝突的要求。');
  } else lines.push('2. 優先提供能直接使用的內容與具體步驟。');
  if (depth === 'detailed') {
    lines.push('3. 先整理執行重點，再產出成果，最後核對成果是否符合已知需求。');
    lines.push('4. 對不確定的資訊標示假設，避免捏造數字、來源或既定條件。');
  } else if (depth === 'concise') {
    lines.push('3. 直接給出成果；必要說明保持簡短。');
  } else lines.push('3. 保持內容清楚、具體；必要時簡述採用的假設。');
  lines.push('', '# 輸出要求');
  lines.push(`- 使用繁體中文。`);
  lines.push(`- ${a.format ? `依照「${a.format}」呈現。` : '使用最適合這個任務、方便閱讀與使用的格式。'}`);
  if (depth === 'detailed') lines.push('- 交付前檢查：是否完成任務、符合限制、資訊可核對、格式正確。');
  if (missing.length) {
    lines.push('', '# 資訊不足時');
    lines.push(`若缺少的資訊會明顯影響成果，請先問我最多 3 個最重要的問題。優先確認：${missing.slice(0, 3).join('、')}。若任務描述已包含答案，無須重複提問。若不影響主要成果，可明示合理假設後繼續；不要把假設寫成事實。`);
  }
  return { text: lines.join('\n'), category: selected, missing, filled: provided.length, total: questions.length };
}
