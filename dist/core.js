export const CATEGORIES = {
  general: { label: '一般任務' },
  computer: { label: '電腦整理' },
  writing: { label: '寫作與溝通' },
  learning: { label: '學習與教學' },
  research: { label: '研究與分析' },
  coding: { label: '程式與產品' },
  creative: { label: '創意與圖像' }
};

const COMPUTER_INTENTS = {
  find: {
    label: '尋找資料',
    question: '你想找什麼資料？',
    placeholder: '例如：去年拍的照片、某份 Word 文件',
    instruction: '先依檔名、類型、日期與可能位置縮小搜尋範圍；提供可照做的搜尋步驟。找不到時再提出下一步。不要建議刪除檔案。'
  },
  free_space: {
    label: '釋放空間',
    question: '哪個磁碟或資料夾空間不足？',
    placeholder: '例如：C 槽剩 5 GB；不確定也可以留空',
    instruction: '先教我查看空間使用情況，再按風險列出可清理項目。任何刪除、解除安裝或清空資源回收筒的動作，都要先說明影響並徵得我確認。'
  },
  organize: {
    label: '分類檔案',
    question: '你要整理哪裡的檔案？',
    placeholder: '例如：下載資料夾、桌面、照片',
    instruction: '先盤點檔案與現有分類，再提出簡單的資料夾結構和搬移順序。執行前列出會移動或更名的項目，避免覆蓋與遺失。'
  },
  performance: {
    label: '改善速度',
    question: '哪種情況下電腦變慢？',
    placeholder: '例如：開機慢、瀏覽器卡頓',
    instruction: '先協助判斷瓶頸與可觀察的症狀，再依診斷結果建議改善步驟；不要把刪檔當成預設解法。'
  },
  backup: {
    label: '備份或搬移',
    question: '你要備份或搬移哪些資料？目的地在哪裡？',
    placeholder: '例如：把照片備份到外接硬碟',
    instruction: '先規劃來源、目的地與備份方式。完成後教我核對檔案數量與抽查內容；在驗證成功前保留原始資料。'
  },
  unknown: {
    label: '還不確定',
    question: '目前最困擾你的現象是什麼？',
    placeholder: '例如：桌面很亂、硬碟快滿、找不到檔案',
    instruction: '先用簡短問題幫我釐清是尋找資料、釋放空間、分類檔案、備份，還是改善速度；確認目的前不要提出刪除或搬移建議。'
  }
};

const COMMON_QUESTIONS = [
  { id: 'goal', label: '你希望最後得到什麼結果？', placeholder: '例如：完成一封可寄出的信、找出問題原因' },
  { id: 'context', label: '有哪些必要背景或素材？', placeholder: '只寫任務需要的資訊' },
  { id: 'constraints', label: '有什麼限制或不能做的事？', placeholder: '例如：時間、字數、工具、風格限制' }
];

const CATEGORY_QUESTIONS = {
  general: [{ id: 'format', label: '你希望結果怎麼呈現？', placeholder: '例如：清單、表格、步驟' }],
  writing: [
    { id: 'audience', label: '內容要寫給誰？', placeholder: '例如：同事、客戶、學生' },
    { id: 'tone', label: '希望什麼語氣？', placeholder: '例如：專業、親切、簡潔' },
    { id: 'format', label: '要寫成什麼形式？', placeholder: '例如：電子郵件、貼文、報告' }
  ],
  learning: [
    { id: 'level', label: '目前程度如何？', placeholder: '例如：完全新手、有基礎' },
    { id: 'time', label: '有多少學習時間？', placeholder: '例如：每天 30 分鐘，持續一週' }
  ],
  research: [
    { id: 'material', label: '有哪些資料或來源？', placeholder: '例如：問卷結果、網址、文件' },
    { id: 'focus', label: '最想釐清哪個問題？', placeholder: '例如：成因、差異、改善方向' }
  ],
  coding: [
    { id: 'platform', label: '程式要在哪裡執行？', placeholder: '例如：Windows、手機、瀏覽器；不確定可留空' },
    { id: 'inputs', label: '程式要讀取什麼，產出什麼？', placeholder: '例如：讀取 CSV，輸出整理後的表格' }
  ],
  creative: [
    { id: 'theme', label: '作品的主題或要傳達的訊息是什麼？', placeholder: '例如：校園活動、產品上市' },
    { id: 'style', label: '想要什麼風格？', placeholder: '例如：極簡、溫暖、復古' },
    { id: 'usage', label: '成果會用在哪裡？', placeholder: '例如：社群貼文、簡報封面' }
  ]
};

