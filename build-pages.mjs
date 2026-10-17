import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';

const input = new URL('./dist/', import.meta.url);
const output = new URL('./.pages/', import.meta.url);
await mkdir(output, { recursive: true });
for (const name of ['app.js', 'core.js', 'ollama.js', 'styles.css']) {
  await copyFile(new URL(name, input), new URL(name, output));
}

let html = await readFile(new URL('index.html', input), 'utf8');
function replaceOnce(before, after) {
  if (!html.includes(before)) throw new Error(`GitHub Pages template marker missing: ${before.slice(0, 60)}`);
  html = html.replace(before, after);
}
replaceOnce('<html lang="zh-Hant">', '<html lang="zh-Hant" data-mode="rules">');
replaceOnce('Ollama · Gemini · 規則</span>', 'GitHub Pages · 規則版</span>');
replaceOnce('可選 Ollama、Gemini 或本機規則</span>', '免金鑰、瀏覽器內直接產生</span>');
replaceOnce('<option value="ollama" disabled>Ollama · 本機 AI</option><option value="gemini" disabled>Gemini · 雲端 AI</option>', '');
replaceOnce('Ollama 僅在這台電腦執行，需安裝 qwen3:4b；Gemini 會將內容傳給 Google。<a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer">Gemini 資料使用說明 ↗</a>', '此 GitHub Pages 版本在瀏覽器內使用規則產生，不需 API 金鑰。<a href="https://prompt-craft-studio.a25253614611.chatgpt.site/" target="_blank" rel="noopener noreferrer">開啟 Gemini 完整版（僅擁有者可用）↗</a>');
replaceOnce('Ollama 與 Gemini 模式會用模型分析需求並產生具體提示詞；規則模式無須模型。', '此版本使用本機規則產生提示詞，無須模型或 API 金鑰。');
replaceOnce('使用 AI 時會顯示本次呼叫與 token 用量。', '此版本不會呼叫 AI API。');
await writeFile(new URL('index.html', output), html);
await writeFile(new URL('.nojekyll', output), '');
console.log('GitHub Pages static artifact built');
