import { readFile, mkdir, writeFile } from 'node:fs/promises';

const root = new URL('.', import.meta.url);
const files = {
  '/index.html': ['dist/index.html', 'text/html; charset=utf-8'],
  '/app.js': ['dist/app.js', 'text/javascript; charset=utf-8'],
  '/core.js': ['dist/core.js', 'text/javascript; charset=utf-8'],
  '/styles.css': ['dist/styles.css', 'text/css; charset=utf-8']
};
const assets = {};
for (const [route, [file, type]] of Object.entries(files)) {
  assets[route] = { body: await readFile(new URL(file, root), 'utf8'), type };
}
const source = await readFile(new URL('worker/handler.js', root), 'utf8');
if (!source.includes('__ASSETS__')) throw new Error('Worker asset marker missing');
const output = source.replace('__ASSETS__', JSON.stringify(assets));
await mkdir(new URL('dist/server/', root), { recursive: true });
await mkdir(new URL('dist/.openai/', root), { recursive: true });
await writeFile(new URL('dist/server/index.js', root), output);
await writeFile(new URL('dist/.openai/hosting.json', root), await readFile(new URL('.openai/hosting.json', root)));
console.log('Worker bundle built');