const CODING_FIX_QUESTIONS = [
  { id: 'environment', label: '使用什麼語言或環境？', placeholder: '例如：Python 3.12、React' },
  { id: 'symptom', label: '錯誤訊息或目前行為是什麼？', placeholder: '貼上錯誤訊息與重現步驟' },
  { id: 'expected', label: '你預期程式怎麼運作？', placeholder: '描述正確結果' }
];

const compact = idea => idea.replace(/[\s，。？！!?：:、]/g, '');
const codingMode = idea => /修復|除錯|偵錯|bug|錯誤|壞掉|無法執行|不能運作/i.test(idea) ? 'fix' : 'build';

function clarificationFor(category, idea) {
  const short = compact(idea);
  if (category === 'coding') {
    if (codingMode(idea) === 'fix' && /^(幫我|請幫我|我要|我想)?(修復|除錯|偵錯)(Python|JavaScript|React)?(程式|代碼|bug)?$/i.test(short)) {
      return { id: 'symptom', label: '請提供錯誤訊息或具體症狀' };
    }
    if (/^(幫我|請幫我|我要|我想)?(做|寫|建立|開發|製作)?(一個|一款)?(程式|軟體|網站|網頁|APP)$/i.test(short)) {
      return { id: 'goal', label: '這個程式要替你完成什麼工作？' };
    }
  }
  if (category === 'writing' && /^(幫我|請幫我|我要|我想)?(寫|撰寫)?(一封|一篇)?(信|文章|貼文|文案)$/.test(short)) {
    return { id: 'goal', label: '這份內容要達成什麼目的？' };
  }
  if (category === 'learning' && /^(我要|我想|幫我)?(學|學習)(英文|日文|中文|程式|數學|語言)$/.test(short)) {
    return { id: 'goal', label: '你學這個主題最想達成什麼？' };
  }
  if (category === 'research' && /^(幫我|請幫我|我要|我想)?(分析|研究|調查)(問卷結果|資料|數據|市場)$/.test(short)) {
    return { id: 'material', label: '你有什麼資料可以分析？' };
  }
  if (category === 'creative' && /^(幫我|請幫我|我要|我想)?(設計|做|製作)(一張|一個)?(海報|圖片|圖像|插畫|logo)$/i.test(short)) {
    return { id: 'theme', label: '作品的主題或要傳達的訊息是什麼？' };
  }
  if (category === 'general' && /整理|處理|改善|優化|管理|幫我做/.test(idea)) {
    return { id: 'goal', label: '你希望最後得到什麼結果？' };
  }
  return null;
}

export function inferCategory(idea = '') {
  if (/電腦|硬碟|磁碟|桌面|資料夾|檔案|文件整理|備份|垃圾檔案|儲存空間/.test(idea) && /整理|清理|清除|刪除|尋找|搜尋|找|空間|容量|備份|搬移|移動|變慢|速度/.test(idea)) return 'computer';
  if (/學習|教學|入門|讀書|課程|複習|練習計畫|想學|要學|學英文|學日文|學數學/.test(idea)) return 'learning';
  if (/程式|網站|APP|bug|除錯|開發|程式碼|Python|JavaScript|React/.test(idea)) return 'coding';
  if (/研究|分析|數據|問卷|資料集|比較|調查/.test(idea)) return 'research';
  if (/寫|文案|信|文章|貼文|簡報稿|翻譯|改寫/.test(idea)) return 'writing';
  if (/設計|海報|圖片|插畫|創意|故事/.test(idea)) return 'creative';
  return 'general';
}

