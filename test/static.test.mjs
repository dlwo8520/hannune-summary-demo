import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import vm from 'node:vm';

const docs = new URL('../docs/', import.meta.url);
const html = await readFile(new URL('index.html', docs), 'utf8');
const context = { window: {} };
vm.runInNewContext(await readFile(new URL('assets/examples.js', docs), 'utf8'), context);
const examples = context.window.HANNUNE_EXAMPLES;

test('five complete examples have unique, shareable ids and the correct models', () => {
  assert.equal(examples.length, 5);
  assert.equal(examples.filter((item) => item.language === 'kr').length, 3);
  assert.equal(examples.filter((item) => item.language === 'en').length, 2);
  assert.equal(new Set(examples.map((item) => item.id)).size, 5);
  for (const item of examples) {
    assert.match(item.id, /^[a-z]+$/);
    for (const key of ['title', 'label', 'category', 'source', 'summary']) assert.ok(item[key]?.trim(), `${item.id}.${key}`);
    assert.equal(item.model, item.language === 'kr' ? 'KoBART' : 'BART');
    assert.ok(item.summary.length < item.source.length, `${item.id} must be a shorter summary`);
    assert.ok(!item.summary.includes('\ufffd') && !item.source.includes('\ufffd'), 'UTF-8 content must be intact');
  }
});

test('all document assets exist and use subdirectory-safe relative URLs', async () => {
  const assets = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map((match) => match[1]).filter((url) => url.includes('assets/'));
  assert.ok(assets.length >= 4);
  for (const asset of assets) {
    assert.ok(asset.startsWith('./assets/'), asset);
    assert.ok((await readFile(new URL(asset, docs))).length > 0, asset);
  }
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'HTML ids must be unique');
});

test('the public page clearly declares a readonly static demo', () => {
  assert.match(html, /예시 데모/);
  assert.match(html, /사전 생성 결과/);
  assert.match(html, /<textarea[^>]+readonly/);
  assert.doesNotMatch(html, /<form|csrf_token|\{%|\{\{/);
  assert.match(html, /<html lang="ko">/);
});

test('the client has no inference, tracking, external script or persistence calls', async () => {
  const app = await readFile(new URL('assets/app.js', docs), 'utf8');
  assert.doesNotMatch(app, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|document\.cookie/);
  assert.doesNotMatch(html, /<script[^>]+src="https?:\/\//);
  assert.doesNotMatch(app, /innerHTML\s*=/, 'example text must be rendered as text');
});

test('the published directory contains only static web files', async () => {
  async function walk(url) {
    const entries = await readdir(url, { withFileTypes: true });
    for (const entry of entries) {
      const child = new URL(entry.name + (entry.isDirectory() ? '/' : ''), url);
      if (entry.isDirectory()) await walk(child);
      else {
        assert.match(entry.name, /^(?:\.nojekyll|[\w.-]+\.(?:html|css|js|svg))$/);
        const content = await readFile(child, 'utf8');
        assert.doesNotMatch(content, /(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_|cfat_|CLOUDFLARE_API_TOKEN\s*=)/);
      }
    }
  }
  await walk(docs);
});
