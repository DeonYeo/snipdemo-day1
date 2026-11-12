'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { test } = require('node:test');
const { browserCommand, run } = require('./cli');

function invoke(args, base) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['cli.js', ...args], {
      cwd: __dirname,
      env: { ...process.env, SNIP_API: base },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr += data; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('CLI validates arguments and reports unavailable backend on stderr', async () => {
  const help = await invoke(['help'], 'http://127.0.0.1:1');
  assert.equal(help.code, 0);
  assert.match(help.stdout, /snip add <url>/);
  const bad = await invoke(['add', 'javascript:alert(1)'], 'http://127.0.0.1:1');
  assert.equal(bad.code, 1);
  assert.match(bad.stderr, /HTTP or HTTPS/);
  const unreachable = await invoke(['ls'], 'http://127.0.0.1:1');
  assert.equal(unreachable.code, 1);
  assert.equal(unreachable.stdout, '');
  assert.match(unreachable.stderr, /Unable to reach backend/);
  const badCode = await invoke(['open', '../abc'], 'http://127.0.0.1:1');
  assert.equal(badCode.code, 1);
  assert.match(badCode.stderr, /six letters or digits/);
});

test('add, list and manual redirect use the shared API contract', async (t) => {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    requests.push(`${req.method} ${req.url}`);
    if (req.method === 'POST' && req.url === '/api/links') {
      let body = '';
      for await (const chunk of req) body += chunk;
      assert.deepEqual(JSON.parse(body), { url: 'https://example.com/' });
      res.writeHead(201, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ shortUrl: 'http://example.test/Ab12Cd' }));
    } else if (req.url === '/api/links') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify([{ code: 'Ab12Cd', hits: 2, url: 'https://example.com/' }]));
    } else if (req.url === '/Ab12Cd') {
      res.writeHead(302, { location: 'https://example.com/' });
      res.end();
    } else {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Link not found' }));
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const added = await invoke(['add', 'https://example.com/'], base);
  assert.equal(added.code, 0);
  assert.equal(added.stdout.trim(), 'http://example.test/Ab12Cd');
  const listed = await invoke(['ls'], base);
  assert.equal(listed.code, 0);
  assert.match(listed.stdout, /Ab12Cd\s+2\s+https:\/\/example.com\//);
  let opened;
  await run(['open', 'Ab12Cd'], { env: { SNIP_API: base }, launch: async (url) => { opened = url; } });
  assert.equal(opened, 'https://example.com/');
  const missing = await invoke(['open', 'NoSuch'], base);
  assert.equal(missing.code, 1);
  assert.match(missing.stderr, /Link not found/);
  assert.deepEqual(requests, ['POST /api/links', 'GET /api/links', 'GET /Ab12Cd', 'GET /NoSuch']);
});

test('empty list and browser launcher selection', async (t) => {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('[]');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const result = await invoke(['ls'], `http://127.0.0.1:${server.address().port}`);
  assert.equal(result.stdout.trim(), 'No links yet.');
  assert.deepEqual(browserCommand('win32', 'https://example.com/'), ['rundll32.exe', ['url.dll,FileProtocolHandler', 'https://example.com/']]);
  assert.deepEqual(browserCommand('darwin', 'https://example.com/'), ['open', ['https://example.com/']]);
  assert.deepEqual(browserCommand('linux', 'https://example.com/'), ['xdg-open', ['https://example.com/']]);
});