export function inferComputerIntent(idea = '') {
  if (/找不到|尋找|搜尋|找.{0,8}(檔案|資料|文件|照片)/.test(idea)) return 'find';
  if (/空間不足|容量不足|釋放空間|清理空間|磁碟已滿|硬碟已滿|刪除.{0,8}(檔案|資料)|清掉.{0,8}(檔案|資料)/.test(idea)) return 'free_space';
  if (/備份|轉移資料|搬到.{0,8}(硬碟|電腦)/.test(idea)) return 'backup';
  if (/變慢|速度|卡頓|開機慢/.test(idea)) return 'performance';
  if (/分類|歸檔|整理.{0,8}(檔案|文件|照片|資料夾)/.test(idea)) return 'organize';
  return '';
}

export function getQuestions(category = 'general', answers = {}, idea = '') {
  if (category === 'computer') {
    const intent = answers.intent || inferComputerIntent(idea);
    const questions = [
      { id: 'intent', label: '這次整理電腦，主要想達成什麼？', required: !inferComputerIntent(idea), options: Object.entries(COMPUTER_INTENTS).map(([value, data]) => ({ value, label: data.label })) },
      { id: 'os', label: '使用什麼作業系統？', options: ['Windows', 'macOS', 'Linux', '不確定'].map(value => ({ value, label: value })) }
    ];
    if (COMPUTER_INTENTS[intent]) questions.push({ id: 'target', label: COMPUTER_INTENTS[intent].question, placeholder: COMPUTER_INTENTS[intent].placeholder });
    questions.push({ id: 'context', label: '目前情況或試過哪些方法？', placeholder: '例如：找過下載資料夾、C 槽剩 5 GB' });
    questions.push({ id: 'protect', label: '哪些資料不能動？', placeholder: '例如：工作文件、照片；不確定可留空' });
    return questions;
  }
  const clarification = clarificationFor(category, idea);
  const specific = category === 'coding' && codingMode(idea) === 'fix' ? CODING_FIX_QUESTIONS : CATEGORY_QUESTIONS[category] || CATEGORY_QUESTIONS.general;
  return [...COMMON_QUESTIONS, ...specific].map(q => q.id === clarification?.id ? { ...q, label: clarification.label, required: true } : q);
}

const clean = value => String(value ?? '').trim();
const bullet = (label, value) => value ? `- ${label}：${value}` : '';

function computerPrompt(idea, answers, depth) {
  const intent = answers.intent || inferComputerIntent(idea);
  if (!COMPUTER_INTENTS[intent]) {
    const error = new Error('先選擇這次整理電腦的主要目的，再產生提示詞。');
    error.code = 'CLARIFICATION_REQUIRED';
    error.questionId = 'intent';
    throw error;
  }
  const data = COMPUTER_INTENTS[intent];
  const details = [
    bullet('作業系統', answers.os),
    bullet('整理範圍或目標', answers.target),
    bullet('目前情況', answers.context),
    bullet('不能動的資料', answers.protect)
  ].filter(Boolean);
  const lines = [
    intent === 'unknown' ? `請先幫我釐清「${idea}」的具體目的。` : `需求：${idea}\n主要目的：${data.label}`,
    details.length ? `已知資訊：\n${details.join('\n')}` : '',
    !answers.target ? `先問我「${data.question}」` : '',
    !answers.os ? '若步驟依作業系統而異，先問我是 Windows、macOS 還是 Linux。' : '',
    data.instruction,
    '請用繁體中文回答；不要猜測我的檔案狀態。',
    depth === 'detailed' ? '每一步註明預期看到的結果與失敗時的下一步。' : ''
  ].filter(Boolean);
  return lines.join('\n\n');
}

