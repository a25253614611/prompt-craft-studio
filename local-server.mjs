import http from 'node:http';

await import('./build.mjs');
const { default: worker } = await import('./dist/server/index.js');
const host = '127.0.0.1';
const port = 4173;

http.createServer(async (incoming, outgoing) => {
  if (incoming.url === '/__prompt-studio-health') {
    outgoing.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    outgoing.end('{"app":"prompt-craft-studio"}');
    return;
  }
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of incoming) {
      size += chunk.length;
      if (size > 16000) {
        outgoing.writeHead(413, { 'content-type': 'application/json' });
        outgoing.end('{"error":"輸入過長。"}');
        return;
      }
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);
    const headers = new Headers();
    if (incoming.headers['content-type']) headers.set('content-type', incoming.headers['content-type']);
    if (incoming.headers.origin) headers.set('origin', incoming.headers.origin);
    const request = new Request(`http://${host}:${port}${incoming.url}`, {
      method: incoming.method,
      headers,
      ...(body.length ? { body } : {})
    });
    const response = await worker.fetch(request, { GEMINI_API_KEY: process.env.GEMINI_API_KEY });
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    outgoing.writeHead(500, { 'content-type': 'application/json' });
    outgoing.end('{"error":"本機服務發生錯誤。"}');
  }
}).listen(port, host, () => console.log(`Prompt Craft Studio: http://${host}:${port}/`));
