#!/usr/bin/env node
'use strict';

const { spawn } = require('node:child_process');

const usage = `Usage:
  snip add <url>    Create a short link
  snip ls           List links and hit counts
  snip open <code>  Open a link in your default browser
  snip help         Show this help

Set SNIP_API to the backend URL (default: http://localhost:3000).`;

function httpUrl(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid HTTP or HTTPS URL.`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${label} must be a valid HTTP or HTTPS URL.`);
  }
  return url;
}

function browserCommand(platform, url) {
  if (platform === 'win32') return ['rundll32.exe', ['url.dll,FileProtocolHandler', url]];
  if (platform === 'darwin') return ['open', [url]];
  return ['xdg-open', [url]];
}

function openBrowser(url) {
  const [command, args] = browserCommand(process.platform, url);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'ignore' });
    child.once('error', (error) => reject(new Error(`Unable to launch browser: ${error.message}`)));
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Browser launcher exited with ${code === null ? 'a signal' : `code ${code}`}.`));
    });
  });
}

async function request(base, path, options = {}) {
  let response;
  try {
    response = await fetch(new URL(path, base), {
      ...options,
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    if (error.name === 'TimeoutError') throw new Error('Backend request timed out.');
    throw new Error(`Unable to reach backend: ${error.message}`);
  }
  if (!response.ok && response.status !== 302) {
    let message;
    try {
      const body = await response.json();
      if (typeof body.error === 'string') message = body.error;
    } catch {
      // API errors need not be JSON.
    }
    throw new Error(message || `Backend returned HTTP ${response.status}.`);
  }
  return response;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    throw new Error('Backend returned invalid JSON.');
  }
}

async function run(args, { env = process.env, output = console.log, launch = openBrowser } = {}) {
  const [command, ...rest] = args;
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    if (rest.length) throw new Error('Help takes no arguments.');
    output(usage);
    return;
  }
  if (!['add', 'ls', 'open'].includes(command)) throw new Error(`Unknown command: ${command}`);
  if ((command === 'ls' && rest.length !== 0) || (command !== 'ls' && rest.length !== 1)) {
    throw new Error(`Invalid arguments for ${command}. Run snip help for usage.`);
  }
  if (command === 'add') httpUrl(rest[0], 'URL');
  if (command === 'open' && !/^[a-zA-Z0-9]{6}$/.test(rest[0])) {
    throw new Error('Code must contain exactly six letters or digits.');
  }
  const base = httpUrl(env.SNIP_API || 'http://localhost:3000', 'SNIP_API');

  if (command === 'add') {
    const response = await request(base, '/api/links', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: rest[0] }),
    });
    if (response.status !== 201) throw new Error(`Expected HTTP 201; received ${response.status}.`);
    const link = await readJson(response);
    if (typeof link.shortUrl !== 'string') throw new Error('Backend response is missing shortUrl.');
    output(link.shortUrl);
  } else if (command === 'ls') {
    const response = await request(base, '/api/links');
    if (response.status !== 200) throw new Error(`Expected HTTP 200; received ${response.status}.`);
    const links = await readJson(response);
    if (!Array.isArray(links) || links.some((link) =>
      !link || typeof link.code !== 'string' || typeof link.hits !== 'number' || typeof link.url !== 'string')) {
      throw new Error('Backend returned an invalid links list.');
    }
    if (!links.length) {
      output('No links yet.');
      return;
    }
    const codeWidth = Math.max(4, ...links.map((link) => link.code.length));
    const hitsWidth = Math.max(4, ...links.map((link) => String(link.hits).length));
    output(`${'CODE'.padEnd(codeWidth)}  ${'HITS'.padStart(hitsWidth)}  URL`);
    for (const link of links) output(`${link.code.padEnd(codeWidth)}  ${String(link.hits).padStart(hitsWidth)}  ${link.url}`);
  } else {
    const response = await request(base, `/${rest[0]}`);
    if (response.status !== 302) throw new Error(`Expected HTTP 302; received ${response.status}.`);
    const location = response.headers.get('location');
    if (!location) throw new Error('Backend redirect is missing Location.');
    let target;
    try {
      target = new URL(location, base).href;
    } catch {
      throw new Error('Backend returned an invalid redirect URL.');
    }
    httpUrl(target, 'Redirect URL');
    await launch(target);
  }
}

if (require.main === module) {
  run(process.argv.slice(2)).catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { browserCommand, run };
