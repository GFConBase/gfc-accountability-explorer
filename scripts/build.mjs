import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'web');
const dist = path.join(root, 'dist');

if (!fs.existsSync(path.join(source, 'index.html'))) throw new Error('web/index.html is missing.');
fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(source, dist, { recursive: true });

const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else files.push(full);
  }
}
walk(dist);

const forbidden = [/<script(?![^>]*\bsrc=)[^>]*>/iu, /on(?:click|load|error)\s*=/iu, /javascript:/iu];
for (const file of files.filter((item) => /\.(?:html|js)$/u.test(item))) {
  const content = fs.readFileSync(file, 'utf8');
  for (const pattern of forbidden) {
    if (pattern.test(content)) throw new Error(`Production build rejected unsafe pattern in ${path.relative(root, file)}: ${pattern}`);
  }
}

const bytes = files.reduce((total, file) => total + fs.statSync(file).size, 0);
console.log(`Production build created dist/ with ${files.length} files (${bytes.toLocaleString('en-US')} bytes).`);
