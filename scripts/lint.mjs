import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoots = [
  'js/explorer',
  'lib/explorer',
  'netlify/functions',
  'tools',
  'tests/explorer',
  'scripts',
].map((name) => path.join(root, name));

const jsFiles = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(?:js|mjs|cjs)$/u.test(entry.name)) jsFiles.push(full);
  }
}

for (const dir of sourceRoots) walk(dir);

for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }
}

const sourceFiles = jsFiles.filter((file) => !file.includes(`${path.sep}tests${path.sep}`));
const banned = [
  { name: 'eval', pattern: /\beval\s*\(/u },
  { name: 'Function constructor', pattern: /\bnew\s+Function\s*\(/u },
  { name: 'document.write', pattern: /document\.write\s*\(/u },
  { name: 'innerHTML assignment', pattern: /\.innerHTML\s*=/u },
  { name: 'outerHTML assignment', pattern: /\.outerHTML\s*=/u },
];

for (const file of sourceFiles) {
  const content = fs.readFileSync(file, 'utf8');
  for (const rule of banned) {
    if (rule.pattern.test(content)) {
      console.error(`${rule.name} is not allowed: ${path.relative(root, file)}`);
      process.exit(1);
    }
  }
}

for (const locale of ['de', 'en']) {
  const html = fs.readFileSync(path.join(root, `partials/${locale}/explorer/explorer.html`), 'utf8');
  if (!/<main\s+id="main"/u.test(html)) throw new Error(`${locale}: missing main landmark.`);
  if (!/<label\s+for="search-input"/u.test(html)) throw new Error(`${locale}: search input requires a visible label.`);
  if (!/<button\s+type="submit"/u.test(html)) throw new Error(`${locale}: search action must use a button.`);
  if (!/<h1\b/u.test(html) || !/<h2\b/u.test(html)) throw new Error(`${locale}: heading hierarchy is incomplete.`);
  if (!/\/api\/explorer/u.test(fs.readFileSync(path.join(root, 'js/explorer/modules/api.js'), 'utf8'))) {
    throw new Error('Browser API must remain namespaced under /api/explorer.');
  }
}

console.log(`Lint passed: syntax + static security/accessibility checks across ${jsFiles.length} JavaScript files.`);