function generalPrompt(idea, category, answers, depth) {
  const labels = { goal: '目標成果', context: '背景與素材', constraints: '限制', audience: '對象', tone: '語氣', format: '形式', level: '目前程度', time: '可用時間', material: '資料來源', focus: '分析重點', environment: '技術環境', symptom: '錯誤或症狀', expected: '預期行為', platform: '執行平台', inputs: '輸入與輸出', theme: '主題', style: '風格', usage: '用途' };
  const buildingProgram = category === 'coding' && codingMode(idea) === 'build' && answers.goal;
  const fields = getQuestions(category, answers, idea).filter(q => clean(answers[q.id]) && !(buildingProgram && q.id === 'goal')).map(q => bullet(labels[q.id] || q.label, clean(answers[q.id])));
  const lines = [buildingProgram ? `請設計並實作一個程式，功能是：${answers.goal}。` : `請協助我完成：${idea}`];
  if (fields.length) lines.push(`補充資訊：\n${fields.join('\n')}`);
  const method = {
    writing: '依目標與對象寫出可直接使用的內容；若缺少會改變內容方向的資訊，先問我。',
    learning: '依目前程度與可用時間安排可執行的學習步驟，附上練習與檢查進度的方法。',
    research: '先說明分析依據，再整理發現、限制與可行建議；資料不足時不要編造結果。',
    coding: codingMode(idea) === 'fix' ? '請根據症狀與預期行為定位原因，提出可執行的修正與驗證步驟。' : '請依功能目標提出最小可用版本、實作步驟與驗證方法；缺少平台或輸入輸出資訊時先問我。',
    creative: '依用途與風格產出可實作的方案，描述關鍵元素與構圖。',
    general: '先釐清目標，再提供可執行的結果或步驟。'
  };
  lines.push(method[category] || method.general);
  if (buildingProgram && /檔案|資料夾|刪除|搬移|更名/.test(`${idea} ${answers.goal}`)) lines.push('若會移動、更名或刪除檔案，先提供預覽並避免覆蓋既有資料。');
  if (depth === 'detailed') lines.push('包含必要的檢查方式與可能限制。');
  if (depth !== 'concise') lines.push('請使用繁體中文，內容清楚精簡。');
  return lines.join('\n\n');
}

export function composePrompt({ idea, category = 'auto', depth = 'balanced', answers = {} }) {
  idea = clean(idea).slice(0, 4000);
  if (idea.length < 2) throw new Error('先寫下至少 2 個字的想法。');
  const selected = category === 'auto' || !CATEGORIES[category] ? inferCategory(idea) : category;
  const normalized = Object.fromEntries(Object.entries(answers && typeof answers === 'object' ? answers : {}).map(([key, value]) => [key, clean(value).slice(0, 1000)]));
  const questions = getQuestions(selected, normalized, idea);
  const required = questions.find(q => q.required && ((normalized[q.id] || '').length < 2 || /^[ㄅ-ㄩˊˇˋ˙]+$/.test(normalized[q.id] || '')));
  if (required) {
    const error = new Error(required.id === 'intent' ? '先選擇這次整理電腦的主要目的，再產生提示詞。' : `先回答「${required.label}」，再產生提示詞。`);
    error.code = 'CLARIFICATION_REQUIRED';
    error.questionId = required.id;
    throw error;
  }
  const text = selected === 'computer' ? computerPrompt(idea, normalized, depth) : generalPrompt(idea, selected, normalized, depth);
  return {
    text,
    category: selected,
    filled: questions.filter(q => normalized[q.id]).length,
    total: questions.length,
    missing: questions.filter(q => !normalized[q.id] && !(q.id === 'intent' && inferComputerIntent(idea))).map(q => q.label)
  };
}
