import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

for (const [locale, file] of [['de', 'partials/de/explorer/explorer.html'], ['en', 'partials/en/explorer/explorer.html']]) {
  test(`${locale} Explorer partial is wired to same-origin assets and API client`, () => {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(html, /\/css\/explorer\/explorer\.css/u);
    assert.match(html, /\/js\/explorer\/explorer\.js/u);
    assert.doesNotMatch(html, /<script(?![^>]*type="module"[^>]*src=)[^>]*>/u);
    assert.match(html, /0x7262Cca91938ede6bB6560F81104Aa410848e7f3/u);
    assert.match(html, /id="analyst-form"/u);
    assert.match(html, /id="analyst-result"/u);
    assert.match(html, /id="references-grid"/u);
    assert.match(html, new RegExp(`https://explorer\\.globalfoundationcoin\\.org/${locale}/`, 'u'));
    assert.doesNotMatch(html, /https:\/\/globalfoundationcoin\.org\/(?:de|en)\/explorer\//u);
  });
}

test('Explorer browser API is namespaced under /api/explorer', () => {
  const api = fs.readFileSync(path.join(root, 'js/explorer/modules/api.js'), 'utf8');
  assert.match(api, /const API_BASE = '\/api\/explorer'/u);
  assert.doesNotMatch(api, /GRAPH_API_KEY/u);
  assert.doesNotMatch(api, /OPENAI_API_KEY/u);
  assert.match(api, /analyst:/u);
});

test('Netlify routes expose canonical Explorer subdomain pages, legacy redirects and API namespace', () => {
  const redirects = fs.readFileSync(path.join(root, '_redirects'), 'utf8');
  assert.match(redirects, /https:\/\/explorer\.globalfoundationcoin\.org\/de\/\s+\/partials\/de\/explorer\/explorer\.html\s+200!/u);
  assert.match(redirects, /https:\/\/explorer\.globalfoundationcoin\.org\/en\/\s+\/partials\/en\/explorer\/explorer\.html\s+200!/u);
  assert.match(redirects, /\/de\/explorer\/\s+https:\/\/explorer\.globalfoundationcoin\.org\/de\/\s+301!/u);
  assert.match(redirects, /\/en\/explorer\/\s+https:\/\/explorer\.globalfoundationcoin\.org\/en\/\s+301!/u);
  assert.match(redirects, /\/api\/explorer\/\*\s+\/\.netlify\/functions\/explorer-api\?route=:splat\s+200!/u);
});
